// Mission Control map overlays for v2: station range rings, the station-0 bearing sector,
// the operator's pick, orbital anomalies and the RED SIGNAL search zone (PL 7.6, 7.11, 7.12).
import { LOCATE } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { t } from '../i18n';

const RING = '#ffc66a';
const PICK = '#ffffff';
const ANOMALY = '#8fd18f';
const SIGNAL = '#ff3d6e';
/** Rings stay on the map a little after the decision deadline. */
const LINGER_S = 4;

export function drawLocate(
  ctx: CanvasRenderingContext2D,
  s: EvaState,
  scale: number,
  locating: string | null,
): void {
  const p = (v: number) => Math.round(v * scale);
  ctx.save();
  ctx.lineWidth = 1;
  for (const e of s.seismic) {
    if (s.t > e.deadline + LINGER_S) continue;
    const active = e.id === locating;
    ctx.globalAlpha = active ? 1 : 0.55;
    ctx.strokeStyle = e.signal ? SIGNAL : RING;
    ctx.setLineDash([4, 4]);
    for (const sig of e.signals) {
      const st = s.stations[sig.stationIdx];
      // A ring appears only once the wave has reached the station.
      if (!st || sig.distEst <= 0 || s.t < e.t0 + sig.delayS || sig.amp <= 0) continue;
      ctx.beginPath();
      ctx.arc(p(st.x), p(st.y), sig.distEst * scale, 0, Math.PI * 2);
      ctx.stroke();
      if (sig.bearingEst !== null) {
        ctx.setLineDash([]);
        for (const side of [-1, 1]) {
          const a = sig.bearingEst + side * LOCATE.bearingErr;
          ctx.beginPath();
          ctx.moveTo(p(st.x), p(st.y));
          ctx.lineTo(
            p(st.x + Math.cos(a) * sig.distEst * 1.3),
            p(st.y + Math.sin(a) * sig.distEst * 1.3),
          );
          ctx.stroke();
        }
        ctx.setLineDash([4, 4]);
      }
    }
    ctx.setLineDash([]);
    if (e.pick) {
      const x = p(e.pick.x),
        y = p(e.pick.y);
      ctx.strokeStyle = PICK;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
      ctx.fillStyle = PICK;
      ctx.fillText(t(e.signal ? 'console.pickSignal' : 'console.pick'), x + 10, y - 6);
    }
  }
  ctx.restore();
}

export function drawAnomalies(ctx: CanvasRenderingContext2D, s: EvaState, scale: number): void {
  const p = (v: number) => Math.round(v * scale);
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = ANOMALY;
  ctx.fillStyle = ANOMALY;
  for (const a of s.anomalies) {
    ctx.beginPath();
    ctx.arc(p(a.x), p(a.y), a.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    const label = a.kind && a.richness ? `${t(`site.${a.kind}`)} ${'★'.repeat(a.richness)}` : '?';
    ctx.fillText(label, p(a.x) - 6, p(a.y) + 4);
  }
  const zone = s.signal.zone;
  if (zone) {
    ctx.strokeStyle = SIGNAL;
    ctx.fillStyle = SIGNAL;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(p(zone.x), p(zone.y), zone.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(t('console.signalZone'), p(zone.x) - 30, p(zone.y - zone.r) - 4);
  }
  ctx.restore();
}
