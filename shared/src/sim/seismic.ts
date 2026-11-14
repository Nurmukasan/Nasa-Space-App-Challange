import { SAMPLE, SEISMIC, SIGNALS } from '../balance';
import { createRng, hashString } from '../rng';
import type { EventKind, SeismicEvent } from '../types';
import { dist, pushFx } from './sim';
import type { Sim, System } from './sim';

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
        // Filled by the locate system (task A3).
        distEst: 0,
        bearingEst: null,
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
  }
  const resolved = sim.pub.seismic.filter((e) => e.truth !== null).slice(-SEISMIC.resolvedKeep);
  sim.pub.seismic = sim.pub.seismic.filter((e) => e.truth === null || resolved.includes(e));
};

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
    const r =
      truth === 'impact'
        ? 0
        : sim.params.stations === 3
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
      sim.pub.hazards.push(publicHazard);
      for (const a of sim.pub.astronauts)
        if (a.linked && dist(a.x, a.y, hazard.x, hazard.y) <= hazard.r)
          a.dangerUntil = Math.max(a.dangerUntil, hazard.tHit + SEISMIC.warningTailS);
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
