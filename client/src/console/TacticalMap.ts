import { COMMS, METERS_PER_PX, PLAYER_COLORS, SITES, WEATHER, WORLD_PX } from '@rs/shared';
import { snaps } from '../state/snapshots';
import { store } from '../state/store';
import { t } from '../i18n';
import { recordFrame } from '../state/frameStats';
import { prefs } from '../state/prefs';
import { Telemetry } from './telemetry';
import {
  RADAR,
  blipAlpha,
  crossed,
  drawBlipRing,
  drawBackdrop,
  drawCompass,
  drawCrewMark,
  drawLander,
  drawNoise,
  drawPing,
  drawSweep,
  sweepAngle,
  drawTriangle,
  pulseRing,
} from './radarDraw';
import { buildBasemap } from './radarBase';
import { drawGhostZone, drawReturnRing, drawScaleBar, drawTether } from './radarCrew';
import { drawSite } from './radarSites';
import { drawPending, drawStormBar, mmss, returnBudget, tiersTotal } from './radarPanels';
import { drawAnomalies, drawLocate } from './locateOverlay';
import { drawDevils } from './radarHazards';
import { audio } from '../audio';
export const MAP_SIZE = 640;
const SCALE = MAP_SIZE / WORLD_PX;
const RINGS = [50, 100, 150];
const px = (value: number) => Math.round(value * SCALE);
export class TacticalMap {
  private frame = 0;
  private terrain: HTMLCanvasElement;
  private telemetry = new Telemetry();
  private trails = new Map<string, { x: number; y: number }[]>();
  /** Horizontal stretch of the square world, so the radar fills its whole (wider) pane. */
  private kx = 1;
  private prevAngle: number | null = null;
  private pinged = new Map<string, number>();
  private roster = store.getState().room?.players ?? [];
  private colors = PLAYER_COLORS.map((color) => `#${color.toString(16).padStart(6, '0')}`);
  constructor(
    private canvas: HTMLCanvasElement,
    private selected: () => string | null,
    private locating: () => string | null = () => null,
  ) {
    this.terrain = buildBasemap(MAP_SIZE);
    this.draw();
  }
  destroy(): void {
    cancelAnimationFrame(this.frame);
  }
  point(clientX: number, clientY: number) {
    const b = this.canvas.getBoundingClientRect();
    const wx = (((clientX - b.left) / b.width) * this.canvas.width) / this.kx / MAP_SIZE;
    return {
      x: Math.max(0, Math.min(WORLD_PX, wx * WORLD_PX)),
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
    const cx = px(s.lander.x),
      cy = px(s.lander.y);
    const wide = this.canvas.width;
    this.kx = wide / MAP_SIZE;
    drawBackdrop(ctx, wide, MAP_SIZE, 0);
    ctx.save();
    ctx.scale(this.kx, 1);
    ctx.drawImage(this.terrain, 0, 0);
    const room = store.getState().room;
    const params = room?.params;
    if (room) this.roster = room.players;
    ctx.font = RADAR.font;
    ctx.lineWidth = 1;
    for (const m of RINGS) {
      this.circle(ctx, s.lander.x, s.lander.y, m / METERS_PER_PX, RADAR.grid);
      ctx.fillStyle = RADAR.text;
      ctx.fillText(`${m}m`, px(s.lander.x + m / METERS_PER_PX) + 3, cy - 3);
    }
    // The arm sweeps the whole map; sites light up and chirp as it passes over them.
    const angle = sweepAngle(now);
    if (!still) drawSweep(ctx, cx, cy, MAP_SIZE, angle);
    drawCompass(ctx, cx, cy, px(RINGS[RINGS.length - 1]! / METERS_PER_PX));
    if (!still) drawPing(ctx, cx, cy, px(RINGS[RINGS.length - 1]! / METERS_PER_PX), now);
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
    const prev = this.prevAngle;
    this.prevAngle = angle;
    let chirp = false;
    for (const site of s.sites) {
      const total = tiersTotal(site.kind, params?.maxDepth ?? 3);
      // Once every tier is in somebody's hands there is nothing left to find here.
      if (site.taken.length >= total) continue;
      if (site.known && (site.expiresAt === null || site.expiresAt > s.t)) {
        const sx = px(site.x),
          sy = px(site.y);
        if (!still && prev !== null && crossed(prev, angle, Math.atan2(sy - cy, sx - cx))) {
          this.pinged.set(site.id, now);
          chirp = true;
        }
        const at = this.pinged.get(site.id);
        if (at !== undefined) drawBlipRing(ctx, sx, sy, now - at, RADAR.site);
        drawSite(
          ctx,
          sx,
          sy,
          site.richness,
          total - site.taken.length,
          total,
          params?.hasGpr ? `${site.id} ${t(`site.${site.kind}`)}` : site.id,
          still ? 1 : blipAlpha(angle, cx, cy, sx, sy),
        );
      }
    }
    if (chirp) audio.sfx('radar_ping');
    drawAnomalies(ctx, s, SCALE);
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
    drawLocate(ctx, s, SCALE, this.locating());
    for (const h of s.hazards) {
      pulseRing(ctx, px(h.x), px(h.y), h.r * SCALE, RADAR.danger, now, still);
      ctx.fillStyle = RADAR.danger;
      ctx.fillText(
        t('console.rockfall', { seconds: Math.max(0, Math.ceil(h.tHit - s.t)) }),
        px(h.x) + 4,
        px(h.y) - 4,
      );
    }
    drawDevils(ctx, s, SCALE, !!params?.hasWeather);
    const walkSpeed = params?.walkSpeed ?? 40,
      speedMul = active ? WEATHER.stormSpeed : 1;
    const rows = this.roster.flatMap((player, slot) => {
      const contact = this.telemetry.contacts.get(player.id);
      if (!contact) return [];
      const a = contact.crew;
      const live = s.astronauts.find((c) => c.id === a.id);
      const linked = !!live?.linked;
      const color = this.colors[player.colorIdx] ?? '#ffffff';
      const budget = returnBudget(
        a.o2,
        Math.hypot(a.x - s.lander.x, a.y - s.lander.y),
        walkSpeed,
        speedMul,
      );
      return [{ player, slot, a, linked, color, budget, seen: contact.seenAt }];
    });
    // Layer 1: air limits and tethers sit under the markers.
    for (const r of rows) {
      const selected = this.selected() === r.a.id;
      if (r.linked)
        drawReturnRing(
          ctx,
          cx,
          cy,
          px(r.budget.o2S * walkSpeed * speedMul),
          r.color,
          selected,
          t('console.radar.limit', { name: r.player.name }),
          r.slot,
        );
      const text =
        r.budget.level === 'lost'
          ? t('console.radar.noReturn', { air: mmss(r.budget.o2S) })
          : t('console.radar.home', { home: mmss(r.budget.homeS), air: mmss(r.budget.o2S) });
      if (r.linked)
        drawTether(
          ctx,
          px(r.a.x),
          px(r.a.y),
          cx,
          cy,
          r.budget.level,
          selected || r.budget.level !== 'ok' ? text : null,
        );
      else if (r.a.status === 'active') {
        const age = Math.max(0, s.t - r.seen);
        drawGhostZone(
          ctx,
          px(r.a.x),
          px(r.a.y),
          Math.min(px(age * walkSpeed), MAP_SIZE / 3),
          r.color,
        );
      }
    }
    // Layer 2: the crew themselves.
    for (const { player, a, linked, color, seen } of rows) {
      const trail = this.trail(a.id, a.x, a.y);
      ctx.fillStyle = color;
      for (let i = 0; i < trail.length; i++) {
        ctx.globalAlpha = ((i + 1) / trail.length) * 0.35;
        ctx.fillRect(px(trail[i]!.x) - 1, px(trail[i]!.y) - 1, 2, 2);
      }
      ctx.globalAlpha = linked ? 1 : 0.5;
      drawCrewMark(ctx, px(a.x), px(a.y), a.facing, color);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(px(a.x), px(a.y), 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * a.o2) / a.o2Max);
      ctx.stroke();
      if (this.selected() === a.id) this.circle(ctx, a.x, a.y, 35, '#ffffff');
      const seconds = Math.max(0, Math.floor(s.t - seen));
      ctx.fillText(
        linked ? player.name : t('console.lost', { time: mmss(seconds) }),
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
    drawScaleBar(
      ctx,
      14,
      MAP_SIZE - 14,
      (100 / METERS_PER_PX) * SCALE,
      t('console.radar.scale', { m: 100 }),
    );
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
    const flare = s.flare;
    if (flare && s.t < flare.tEnd) {
      ctx.fillStyle = RADAR.amber;
      ctx.fillText(
        s.t >= flare.tStart
          ? t('console.flareActive')
          : t('console.flare', { seconds: Math.max(0, Math.ceil(flare.tStart - s.t)) }),
        12,
        60,
      );
    }
    ctx.restore();
    recordFrame(
      performance.now() - start,
      s.sites.length + s.stations.length + this.telemetry.contacts.size + 1,
    );
  };
}
