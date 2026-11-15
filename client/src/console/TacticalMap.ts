import {
  COMMS,
  LANDER_POS,
  METERS_PER_PX,
  PLAYER_COLORS,
  SITES,
  WEATHER,
  WORLD_MAX,
  WORLD_MIN,
  WORLD_PX,
} from '@rs/shared';
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
import { drawExpedition, drawValley } from './radarValley';
import { audio } from '../audio';
export const MAP_SIZE = 640;
/** The classic landing area: what the radar always showed (and still shows outside the big world). */
const LANDING_SPAN = 1536;
/** Big-world zoom levels, world px across the map: landing area, half the valley, all of it. */
const SPANS = [LANDING_SPAN, WORLD_PX / 2, WORLD_PX];
/** Click radius for picking a crew member, screen px. */
const HIT_PX = 14;
/** Map px per world px for the current frame (zoom). */
let SCALE = MAP_SIZE / LANDING_SPAN;
const RINGS = [50, 100, 150];
const px = (value: number) => Math.round(value * SCALE);
interface View {
  x0: number;
  y0: number;
  span: number;
}
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
  /** Big-world zoom level, an index into SPANS. */
  private zoom = 0;
  private view: View = {
    x0: LANDER_POS.x - LANDING_SPAN / 2,
    y0: LANDER_POS.y - LANDING_SPAN / 2,
    span: LANDING_SPAN,
  };
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
    // The square map is stretched across the pane (kx); the view picks the world window.
    const fx = (((clientX - b.left) / b.width) * this.canvas.width) / this.kx / MAP_SIZE;
    const fy = (clientY - b.top) / b.height;
    const { x0, y0, span } = this.view;
    return {
      x: Math.max(WORLD_MIN, Math.min(WORLD_MAX, x0 + fx * span)),
      y: Math.max(WORLD_MIN, Math.min(WORLD_MAX, y0 + fy * span)),
    };
  }
  hitAt(x: number, y: number): string | null {
    for (const [id, p] of this.telemetry.contacts)
      if (Math.hypot(p.crew.x - x, p.crew.y - y) < HIT_PX / SCALE) return id;
    return null;
  }
  /** Big world only: wheel or buttons step through the zoom levels. */
  zoomBy(step: number): void {
    if (!store.getState().room?.params?.bigWorld) return;
    this.zoom = Math.max(0, Math.min(SPANS.length - 1, this.zoom + Math.sign(step)));
  }
  /** Classic: the landing area. Big world: follow the selected crew member, or show it all. */
  private frameView(): View {
    const bigWorld = store.getState().room?.params?.bigWorld ?? false;
    const span = bigWorld ? SPANS[this.zoom]! : LANDING_SPAN;
    if (!bigWorld || span >= WORLD_PX) {
      const centre = bigWorld
        ? { x: WORLD_MIN + WORLD_PX / 2, y: WORLD_MIN + WORLD_PX / 2 }
        : LANDER_POS;
      return { x0: centre.x - span / 2, y0: centre.y - span / 2, span };
    }
    const id = this.selected();
    const crew = id ? this.telemetry.contacts.get(id)?.crew : undefined;
    const c = crew ?? LANDER_POS;
    const clamp = (v: number) => Math.max(WORLD_MIN, Math.min(WORLD_MAX - span, v));
    return { x0: clamp(c.x - span / 2), y0: clamp(c.y - span / 2), span };
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
    this.view = this.frameView();
    SCALE = MAP_SIZE / this.view.span;
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
    if (params?.bigWorld) drawValley(ctx, SITES[params.site].terrainSalt, this.view);
    // World layer: everything below is placed in world px through px(); screen overlays follow.
    ctx.save();
    ctx.translate(-px(this.view.x0), -px(this.view.y0));
    if (room) this.roster = room.players;
    ctx.font = RADAR.font;
    ctx.lineWidth = 1;
    // Ring labels only while the rings are far enough apart to read (zoomed-out big world).
    const ringLabels = px(RINGS[0]! / METERS_PER_PX) >= 40;
    for (const m of RINGS) {
      this.circle(ctx, s.lander.x, s.lander.y, m / METERS_PER_PX, RADAR.grid);
      ctx.fillStyle = RADAR.text;
      if (ringLabels) ctx.fillText(`${m}m`, px(s.lander.x + m / METERS_PER_PX) + 3, cy - 3);
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
    drawExpedition(ctx, s, px, SCALE);
    ctx.restore();
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
