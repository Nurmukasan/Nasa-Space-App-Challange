import {
  CACHES,
  DIG,
  FAULTS,
  O2,
  RETURN,
  ROVER,
  SAMPLE,
  SITES,
  STATIONS,
  sandAt,
} from '@rs/shared';
import type { Astronaut, EvaState } from '@rs/shared';

export function hudBanner(s: EvaState, a: Astronaut, needed: number) {
  const banner = (key: string, critical = false, params?: Record<string, string | number>) => ({
    key,
    critical,
    params,
  });
  if (s.t < 0) return banner('eva.countdown', false, { n: Math.ceil(-s.t) });
  if (a.status === 'down')
    return banner('eva.down', true, { time: Math.max(0, Math.ceil(a.downUntil - s.t)) });
  if (a.status === 'lost') return banner('eva.lost', true);
  if (a.status === 'inside') return banner('eva.inside');
  if (a.o2 < needed + RETURN.warningUnits) return banner('eva.return_now', true);
  if (a.linked && s.t < a.dangerUntil) return banner('eva.danger', true);
  if (s.flare && s.t < s.flare.tEnd)
    return banner(s.t >= s.flare.tStart ? 'eva.flare_active' : 'eva.flare_warn', true, {
      n: Math.max(0, Math.ceil(s.flare.tStart - s.t)),
    });
  if (s.weather.storm && s.t >= s.weather.storm.tStart && s.t < s.weather.storm.tEnd)
    return banner('eva.storm', true);
  if (s.fx.some((f) => f.type === 'tremor' && s.t - f.t < 2)) return banner('eva.tremor', true);
  if (s.lander.faults.length) return banner('eva.fault');
  if (a.wantsRefill)
    return banner(s.lander.ration && !a.refillGranted ? 'eva.ration' : 'eva.refill');
  if (s.weather.storm && s.t < s.weather.storm.tStart)
    return banner('eva.forecast', false, { n: Math.ceil(s.weather.storm.tStart - s.t) });
  return null;
}

export function actionHint(
  s: EvaState,
  a: Astronaut,
  salt = SITES.jezero.terrainSalt,
): { key: string; params?: Record<string, string | number> } {
  const distance = (x: number, y: number) => Math.hypot(a.x - x, a.y - y);
  if (a.status === 'inside') return { key: 'eva.exit' };
  if (a.status !== 'active') return { key: 'eva.cleared' };
  // Same order as the E key on the server (docs/product-logic.md 7.4).
  if (a.inRover)
    return { key: 'eva.rover_exit', params: { n: Math.round((s.rover?.charge ?? 0) * 100) } };
  if (
    s.astronauts.some(
      (b) =>
        b.id !== a.id &&
        b.status === 'down' &&
        s.t < b.downUntil &&
        distance(b.x, b.y) <= O2.shareRange &&
        a.o2 > O2.shareAmount + O2.shareReserve,
    )
  )
    return { key: 'eva.rescue' };
  if (distance(s.lander.x, s.lander.y) <= O2.airlockRadius) return { key: 'eva.airlock' };
  const rover = s.rover;
  if (rover && rover.driver === null && distance(rover.x, rover.y) <= ROVER.boardDist)
    return { key: 'eva.rover_board', params: { n: Math.round(rover.charge * 100) } };
  const ports = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] } as const;
  const fault = s.lander.faults.find((f) => {
    const [x, y] = ports[f.port];
    return (
      distance(s.lander.x + x * FAULTS.portDist, s.lander.y + y * FAULTS.portDist) <=
      FAULTS.portRadius
    );
  });
  if (fault)
    return {
      key: a.repairing === fault.id ? 'eva.repairing' : 'eva.repair',
      params: { fault: fault.kind, n: Math.round(fault.progress * 100) },
    };
  if (
    s.sites.some(
      (site) =>
        distance(site.x, site.y) <= DIG.reach && (site.expiresAt === null || site.expiresAt > s.t),
    )
  )
    return { key: a.carrying.length >= SAMPLE.carryCap ? 'eva.inventory_full' : 'eva.dig' };
  const cache = s.caches.find((c) => c.o2 > 0 && distance(c.x, c.y) <= CACHES.useDist);
  if (cache && a.o2 < a.o2Max - 0.5)
    return { key: 'eva.cache', params: { n: Math.round(cache.o2) } };
  if (a.kits > 0) {
    if (distance(s.lander.x, s.lander.y) < STATIONS.minFromLander)
      return { key: 'eva.deploy_lander' };
    if (s.stations.some((st) => distance(st.x, st.y) < STATIONS.minBetween))
      return { key: 'eva.deploy_station' };
    if (sandAt(a.x, a.y, salt)) return { key: 'eva.deploy_sand' };
    return { key: 'eva.deploy' };
  }
  return { key: 'eva.explore' };
}
