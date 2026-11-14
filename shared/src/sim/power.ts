import { POWER } from '../balance';
import type { System } from './sim';

function eff(powerW: number, needW: number): number {
  if (needW <= 0) return 1;
  const e = powerW / needW;
  return e < 0 ? 0 : e > 1 ? 1 : e;
}

/** Available power -> per-subsystem efficiency according to the operator's allocation. */
export const powerSystem: System = (sim) => {
  const p = sim.params;
  const power = sim.pub.lander.power;
  let solar = sim.pub.weather.solarFactor;
  if (p.hasBattery) solar = Math.max(solar, POWER.batteryFloor);
  const net = Math.max(0, p.rtgW + p.solarPeakW * solar - p.baseLoadW);
  power.availW = Math.round(net);
  power.eff.moxie = eff(net * power.alloc.moxie, p.moxieNeedW);
  power.eff.comms = eff(net * power.alloc.comms, p.commsNeedW);
  power.eff.scan = eff(net * power.alloc.scan, p.scanNeedW);
};
