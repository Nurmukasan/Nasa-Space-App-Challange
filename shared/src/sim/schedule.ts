import { LANDER_POS, SEISMIC } from '../balance';
import { SITES } from '../catalog';
import { createRng } from '../rng';
import { generateSites, nearLedge } from '../terrain';
import type { EventKind, MissionParams } from '../types';
import type { ScheduledEvent } from './sim';

/** Independent RNG stream keeps event timing stable as other systems evolve. */
export function buildSchedule(params: MissionParams, salt: number): ScheduledEvent[] {
  const rng = createRng(params.seed ^ 0x5e15);
  const site = SITES[params.site];
  const samples = generateSites(params);
  const kinds: EventKind[] = ['wind'];
  if (site.quakes) kinds.push('quake');
  const rest: EventKind[] = [];
  for (const [kind, n] of [
    ['wind', site.winds - 1],
    ['quake', site.quakes - 1],
    ['impact', site.impacts],
  ] as const)
    for (let i = 0; i < n; i++) rest.push(kind);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [rest[i], rest[j]] = [rest[j]!, rest[i]!];
  }
  kinds.push(...rest);
  const schedule: ScheduledEvent[] = [];
  let t0 = 0;
  for (const kind of kinds) {
    const i = schedule.length;
    t0 =
      i === 0
        ? rng.range(SEISMIC.firstEventMinS, SEISMIC.firstEventMaxS)
        : i === 1
          ? rng.range(SEISMIC.secondEventMinS, SEISMIC.secondEventMaxS)
          : t0 + rng.range(SEISMIC.minGapS, SEISMIC.maxGapS);
    if (t0 > SEISMIC.lastEventS) break;
    let x = LANDER_POS.x,
      y = LANDER_POS.y;
    for (let attempt = 0; attempt < SEISMIC.epicentreAttempts; attempt++) {
      const angle = rng.range(0, Math.PI * 2);
      if (kind === 'wind') {
        const station = rng.int(0, params.stations - 1);
        const a = -Math.PI / 2 + (station * Math.PI * 2) / 3;
        x = Math.round(LANDER_POS.x + Math.cos(a) * SEISMIC.stationDist);
        y = Math.round(LANDER_POS.y + Math.sin(a) * SEISMIC.stationDist);
        break;
      }
      const r =
        kind === 'quake'
          ? rng.range(SEISMIC.quakeMinDist, SEISMIC.quakeMaxDist)
          : rng.range(SEISMIC.impactMinDist, SEISMIC.impactMaxDist);
      x = LANDER_POS.x + Math.cos(angle) * r;
      y = LANDER_POS.y + Math.sin(angle) * r;
      if (
        kind === 'quake'
          ? nearLedge(x, y, salt, SEISMIC.epicentreLedgeDist)
          : samples.every((s) => Math.hypot(x - s.x, y - s.y) >= SEISMIC.impactSiteClearance)
      )
        break;
    }
    schedule.push({ id: `E${i + 1}`, kind, t0, x, y, fired: false });
  }
  return schedule;
}
