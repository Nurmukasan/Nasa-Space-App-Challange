/** Drawing helpers for the tactical radar. All coordinates are canvas pixels. */
export const RADAR = {
  bg: '#100808',
  grid: '#5a3524',
  gridBright: '#a2623a',
  text: '#ffd9b0',
  sweep: '255, 176, 96',
  amber: '#ffb030',
  danger: '#ff6a58',
  ok: '#8dffb8',
  station: '#7bd9e5',
  site: '#ffc66a',
  font: '13px "Share Tech Mono", monospace',
  sweepPeriodMs: 5200,
  pingMs: 6000,
  trailRad: Math.PI * 0.55,
  tickCount: 36,
  tickLongEvery: 3,
  tickShortPx: 5,
  tickLongPx: 10,
  trailMax: 14,
  trailMinMovePx: 4,
  blipMinAlpha: 0.62,
  noiseDotsPerFrame: 420,
};

const TAU = Math.PI * 2;

/** Angle of the sweep arm for a given time, 0 at 3 o'clock, clockwise. */
export function sweepAngle(now: number): number {
  return ((now % RADAR.sweepPeriodMs) / RADAR.sweepPeriodMs) * TAU;
}

/** 1 right as the arm passes a point, fading to blipMinAlpha one turn later. */
export function blipAlpha(angle: number, cx: number, cy: number, x: number, y: number): number {
  const bearing = Math.atan2(y - cy, x - cx);
  const behind = (((angle - bearing) % TAU) + TAU) % TAU;
  return RADAR.blipMinAlpha + (1 - RADAR.blipMinAlpha) * (1 - behind / TAU);
}

export function drawCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.strokeStyle = RADAR.gridBright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < RADAR.tickCount; i++) {
    const a = (i / RADAR.tickCount) * TAU;
    const len = i % RADAR.tickLongEvery === 0 ? RADAR.tickLongPx : RADAR.tickShortPx;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
    ctx.stroke();
  }
  ctx.strokeStyle = RADAR.grid;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.fillStyle = RADAR.text;
  ctx.font = RADAR.font;
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - r - RADAR.tickLongPx - 4);
  ctx.fillText('S', cx, cy + r + RADAR.tickLongPx + 14);
  ctx.textAlign = 'left';
  ctx.fillText('E', cx + r + RADAR.tickLongPx + 4, cy + 4);
  ctx.textAlign = 'right';
  ctx.fillText('W', cx - r - RADAR.tickLongPx - 4, cy + 4);
  ctx.textAlign = 'left';
}

/** The rotating arm with a fading green wake behind it. */
export function drawSweep(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  angle: number,
) {
  const grad = ctx.createConicGradient(angle - RADAR.trailRad, cx, cy);
  const k = RADAR.trailRad / TAU;
  grad.addColorStop(0, `rgba(${RADAR.sweep}, 0)`);
  grad.addColorStop(k, `rgba(${RADAR.sweep}, 0.3)`);
  grad.addColorStop(Math.min(1, k + 0.001), `rgba(${RADAR.sweep}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${RADAR.sweep}, 0.9)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  ctx.stroke();
  ctx.lineWidth = 1;
}

/** Crew marker: a triangle pointing where the astronaut faces. */
export function drawCrewMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(facing) * 8, y + Math.sin(facing) * 8);
  ctx.lineTo(x + Math.cos(facing + 2.5) * 6, y + Math.sin(facing + 2.5) * 6);
  ctx.lineTo(x + Math.cos(facing - 2.5) * 6, y + Math.sin(facing - 2.5) * 6);
  ctx.closePath();
  ctx.fill();
}

export function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

export function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y + r * 0.8);
  ctx.lineTo(x - r, y + r * 0.8);
  ctx.closePath();
  ctx.stroke();
}

/** Lander: a filled square inside two corner brackets. */
export function drawLander(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = RADAR.text;
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.strokeStyle = RADAR.text;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    ctx.moveTo(x + sx * 11, y + sy * 5);
    ctx.lineTo(x + sx * 11, y + sy * 11);
    ctx.lineTo(x + sx * 5, y + sy * 11);
  }
  ctx.stroke();
}

/** A ring that breathes in and out, used for warnings. */
export function pulseRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  now: number,
  still: boolean,
) {
  const k = still ? 0.5 : (now % 1200) / 1200;
  ctx.globalAlpha = 1 - k * 0.7;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * (0.7 + 0.3 * k), 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

/** Static from the dust storm. */
export function drawNoise(ctx: CanvasRenderingContext2D, size: number, amount: number) {
  ctx.fillStyle = `rgba(${RADAR.sweep}, 0.5)`;
  const dots = Math.round(RADAR.noiseDotsPerFrame * amount);
  for (let i = 0; i < dots; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
}

/** One slow ping ring leaving the lander every few seconds. Purely a heartbeat, so it stays faint. */
export function drawPing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  maxR: number,
  now: number,
) {
  const k = (now % RADAR.pingMs) / RADAR.pingMs;
  ctx.globalAlpha = (1 - k) * 0.22;
  ctx.strokeStyle = RADAR.gridBright;
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * k, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
