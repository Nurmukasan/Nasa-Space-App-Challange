import { LOCATE, SAMPLE, SEISMIC, SIGNALS } from '../balance';
import { createRng, hashString } from '../rng';
import type { EventKind, SeismicEvent, Vec2 } from '../types';
import { dist, pushFx } from './sim';
import type { Sim, System } from './sim';

/** v2 rules (pick-centred warnings) apply outside the classic free mission. */
function v2(sim: Sim): boolean {
  return sim.params.scenario !== 'free';
}

/**
 * Noisy S–P distance per station and, for station 0, a back-azimuth (docs/product-logic.md 7.11).
 * Error grows when the instruments lack power. Own RNG stream per event and station.
 */
function rangeEstimates(sim: Sim, id: string, x: number, y: number, stationIdx: number) {
  const s = sim.pub.stations[stationIdx]!;
  const rng = createRng(
    (sim.params.seed ^ hashString(id) ^ Math.imul(stationIdx + 1, 0x85ebca6b)) >>> 0,
  );
  const err = LOCATE.distErr * (1 + (1 - sim.pub.lander.power.eff.scan) * SEISMIC.noisePenalty);
  const distEst = dist(s.x, s.y, x, y) * (1 + rng.range(-err, err));
  const bearingEst =
    stationIdx === 0
      ? Math.atan2(y - s.y, x - s.x) + rng.range(-LOCATE.bearingErr, LOCATE.bearingErr)
      : null;
  return { distEst, bearingEst };
}

/** Only station measurements cross the network; scheduled truth stays server-side. */
export const seismicSystem: System = (sim) => {
  const t = sim.pub.t;
  for (const event of sim.hidden.schedule) {
    if (event.kind === 'impact' && !event.fireballShown && t >= event.t0 - SEISMIC.fireballLeadS) {
      event.fireballShown = true;
      pushFx(sim, { type: 'fireball', x: event.x, y: event.y });
    }
    if (event.fired || t < event.t0) continue;
    event.fired = true;
    const signature = SIGNALS[event.kind];
    const distances = sim.pub.stations.map((s) => dist(s.x, s.y, event.x, event.y));
    const nearest = distances.indexOf(Math.min(...distances));
    sim.pub.seismic.push({
      id: event.id,
      t0: event.t0,
      deadline: event.t0 + sim.params.classifyWindowS,
      guess: null,
      truth: null,
      estimate: null,
      signal: false,
      pick: null,
      signals: distances.map((d, stationIdx) => ({
        ...signature,
        stationIdx,
        delayS: d / SEISMIC.waveSpeed,
        amp:
          event.kind === 'wind' && stationIdx !== nearest
            ? 0
            : Math.max(SEISMIC.minAmp, 1 - d / SEISMIC.ampFalloff),
        noise: signature.noise * (1 + (1 - sim.pub.lander.power.eff.scan) * SEISMIC.noisePenalty),
        pressureDip:
          event.kind === 'wind' && stationIdx === nearest && sim.params.hasWeather
            ? signature.pressureDip
            : 0,
        ...rangeEstimates(sim, event.id, event.x, event.y, stationIdx),
      })),
    });
    if (event.kind === 'quake')
      sim.hidden.pendingRockfalls.push({
        id: event.id,
        kind: 'rockfall',
        x: event.x,
        y: event.y,
        r: SEISMIC.rockfallRadius,
        tHit: event.t0 + SEISMIC.rockfallDelayS,
        warned: false,
        hit: false,
      });
    if (event.kind === 'impact')
      sim.pub.sites.push({
        id: event.id,
        kind: 'impact',
        x: event.x,
        y: event.y,
        richness: 3,
        depth: 0,
        taken: [],
        expiresAt: event.t0 + SAMPLE.iceLifetimeS,
        known: false,
      });
    pushFx(sim, { type: event.kind === 'impact' ? 'impact' : 'tremor', x: event.x, y: event.y });
  }
  for (const event of sim.pub.seismic) {
    if (event.truth === null && t >= event.deadline) resolveEvent(sim, event, null);
    if (t >= event.deadline) scorePick(sim, event);
  }
  const resolved = sim.pub.seismic.filter((e) => e.truth !== null).slice(-SEISMIC.resolvedKeep);
  sim.pub.seismic = sim.pub.seismic.filter((e) => e.truth === null || resolved.includes(e));
};

/** Warn linked astronauts inside the public warning zone of `id` until the rockfall passes. */
function warnZone(sim: Sim, id: string): void {
  const zone = sim.pub.hazards.find((h) => h.id === id);
  if (!zone) return;
  for (const a of sim.pub.astronauts)
    if (a.linked && dist(a.x, a.y, zone.x, zone.y) <= zone.r)
      a.dangerUntil = Math.max(a.dangerUntil, zone.tHit + SEISMIC.warningTailS);
}

/**
 * mc:locate. Last pick wins until the deadline. In v2 a pick after a correct QUAKE call
 * moves the warning zone. Returns false when the pick is not accepted.
 */
export function placePick(sim: Sim, eventId: string, x: number, y: number): boolean {
  const event = sim.pub.seismic.find((e) => e.id === eventId);
  if (!event || sim.pub.t >= event.deadline) return false;
  event.pick = { x, y };
  const zone = sim.pub.hazards.find((h) => h.id === eventId);
  if (zone && v2(sim) && zone.tHit > sim.pub.t) {
    zone.x = x;
    zone.y = y;
    warnZone(sim, eventId);
  }
  return true;
}

/** Score a quake or RED SIGNAL pick once, after the deadline (truth is known server-side). */
function scorePick(sim: Sim, event: SeismicEvent): void {
  const scheduled = sim.hidden.schedule.find((e) => e.id === event.id);
  if (!scheduled || scheduled.pickScored || !event.pick) return;
  scheduled.pickScored = true;
  if (scheduled.kind !== 'quake' && !event.signal) return;
  const err = dist(event.pick.x, event.pick.y, scheduled.x, scheduled.y);
  const stats = sim.hidden.stats;
  stats.locatePicks++;
  stats.locateErrorSum += err;
  if (err <= LOCATE.goodPx) stats.locateGood++;
}

/** Resolve exactly once, using the private schedule as the authority. */
export function resolveEvent(sim: Sim, event: SeismicEvent, guess: EventKind | null): void {
  if (event.truth !== null) return;
  const scheduled = sim.hidden.schedule.find((e) => e.id === event.id);
  if (!scheduled) return;
  const truth = scheduled.kind;
  event.truth = truth;
  event.guess = guess;
  const stats = sim.hidden.stats;
  const correct = guess === truth;
  if (correct) stats.classifyCorrect++;
  else if (guess === null) stats.classifyMissed++;
  else stats.classifyWrong++;
  pushFx(sim, { type: correct ? 'classify_ok' : 'classify_bad', s: event.id });
  if (correct && truth !== 'wind') {
    // Accuracy follows the stations actually listening (deployed kits count in v2).
    const r =
      truth === 'impact'
        ? 0
        : sim.pub.stations.length >= 3
          ? SEISMIC.uncertainty3
          : SEISMIC.uncertainty1;
    const rng = createRng(sim.params.seed ^ hashString(event.id));
    const angle = rng.range(0, Math.PI * 2),
      offset = rng.range(0, r);
    event.estimate = {
      x: scheduled.x + Math.cos(angle) * offset,
      y: scheduled.y + Math.sin(angle) * offset,
      r,
    };
  }
  if (correct && truth === 'quake') {
    const hazard = sim.hidden.pendingRockfalls.find((h) => h.id === event.id);
    if (hazard) {
      hazard.warned = true;
      const { hit: _, ...publicHazard } = hazard;
      if (v2(sim)) {
        // The warning zone sits where Mission Control (or the computer) thinks the epicentre is.
        const c: Vec2 = event.pick ?? event.estimate ?? hazard;
        sim.pub.hazards.push({ ...publicHazard, x: c.x, y: c.y, r: LOCATE.warnRadius });
      } else sim.pub.hazards.push(publicHazard);
      warnZone(sim, event.id);
    }
  }
  if (correct && truth === 'impact') {
    const site = sim.pub.sites.find((s) => s.id === event.id);
    if (site) site.known = true;
  }
  if (truth === 'wind' && guess === 'quake') {
    stats.falseAlarms++;
    for (const a of sim.pub.astronauts)
      if (a.linked) a.dangerUntil = Math.max(a.dangerUntil, sim.pub.t + SEISMIC.dangerShowS);
  }
}
