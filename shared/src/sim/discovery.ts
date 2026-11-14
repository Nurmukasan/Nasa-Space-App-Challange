// Hidden sites, orbital anomalies and the helmet scanner (docs/product-logic.md 7.6).
import { DISCOVERY } from '../balance';
import { createRng } from '../rng';
import { SCENARIOS } from '../scenarios';
import { dist, pushFx, pushLog } from './sim';
import type { Sim, System } from './sim';

export function initDiscovery(sim: Sim): void {
  if (sim.params.scenario === 'free') return;
  const rings = SCENARIOS[sim.params.scenario].knownRings;
  const rng = createRng(sim.params.seed ^ 0xa40);
  const sites = sim.pub.sites;
  sim.pub.sites = [];
  for (const site of sites) {
    // generateSites uses richness 1..3 for its three orbital rings.
    site.known = site.kind !== 'signal' && rings.includes(site.richness);
    if (site.known) {
      sim.pub.sites.push(site);
      continue;
    }
    sim.hidden.hiddenSites.push(site);
    if (site.kind === 'signal') continue;
    const angle = rng.range(0, Math.PI * 2);
    const radius = DISCOVERY.anomalyFuzz * Math.sqrt(1 - rng.next());
    sim.pub.anomalies.push({
      id: site.id,
      x: site.x + Math.cos(angle) * radius,
      y: site.y + Math.sin(angle) * radius,
      r: DISCOVERY.anomalyR,
      kind: sim.params.hasGpr ? site.kind : null,
      richness: sim.params.hasGpr ? site.richness : null,
    });
  }
}

export const discoverySystem: System = (sim) => {
  for (const a of sim.pub.astronauts) a.scan = null;
  if (sim.pub.t < 0 || sim.params.scenario === 'free') return;
  const crew = sim.pub.astronauts.filter((a) => a.status === 'active');
  const eligible = () =>
    sim.hidden.hiddenSites.filter((s) => s.kind !== 'signal' || sim.pub.signal.located);
  for (const site of eligible()) {
    const finder = crew.find((a) => dist(a.x, a.y, site.x, site.y) < DISCOVERY.revealDist);
    if (!finder) continue;
    site.known = true;
    sim.pub.sites.push(site);
    sim.hidden.hiddenSites = sim.hidden.hiddenSites.filter((s) => s.id !== site.id);
    sim.pub.anomalies = sim.pub.anomalies.filter((a) => a.id !== site.id);
    sim.hidden.stats.discoveries++;
    sim.hidden.stats.scienceRaw += DISCOVERY.science;
    const stats = sim.hidden.stats.crewStats.find((s) => s.id === finder.id);
    if (stats) {
      stats.discoveries++;
      stats.science += DISCOVERY.science;
    }
    pushFx(sim, { type: 'discovery', x: site.x, y: site.y, playerId: finder.id, s: site.id });
    pushLog(sim, finder.id, 'log.discovery', {
      id: site.id,
      kind: site.kind,
      richness: site.richness,
    });
    if (site.kind === 'signal') {
      sim.pub.signal.found = true;
      pushFx(sim, { type: 'signal_found', x: site.x, y: site.y, playerId: finder.id });
    }
  }
  const remaining = eligible();
  for (const a of crew) {
    let nearest = sim.params.scanRange;
    for (const site of remaining) {
      const distance = dist(a.x, a.y, site.x, site.y);
      if (distance > nearest) continue;
      nearest = distance;
      a.scan = { dist: distance, bearing: Math.atan2(site.y - a.y, site.x - a.x) };
    }
  }
};
