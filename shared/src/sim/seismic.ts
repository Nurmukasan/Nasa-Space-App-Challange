import { SEISMIC, SIGNALS } from '../balance';
import { dist, pushFx } from './sim';
import type { System } from './sim';

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
      })),
    });
    pushFx(sim, { type: event.kind === 'impact' ? 'impact' : 'tremor', x: event.x, y: event.y });
  }
  const resolved = sim.pub.seismic.filter((e) => e.truth !== null).slice(-SEISMIC.resolvedKeep);
  sim.pub.seismic = sim.pub.seismic.filter((e) => e.truth === null || resolved.includes(e));
};
