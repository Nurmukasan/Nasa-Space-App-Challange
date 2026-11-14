import { baseFixture } from './base';
export function consoleFixture() {
  const fixture = baseFixture();
  const s = fixture.snap;
  s.hazards = [
    { id: 'demo-fall', kind: 'rockfall', x: 1000, y: 700, r: 150, tHit: s.t + 9, warned: true },
  ];
  s.weather.storm = { tStart: s.t + 35, tEnd: s.t + 125 };
  s.weather.stormForecastAt = s.t - 1;
  s.astronauts.forEach((a, i) => {
    a.x += 70 * (i + 1);
    a.y += 50 * i;
  });
  return fixture;
}
