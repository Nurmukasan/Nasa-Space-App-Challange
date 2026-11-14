import { COMMS, METERS_PER_PX, PLAYER_COLORS, SITES, WORLD_PX, levelAt } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { t } from '../i18n';
const SIZE = 640;
const scale = SIZE / WORLD_PX;
export class TacticalMap {
  private frame = 0;
  private terrain = document.createElement('canvas');
  private last = new Map<string, { x: number; y: number; t: number }>();
  constructor(
    private canvas: HTMLCanvasElement,
    private selected: () => string | null,
  ) {
    this.terrain.width = this.terrain.height = SIZE;
    const ctx = this.terrain.getContext('2d')!;
    ctx.fillStyle = '#081912';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const salt = SITES[store.getState().room?.params?.site ?? 'jezero'].terrainSalt;
    ctx.fillStyle = '#20563d';
    for (let y = 0; y < WORLD_PX; y += 4)
      for (let x = 0; x < WORLD_PX; x += 4) {
        const level = levelAt(x, y, salt);
        if (level !== levelAt(x + 4, y, salt) || level !== levelAt(x, y + 4, salt))
          ctx.fillRect(Math.round(x * scale), Math.round(y * scale), 1, 1);
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
  private draw = (): void => {
    this.frame = requestAnimationFrame(this.draw);
    const ctx = this.canvas.getContext('2d');
    const s = snaps.curr;
    if (!ctx || !s) return;
    ctx.drawImage(this.terrain, 0, 0);
    const room = store.getState().room;
    const params = room?.params;
    const circle = (x: number, y: number, radius: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(x * scale, y * scale, radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    };
    ctx.font = '13px monospace';
    ctx.fillStyle = '#90ffb0';
    for (const m of [50, 100, 150]) {
      circle(s.lander.x, s.lander.y, m / METERS_PER_PX, '#244c38');
      ctx.fillText(`${m}m`, (s.lander.x + m / METERS_PER_PX) * scale, s.lander.y * scale);
    }
    const range =
      (params?.commsRange ?? 0) *
      (COMMS.minEffMul + (1 - COMMS.minEffMul) * s.lander.power.eff.comms);
    circle(s.lander.x, s.lander.y, range, '#63a888');
    ctx.fillRect(s.lander.x * scale - 5, s.lander.y * scale - 5, 10, 10);
    for (const site of s.sites)
      if (site.known && (site.expiresAt === null || site.expiresAt > s.t)) {
        ctx.fillStyle = '#aadd66';
        ctx.fillRect(site.x * scale - 3, site.y * scale - 3, 6, 6);
        ctx.fillText(
          params?.hasGpr ? `${t(`site.${site.kind}`)} ${'★'.repeat(site.richness)}` : site.id,
          site.x * scale + 5,
          site.y * scale,
        );
      }
    s.stations.forEach((p, i) => {
      ctx.fillStyle = '#7bd9e5';
      ctx.fillText(`△ ${i + 1}`, p.x * scale, p.y * scale);
    });
    for (const event of s.seismic)
      if (event.estimate && s.t < event.deadline + 9)
        circle(event.estimate.x, event.estimate.y, event.estimate.r, '#ffc66a');
    for (const h of s.hazards)
      if (s.t <= h.tHit) {
        circle(h.x, h.y, h.r, '#ff7766');
        ctx.fillStyle = '#ff7766';
        ctx.fillText(
          t('console.rockfall', { seconds: Math.ceil(h.tHit - s.t) }),
          h.x * scale,
          h.y * scale,
        );
      }
    for (const a of s.astronauts) {
      if (a.linked) this.last.set(a.id, { x: a.x, y: a.y, t: s.t });
      const p = this.last.get(a.id);
      if (!p) continue;
      const player = room?.players.find((p) => p.id === a.id);
      const color = `#${(PLAYER_COLORS[player?.colorIdx ?? 0] ?? 0xffffff).toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = a.linked ? 1 : 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(p.x * scale - 4, p.y * scale - 4, 8, 8);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(
        p.x * scale,
        p.y * scale,
        9,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * a.o2) / a.o2Max,
      );
      ctx.stroke();
      if (this.selected() === a.id) circle(p.x, p.y, 35, '#ffffff');
      const seconds = Math.max(0, Math.floor(s.t - p.t));
      ctx.fillText(
        a.linked
          ? (player?.name ?? a.id)
          : t('console.lost', {
              time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
            }),
        p.x * scale + 12,
        p.y * scale,
      );
      ctx.globalAlpha = 1;
      if (a.waypoint) {
        circle(a.waypoint.x, a.waypoint.y, 15, color);
        ctx.fillStyle = color;
        ctx.fillText(player?.name ?? a.id, a.waypoint.x * scale + 8, a.waypoint.y * scale);
      }
    }
    ctx.fillStyle = '#b8ffcf';
    ctx.fillText(
      t(s.relay.open ? 'console.relayOpen' : 'console.relayClosed', {
        seconds: Math.max(0, Math.ceil(s.relay.nextChangeAt - s.t)),
      }),
      12,
      20,
    );
    if (
      s.weather.storm &&
      s.weather.stormForecastAt !== null &&
      s.t >= s.weather.stormForecastAt &&
      s.t < s.weather.storm.tEnd
    )
      ctx.fillText(
        t('console.storm', { seconds: Math.max(0, Math.ceil(s.weather.storm.tStart - s.t)) }),
        12,
        40,
      );
  };
}
