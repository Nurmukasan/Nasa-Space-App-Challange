import { COMMS, METERS_PER_PX, RELAYS, SCENARIOS } from '@rs/shared';
import type { DesignCheck, ScenarioId } from '@rs/shared';
import { t } from '../../i18n';
import { Gauge } from './Gauge';
const clock = (time: number) =>
  `${Math.floor(time / 60)}:${String(Math.round(time % 60)).padStart(2, '0')}`;
export function ResourceGauges({ check, scenario }: { check: DesignCheck; scenario: ScenarioId }) {
  const totals = check.totals;
  const mission = SCENARIOS[scenario];
  const maxRange =
    COMMS.highGain * Math.max(...Object.values(RELAYS).map((r) => r.rangeMul)) * METERS_PER_PX;
  const values = [
    {
      key: 'budget',
      used: totals.cost,
      max: totals.budget,
      value: `$${totals.cost} / $${totals.budget}`,
      codes: ['over_budget'],
    },
    {
      key: 'mass',
      used: totals.massKg,
      max: totals.massCapKg,
      value: `${totals.massKg} / ${totals.massCapKg} kg`,
      codes: ['over_mass', 'over_bays'],
    },
    {
      key: 'power',
      used: totals.powerUseW,
      max: totals.powerGenW,
      value: `${totals.powerUseW} / ${totals.powerGenW} W`,
      codes: ['no_power', 'power_deficit', 'night_power'],
    },
    {
      key: 'data',
      used: totals.dataGen,
      max: totals.dataCap,
      value: `${totals.dataGen} / ${totals.dataCap} Mb/sol`,
      codes: ['data_bottleneck'],
    },
    {
      key: 'comms',
      used: check.prediction.commsRangeM,
      max: maxRange,
      value: `${Math.round(check.prediction.commsRangeM)} m`,
      codes: ['vehicle_orbit'],
    },
    {
      key: 'time',
      used: mission.durationS,
      max: SCENARIOS.free.durationS,
      value: clock(mission.durationS),
      codes: [],
    },
  ];
  return (
    <section className="design-indicators" aria-label={t('design.resources')}>
      {values.map((g) => {
        const issue = check.issues.find((i) => g.codes.includes(i.code));
        const overloaded = g.key !== 'comms' && g.key !== 'time' && g.used > g.max;
        const fraction = Math.min(100, g.max > 0 ? (g.used / g.max) * 100 : g.used > 0 ? 100 : 0);
        return (
          <Gauge
            key={g.key}
            resource={g.key}
            label={t(`design.${g.key}`)}
            value={g.value}
            ratio={fraction / 100}
            bad={overloaded}
            warnWhenFull={g.key !== 'comms' && g.key !== 'time'}
            description={
              issue
                ? t(`issue.${issue.code}`, issue.params)
                : g.key === 'time'
                  ? t('design.why.time', { time: clock(mission.duskEndS) })
                  : t(`design.why.${g.key}`)
            }
          />
        );
      })}
    </section>
  );
}
