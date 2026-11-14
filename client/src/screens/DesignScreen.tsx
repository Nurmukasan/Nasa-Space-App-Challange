import { useState } from 'react';
import {
  DIFFICULTIES,
  MODULES,
  MODULE_ORDER,
  OBJECTIVES,
  RELAYS,
  SITES,
  VEHICLES,
  PRESETS,
  MISSION_DURATION_S,
  POWER,
} from '@rs/shared';
import type { DesignField, PresetId } from '@rs/shared';
import { send } from '../net/session';
import { me, useApp } from '../state/store';
import { t } from '../i18n';
import '../ui/design.css';
const fields: { field: DesignField; options: string[]; step: number }[] = [
  { field: 'objective', options: Object.keys(OBJECTIVES), step: 0 },
  { field: 'site', options: Object.keys(SITES), step: 0 },
  { field: 'difficulty', options: Object.keys(DIFFICULTIES), step: 0 },
  { field: 'vehicle', options: Object.keys(VEHICLES), step: 1 },
  { field: 'relay', options: Object.keys(RELAYS), step: 3 },
];
const steps = ['goal', 'launch', 'spacecraft', 'comms', 'review'];
export function DesignScreen() {
  const room = useApp((s) => s.room),
    self = useApp(me);
  const [step, setStep] = useState(0);
  if (!room || !self) return null;
  const { design, check } = room;
  const totals = check.totals;
  const prediction = check.prediction;
  const indicators = [
    { key: 'budget', value: `${totals.cost} / ${totals.budget}`, bad: totals.cost > totals.budget },
    {
      key: 'mass',
      value: `${totals.massKg} / ${totals.massCapKg} kg`,
      bad: totals.massKg > totals.massCapKg,
    },
    {
      key: 'power',
      value: `${totals.powerUseW} / ${totals.powerGenW} W`,
      bad: totals.powerUseW > totals.powerGenW,
    },
    {
      key: 'data',
      value: `${totals.dataGen} / ${totals.dataCap} Mb/sol`,
      bad: totals.dataGen > totals.dataCap,
    },
    { key: 'comms', value: `${prediction.commsRangeM} m`, bad: false },
    {
      key: 'time',
      value: t('design.window', { duration: MISSION_DURATION_S / 60, sunset: POWER.duskEndS / 60 }),
      bad: false,
    },
  ];
  return (
    <main className="screen design-screen">
      <h1>{t('design.title')}</h1>
      <nav className="row" aria-label={t('design.steps')}>
        {steps.map((key, i) => (
          <button key={key} className={step === i ? 'on' : ''} onClick={() => setStep(i)}>
            {i + 1}. {t(`design.step.${key}`)}
          </button>
        ))}
      </nav>
      <section className="design-indicators">
        {indicators.map((item) => (
          <div key={item.key} className={`panel ${item.bad ? 'err' : ''}`}>
            <h2>{t(`design.${item.key}`)}</h2>
            <output>{item.value}</output>
          </div>
        ))}
      </section>
      <section className="panel row">
        {fields
          .filter((f) => f.step === step || step === 4)
          .map(({ field, options }) => (
            <label key={field}>
              {t(`design.field.${field}`)}
              <select
                value={design[field]}
                onChange={(e) => send({ t: 'design:set', field, value: e.target.value })}
              >
                {options.map((id) => (
                  <option key={id} value={id}>
                    {t(`${field}.${id}.name`)}
                  </option>
                ))}
              </select>
            </label>
          ))}
      </section>
      {(step === 2 || step === 3 || step === 4) && (
        <section className="panel row">
          {MODULE_ORDER.filter(
            (id) =>
              step === 4 ||
              (step === 3 ? MODULES[id].group === 'comms' : MODULES[id].group !== 'comms'),
          ).map((id) => {
            const m = MODULES[id];
            return (
              <button
                key={id}
                aria-pressed={design.modules.includes(id)}
                className={design.modules.includes(id) ? 'on' : ''}
                onClick={() => send({ t: 'design:module', id, on: !design.modules.includes(id) })}
              >
                <b>{t(`module.${id}.name`)}</b>
                <small>{t(`module.${id}.desc`)}</small>
                <span>
                  ${m.cost} · {m.massKg} kg · {m.powerW} W
                </span>
              </button>
            );
          })}
        </section>
      )}
      <div className="panel">
        {t('design.bays')} {totals.baysUsed} / {totals.baysMax}
      </div>
      <section className="panel">
        {(['error', 'warning'] as const).map((severity) => (
          <div key={severity}>
            <h2>{t(`design.${severity}`)}</h2>
            {check.issues
              .filter((i) => i.severity === severity)
              .map((issue) => (
                <p key={issue.code} className={severity === 'error' ? 'err' : 'warn'}>
                  {t(`issue.${issue.code}`, issue.params)}
                </p>
              ))}
          </div>
        ))}
      </section>
      <section className="design-indicators">
        {Object.entries(prediction).map(([key, value]) => (
          <div className="panel" key={key}>
            <h2>{t(`prediction.${key}`)}</h2>
            <output>
              {Math.round(value * 10) / 10}
              {t(`unit.${key}`)}
            </output>
          </div>
        ))}
      </section>
      <section className="panel row">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <button key={id} onClick={() => send({ t: 'design:preset', id })}>
            {t(`preset.${id}`)}
          </button>
        ))}
      </section>
      <section className="panel">
        {room.players.map((p, i) => (
          <div key={p.id}>
            {p.name} · {t(`design.owner.${i}`)} · {t(p.ready ? 'design.ready' : 'design.notReady')}
            {p.id === self.id && (
              <button onClick={() => send({ t: 'lobby:ready', ready: !p.ready })}>
                {t('design.toggleReady')}
              </button>
            )}
          </div>
        ))}
      </section>
      {self.isHost && (
        <button disabled={!check.ok} onClick={() => send({ t: 'design:launch' })}>
          {t('design.launch')}
        </button>
      )}
    </main>
  );
}
