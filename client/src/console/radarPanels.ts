import { O2 } from '@rs/shared';
import type { SeismicEvent } from '@rs/shared';
import { RADAR } from './radarDraw';

export const WARN = { marginS: 15, listMax: 5, panelW: 150, rowH: 18, urgentS: 10 };

export const mmss = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Can this astronaut still walk home on the oxygen they have? */
export function returnBudget(o2: number, distancePx: number, walkSpeed: number, speedMul = 1) {
  const o2S = o2 / O2.walk;
  const homeS = distancePx / Math.max(1, walkSpeed * speedMul);
  const marginS = o2S - homeS;
  return {
    o2S,
    homeS,
    marginS,
    level: marginS < 0 ? 'lost' : marginS < WARN.marginS ? 'warn' : 'ok',
  } as const;
}

/** Events the crew has felt but the operator has not classified yet. */
export function drawPending(
  ctx: CanvasRenderingContext2D,
  size: number,
  events: SeismicEvent[],
  now: number,
): void {
  const open = events.filter((e) => e.truth === null).slice(0, WARN.listMax);
  if (!open.length) return;
  const x = size - WARN.panelW - 10;
  ctx.fillStyle = '#03100bcc';
  ctx.fillRect(x - 6, 8, WARN.panelW + 6, 22 + open.length * WARN.rowH);
  ctx.fillStyle = RADAR.text;
  ctx.fillText('SEISMIC · CLASSIFY', x, 24);
  open.forEach((e, i) => {
    const left = e.deadline - now;
    ctx.fillStyle = left < WARN.urgentS ? RADAR.danger : RADAR.amber;
    const heard = e.signals.filter((s) => s.amp > 0).length;
    ctx.fillText(`EVT ${i + 1} · ${heard}ST · ${mmss(left)}`, x, 44 + i * WARN.rowH);
  });
}

/** Progress bar at the bottom: storm countdown while it is coming, remaining time while it blows. */
export function drawStormBar(
  ctx: CanvasRenderingContext2D,
  size: number,
  now: number,
  storm: { tStart: number; tEnd: number },
  active: boolean,
): void {
  const w = 220,
    x = (size - w) / 2,
    y = size - 26;
  const frac = active
    ? (storm.tEnd - now) / (storm.tEnd - storm.tStart)
    : Math.max(0, 1 - (storm.tStart - now) / 90);
  ctx.fillStyle = '#03100bcc';
  ctx.fillRect(x - 6, y - 16, w + 12, 30);
  ctx.fillStyle = active ? RADAR.danger : RADAR.amber;
  ctx.fillText(
    active ? `STORM · ENDS ${mmss(storm.tEnd - now)}` : `STORM · ETA ${mmss(storm.tStart - now)}`,
    x,
    y - 3,
  );
  ctx.fillRect(x, y + 2, w * Math.min(1, Math.max(0, frac)), 4);
  ctx.strokeStyle = RADAR.grid;
  ctx.strokeRect(x, y + 2, w, 4);
}
