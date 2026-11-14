import { COMMS, METERS_PER_PX, PLAYER_COLORS, SITES, WEATHER, WORLD_PX, levelAt } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { t } from '../i18n';
import { recordFrame } from '../state/frameStats';
import { prefs } from '../state/prefs';
import { Telemetry } from './telemetry';
import {
  RADAR,
  blipAlpha,
  drawCompass,
  drawCrewMark,
  drawDiamond,
  drawLander,
  drawNoise,
  drawSweep,
  drawTriangle,
  pulseRing,
  sweepAngle,
} from './radarDraw';
import { drawPending, drawStormBar, mmss, returnBudget } from './radarPanels';
export const MAP_SIZE = 640;
const SCALE = MAP_SIZE / WORLD_PX;
const RINGS = [50, 100, 150];
const px = (value: number) => Math.round(value * SCALE);
export class TacticalMap {
  private frame = 0;
  private terrain = document.createElement('canvas');
  private telemetry = new Telemetry();
  private trails = new Map<string, { x: number; y: number }[]>();
  private roster = store.getState().room?.players ?? [];
  private colors = PLAYER_COLORS.map((color) => `#${color.toString(16).padStart(6, '0')}`);
  constructor(
    private canvas: HTMLCanvasElement,
    private selected: () => string | null,
  ) {
    this.terrain.width = this.terrain.height = MAP_SIZE;
    const ctx = this.terrain.getContext('2d')!;
    ctx.fillStyle = RADAR.bg;
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    const salt = SITES[store.getState().room?.params?.site ?? 'jezero'].terrainSalt;
    ctx.fillStyle = '#1f5a40';
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
  private trail(id: string, x: number, y: number) {
    const list = this.trails.get(id) ?? [];
    const last = list[list.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > RADAR.trailMinMovePx / SCALE) {
      list.push({ x, y });
      if (list.length > RADAR.trailMax) list.shift();
    }
    this.trails.set(id, list);
    return list;
  }
  private draw = (): void => {
    this.frame = requestAnimationFrame(this.draw);
    const ctx = this.canvas.getContext('2d'),
      s = snaps.curr;
    if (!ctx || !s) return;
    const start = performance.now();
    this.telemetry.observe(s);
    const still = prefs.getState().reduceMotion;
    const now = still ? 0 : performance.now();
    const angle = sweepAngle(now);
    const cx = px(s.lander.x),
      cy = px(s.lander.y);
    const blip = (x: number, y: number) => (still ? 1 : blipAlpha(angle, cx, cy, px(x), px(y)));
    ctx.drawImage(this.terrain, 0, 0);
    const room = store.getState().room;
    const params = room?.params;
    if (room) this.roster = room.players;
    ctx.font = '13px monospace';
    ctx.lineWidth = 1;
    for (const m of RINGS) {
      this.circle(ctx, s.lander.x, s.lander.y, m / METERS_PER_PX, RADAR.grid);
      ctx.fillStyle = RADAR.text;
      ctx.fillText(`${m}m`, px(s.lander.x + m / METERS_PER_PX) + 3, cy - 3);
    }
    drawCompass(ctx, cx, cy, px(RINGS[RINGS.length - 1]! / METERS_PER_PX));
    if (!still) drawSweep(ctx, cx, cy, MAP_SIZE, angle);
    const storm = s.weather.storm;
    const active = storm !== null && s.t >= storm.tStart && s.t < storm.tEnd;
    const range =
      (params?.commsRange ?? 0) *
      (active ? WEATHER.stormComms : 1) *
      (COMMS.minEffMul + (1 - COMMS.minEffMul) * s.lander.power.eff.comms);
    if (!s.relay.open) {
      ctx.setLineDash([6, 5]);
      this.circle(ctx, s.lander.x, s.lander.y, range, RADAR.gridBright);
      ctx.setLineDash([]);
    }
    drawLander(ctx, cx, cy);
    for (const site of s.sites)
      if (site.known && (site.expiresAt === null || site.expiresAt > s.t)) {
        ctx.globalAlpha = blip(site.x, site.y);
        ctx.fillStyle = RADAR.site;
        drawDiamond(ctx, px(site.x), px(site.y), 5);
        ctx.fillText(
          params?.hasGpr ? `${t(`site.${site.kind}`)} ${'★'.repeat(site.richness)}` : site.id,
          px(site.x) + 8,
          px(site.y) + 4,
        );
        ctx.globalAlpha = 1;
      }
    for (let i = 0; i < s.stations.length; i++) {
      const p = s.stations[i]!;
      ctx.strokeStyle = ctx.fillStyle = RADAR.station;
      drawTriangle(ctx, px(p.x), px(p.y), 6);
      ctx.fillText(`${i + 1}`, px(p.x) + 9, px(p.y) + 4);
    }
    for (const e of s.seismic)
      if (e.estimate)
        pulseRing(
          ctx,
          px(e.estimate.x),
          px(e.estimate.y),
          e.estimate.r * SCALE,
          RADAR.amber,
          now,
          still,
        );
    for (const h of s.hazards) {
      pulseRing(ctx, px(h.x), px(h.y), h.r * SCALE, RADAR.danger, now, still);
      ctx.fillStyle = RADAR.danger;
      ctx.fillText(
        t('console.rockfall', { seconds: Math.max(0, Math.ceil(h.tHit - s.t)) }),
        px(h.x) + 4,
        px(h.y) - 4,
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
      const trail = this.trail(a.id, a.x, a.y);
      ctx.fillStyle = color;
      for (let i = 0; i < trail.length; i++) {
        ctx.globalAlpha = ((i + 1) / trail.length) * 0.35;
        ctx.fillRect(px(trail[i]!.x) - 1, px(trail[i]!.y) - 1, 2, 2);
      }
      ctx.globalAlpha = linked ? 1 : 0.4;
      drawCrewMark(ctx, px(a.x), px(a.y), a.facing, color);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(px(a.x), px(a.y), 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * a.o2) / a.o2Max);
      ctx.stroke();
      if (this.selected() === a.id) this.circle(ctx, a.x, a.y, 35, '#ffffff');
      const seconds = Math.max(0, Math.floor(s.t - contact.seenAt));
      const budget = returnBudget(
        a.o2,
        Math.hypot(a.x - s.lander.x, a.y - s.lander.y),
        params?.walkSpeed ?? 40,
        active ? WEATHER.stormSpeed : 1,
      );
      if (linked && budget.level !== 'ok') {
        ctx.fillStyle = budget.level === 'lost' ? RADAR.danger : RADAR.amber;
        ctx.fillText(
          budget.level === 'lost' ? 'NO RETURN' : `HOME NOW · +${mmss(budget.marginS)}`,
          px(a.x) + 14,
          px(a.y) + 18,
        );
        ctx.fillStyle = color;
      }
      ctx.fillText(
        linked
          ? player.name
          : t('console.lost', {
              time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
            }),
        px(a.x) + 14,
        px(a.y) + 4,
      );
      ctx.globalAlpha = 1;
      if (a.waypoint) {
        ctx.setLineDash([3, 4]);
        this.circle(ctx, a.waypoint.x, a.waypoint.y, 15, color);
        ctx.setLineDash([]);
        ctx.fillText(player.name, px(a.waypoint.x) + 8, px(a.waypoint.y));
      }
    }
    drawPending(ctx, MAP_SIZE, s.seismic, s.t);
    if (
      storm &&
      s.t < storm.tEnd &&
      s.weather.stormForecastAt !== null &&
      s.t >= s.weather.stormForecastAt
    )
      drawStormBar(ctx, MAP_SIZE, s.t, storm, active);
    if (active && !still) drawNoise(ctx, MAP_SIZE, 1);
    ctx.fillStyle = RADAR.text;
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
    ) {
      ctx.fillStyle = RADAR.amber;
      ctx.fillText(
        t(active ? 'console.stormActive' : 'console.storm', {
          seconds: Math.max(0, Math.ceil(storm.tStart - s.t)),
        }),
        12,
        40,
      );
    }
    recordFrame(
      performance.now() - start,
      s.sites.length + s.stations.length + this.telemetry.contacts.size + 1,
    );
  };
}
