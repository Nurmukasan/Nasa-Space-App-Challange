import { COMMS, METERS_PER_PX, PLAYER_COLORS, SITES, WEATHER, WORLD_PX, levelAt } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { t } from '../i18n';
import { recordFrame } from '../state/frameStats';
import { Telemetry } from './telemetry';
import { drawAnomalies, drawLocate } from './locateOverlay';
export const MAP_SIZE = 640;
const SCALE = MAP_SIZE / WORLD_PX;
const RINGS = [50, 100, 150];
const px = (value: number) => Math.round(value * SCALE);
export class TacticalMap {
  private frame = 0;
  private terrain = document.createElement('canvas');
  private telemetry = new Telemetry();
  private roster = store.getState().room?.players ?? [];
  private colors = PLAYER_COLORS.map((color) => `#${color.toString(16).padStart(6, '0')}`);
  constructor(
    private canvas: HTMLCanvasElement,
    private selected: () => string | null,
    private locating: () => string | null = () => null,
  ) {
    this.terrain.width = this.terrain.height = MAP_SIZE;
    const ctx = this.terrain.getContext('2d')!;
    ctx.fillStyle = '#081912';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    const salt = SITES[store.getState().room?.params?.site ?? 'jezero'].terrainSalt;
    ctx.fillStyle = '#20563d';
    for (let y = 0; y < WORLD_PX; y += 4)
      for (let x = 0; x < WORLD_PX; x += 4) {
        const level = levelAt(x, y, salt);
        if (level !== levelAt(x + 4, y, salt) || level !== levelAt(x, y + 4, salt))
          ctx.fillRect(px(x), px(y), 1, 1);
      }
    this.draw();
  }
  destroy(): void {
    cancelAnimationFrame(this.frame);
  }
  point(clientX: number, clientY: number) {
    const b = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(WORLD_PX, ((clientX - b.left) / b.width) * WORLD_PX)),
      y: Math.max(0, Math.min(WORLD_PX, ((clientY - b.top) / b.height) * WORLD_PX)),
    };
  }
  hitAt(x: number, y: number): string | null {
    for (const [id, p] of this.telemetry.contacts)
      if (Math.hypot(p.crew.x - x, p.crew.y - y) < 35) return id;
    return null;
  }
  private circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(px(x), px(y), r * SCALE, 0, Math.PI * 2);
    ctx.stroke();
  }
  private draw = (): void => {
    this.frame = requestAnimationFrame(this.draw);
    const ctx = this.canvas.getContext('2d'),
      s = snaps.curr;
    if (!ctx || !s) return;
    const start = performance.now();
    this.telemetry.observe(s);
    ctx.drawImage(this.terrain, 0, 0);
    const room = store.getState().room;
    const params = room?.params;
    if (room) this.roster = room.players;
    ctx.font = '13px monospace';
    ctx.fillStyle = '#90ffb0';
    for (const m of RINGS) {
      this.circle(ctx, s.lander.x, s.lander.y, m / METERS_PER_PX, '#244c38');
      ctx.fillText(`${m}m`, px(s.lander.x + m / METERS_PER_PX), px(s.lander.y));
    }
    const storm = s.weather.storm;
    const active = storm !== null && s.t >= storm.tStart && s.t < storm.tEnd;
    const range =
      (params?.commsRange ?? 0) *
      (active ? WEATHER.stormComms : 1) *
      (COMMS.minEffMul + (1 - COMMS.minEffMul) * s.lander.power.eff.comms);
    if (!s.relay.open) this.circle(ctx, s.lander.x, s.lander.y, range, '#63a888');
    ctx.fillRect(px(s.lander.x) - 5, px(s.lander.y) - 5, 10, 10);
    for (const site of s.sites)
      if (site.known && (site.expiresAt === null || site.expiresAt > s.t)) {
        ctx.fillStyle = '#aadd66';
        ctx.fillRect(px(site.x) - 3, px(site.y) - 3, 6, 6);
        ctx.fillText(
          params?.hasGpr ? `${t(`site.${site.kind}`)} ${'★'.repeat(site.richness)}` : site.id,
          px(site.x) + 5,
          px(site.y),
        );
      }
    drawAnomalies(ctx, s, SCALE);
    for (let i = 0; i < s.stations.length; i++) {
      const p = s.stations[i]!;
      ctx.fillStyle = '#7bd9e5';
      ctx.fillText(`△ ${i + 1}`, px(p.x), px(p.y));
    }
    for (const e of s.seismic)
      if (e.estimate) this.circle(ctx, e.estimate.x, e.estimate.y, e.estimate.r, '#ffc66a');
    drawLocate(ctx, s, SCALE, this.locating());
    for (const h of s.hazards) {
      this.circle(ctx, h.x, h.y, h.r, '#ff7766');
      ctx.fillStyle = '#ff7766';
      ctx.fillText(
        t('console.rockfall', { seconds: Math.max(0, Math.ceil(h.tHit - s.t)) }),
        px(h.x),
        px(h.y),
      );
    }
    for (const player of this.roster) {
      const contact = this.telemetry.contacts.get(player.id);
      if (!contact) continue;
      const a = contact.crew;
      let linked = false;
      for (const live of s.astronauts)
        if (live.id === a.id) {
          linked = live.linked;
          break;
        }
      const color = this.colors[player.colorIdx] ?? '#ffffff';
      ctx.globalAlpha = linked ? 1 : 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(px(a.x) - 4, px(a.y) - 4, 8, 8);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(px(a.x), px(a.y), 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * a.o2) / a.o2Max);
      ctx.stroke();
      if (this.selected() === a.id) this.circle(ctx, a.x, a.y, 35, '#ffffff');
      const seconds = Math.max(0, Math.floor(s.t - contact.seenAt));
      ctx.fillText(
        linked
          ? player.name
          : t('console.lost', {
              time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
            }),
        px(a.x) + 12,
        px(a.y),
      );
      ctx.globalAlpha = 1;
      if (a.waypoint) {
        this.circle(ctx, a.waypoint.x, a.waypoint.y, 15, color);
        ctx.fillText(player.name, px(a.waypoint.x) + 8, px(a.waypoint.y));
      }
    }
    ctx.fillStyle = '#b8ffcf';
    const relayKey =
      params?.relay === 'none'
        ? 'console.relayNone'
        : params?.relay === 'areostationary'
          ? 'console.relayPermanent'
          : s.relay.open
            ? 'console.relayOpen'
            : 'console.relayClosed';
    ctx.fillText(
      t(relayKey, { seconds: Math.max(0, Math.ceil(s.relay.nextChangeAt - s.t)) }),
      12,
      20,
    );
    if (
      storm &&
      s.weather.stormForecastAt !== null &&
      s.t >= s.weather.stormForecastAt &&
      s.t < storm.tEnd
    )
      ctx.fillText(
        t(active ? 'console.stormActive' : 'console.storm', {
          seconds: Math.max(0, Math.ceil(storm.tStart - s.t)),
        }),
        12,
        40,
      );
    recordFrame(
      performance.now() - start,
      s.sites.length + s.stations.length + this.telemetry.contacts.size + 1,
    );
  };
}
