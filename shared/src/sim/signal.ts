// RED SIGNAL: hidden source, pulses and the search zone (docs/product-logic.md 7.12).
// Compute -> find -> retrieve. Picks narrow the zone; once it is small enough the field
// beacon appears and the scanner can find the source; the delivered sample reveals it.
import { LANDER_POS, SEISMIC, SIGNAL } from '../balance';
import { createRng } from '../rng';
import { clampToWorld, generateSites, nearLedge } from '../terrain';
import { roverBlockedAt } from '../world';
import type { SeismicEvent } from '../types';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

/** Salt of the source placement stream (docs/architecture.md 6.3). */
const SALT = 0x516;
export const SIGNAL_SITE_ID = 'SIG';

/** Place the hidden source and its site (signal scenario only). */
export function initSignal(sim: Sim): void {
  if (sim.params.scenario !== 'signal') return;
  const rng = createRng((sim.params.seed ^ SALT) >>> 0);
  const sites = generateSites(sim.params);
  let x = LANDER_POS.x,
    y = LANDER_POS.y;
  for (let attempt = 0; attempt < SEISMIC.epicentreAttempts * 2; attempt++) {
    const angle = rng.range(0, Math.PI * 2);
    const r = rng.range(SIGNAL.sourceMinDist, SIGNAL.sourceMaxDist);
    x = Math.round(clampToWorld(LANDER_POS.x + Math.cos(angle) * r));
    y = Math.round(clampToWorld(LANDER_POS.y + Math.sin(angle) * r));
    const clear =
      sites.every((s) => dist(x, y, s.x, s.y) >= SEISMIC.impactSiteClearance) &&
      sim.pub.caches.every((c) => dist(x, y, c.x, c.y) >= SEISMIC.impactSiteClearance) &&
      !roverBlockedAt(x, y, sim.salt);
    if (clear && nearLedge(x, y, sim.salt, SEISMIC.epicentreLedgeDist)) break;
  }
  sim.hidden.signalSource = { x, y };
  sim.hidden.hiddenSites.push({
    id: SIGNAL_SITE_ID,
    x,
    y,
    kind: 'signal',
    richness: 3,
    depth: 0,
    taken: [],
    expiresAt: null,
    known: false,
  });
}

/** Called by the director every tick of the signal scenario: schedules the next pulse. */
export function signalTrack(sim: Sim): void {
  const src = sim.hidden.signalSource;
  const d = sim.hidden.director;
  if (!src || sim.pub.signal.located || sim.pub.t > SIGNAL.lastS) return;
  if (d.nextPulseAt === 0) d.nextPulseAt = SIGNAL.firstS;
  if (sim.pub.t < d.nextPulseAt) return;
  emitPulse(sim, sim.pub.t);
  const rng = createRng(
    (sim.params.seed ^ SALT ^ Math.imul(sim.pub.signal.pulses, 0x9e3779b1)) >>> 0,
  );
  d.nextPulseAt = sim.pub.t + rng.range(SIGNAL.gapMinS, SIGNAL.gapMaxS);
}

/** Queue one pulse at the source (also used by the event_signal debug command). */
export function emitPulse(sim: Sim, t0: number): void {
  const src = sim.hidden.signalSource;
  if (!src) return;
  sim.pub.signal.pulses++;
  sim.hidden.schedule.push({
    id: `P${sim.pub.signal.pulses}`,
    kind: 'quake',
    t0,
    x: src.x,
    y: src.y,
    fired: false,
    signal: true,
  });
}

/** Astronauts feel each pulse: strong near the source, weak farther, nothing beyond. */
export function onSignalFired(sim: Sim, x: number, y: number): void {
  for (const a of sim.pub.astronauts) {
    if (a.status !== 'active') continue;
    const d = dist(a.x, a.y, x, y);
    const n = d <= SIGNAL.feelNear ? 2 : d <= SIGNAL.feelFar ? 1 : 0;
    if (n > 0) pushFx(sim, { type: 'signal_pulse', playerId: a.id, n });
  }
}

/** A pulse's window closed: narrow the zone from the pick (or the computer's estimate). */
export function onSignalResolved(sim: Sim, event: SeismicEvent): void {
  const src = sim.hidden.signalSource;
  const state = sim.pub.signal;
  if (!src || state.located) return;
  let candidate: { x: number; y: number; r: number };
  if (event.pick) {
    const err = dist(event.pick.x, event.pick.y, src.x, src.y);
    candidate = { ...event.pick, r: err * SIGNAL.zoneErrMul + SIGNAL.zoneSlack };
  } else {
    const r = sim.pub.stations.length >= 3 ? SIGNAL.autoR3 : SIGNAL.autoR1;
    const rng = createRng((sim.params.seed ^ SALT ^ Math.imul(state.pulses + 7, 0x85ebca6b)) >>> 0);
    const angle = rng.range(0, Math.PI * 2),
      offset = rng.range(0, r * 0.6);
    // The source always stays inside the candidate circle.
    candidate = { x: src.x + Math.cos(angle) * offset, y: src.y + Math.sin(angle) * offset, r };
  }
  const first = !state.zone;
  if (!state.zone || candidate.r < state.zone.r) state.zone = candidate;
  // Big world: the network around the lander hears a far source poorly; say how to fix it.
  if (first && sim.params.bigWorld && state.zone.r > SIGNAL.locatedR)
    pushLog(sim, 'tulpar', 'story.signal.kit');
  // One lucky pick is not a fix: the source needs several pulses (PL 7.12, balance soak).
  if (state.zone.r <= SIGNAL.locatedR && state.pulses >= SIGNAL.minPulses) {
    state.located = true;
    pushFx(sim, { type: 'signal_located', x: state.zone.x, y: state.zone.y });
    pushLog(sim, 'earth', 'story.signal.located');
  }
}

/** Detect the delivered signal sample. */
export const signalSystem: System = (sim) => {
  const state = sim.pub.signal;
  if (!sim.hidden.signalSource || state.retrieved) return;
  if (!sim.pub.lander.cache.some((s) => s.kind === 'signal')) return;
  state.retrieved = true;
  sim.hidden.stats.signalRetrieved = true;
  pushLog(sim, 'earth', 'story.signal.retrieved');
};

/** Report reveal key (docs/product-logic.md 8.5). */
export function revealKey(sim: Sim): string | null {
  if (sim.pub.signal.retrieved) return `reveal.${sim.params.site}`;
  return sim.pub.signal.located ? 'reveal.partial' : null;
}
