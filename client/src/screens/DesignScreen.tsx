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
import { PixelIcon } from '../ui/PixelIcon';
import { Gauge } from './design/Gauge';
import { ModuleCard } from './design/ModuleCard';
import { FIELD_ICON_SCALE } from './design/constants';
import '../ui/menu.css';
import '../ui/design.css';
const fields: { field: DesignField; options: string[]; step: number }[] = [
  { field: 'objective', options: Object.keys(OBJECTIVES), step: 0 },
  { field: 'site', options: Object.keys(SITES), step: 0 },
  { field: 'difficulty', options: Object.keys(DIFFICULTIES), step: 0 },
  { field: 'vehicle', options: Object.keys(VEHICLES), step: 1 },
  { field: 'relay', options: Object.keys(RELAYS), step: 3 },
];
const disciplines = ['planning', 'spacecraft', 'science', 'comms'];
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
    {
      key: 'budget',
      value: `${totals.cost} / ${totals.budget}`,
      ratio: totals.cost / totals.budget,
      bad: totals.cost > totals.budget,
    },
    {
      key: 'mass',
      value: `${totals.massKg} / ${totals.massCapKg} kg`,
      ratio: totals.massKg / totals.massCapKg,
      bad: totals.massKg > totals.massCapKg,
    },
    {
      key: 'power',
      value: `${totals.powerUseW} / ${totals.powerGenW} W`,
      ratio:
        totals.powerGenW > 0 ? totals.powerUseW / totals.powerGenW : totals.powerUseW > 0 ? 2 : 0,
      bad: totals.powerUseW > totals.powerGenW,
    },
    {
      key: 'data',
      value: `${totals.dataGen} / ${totals.dataCap} Mb/sol`,
      ratio: totals.dataCap > 0 ? totals.dataGen / totals.dataCap : totals.dataGen > 0 ? 2 : 0,
      bad: totals.dataGen > totals.dataCap,
    },
    { key: 'comms', value: `${prediction.commsRangeM} m`, ratio: undefined, bad: false },
    {
      key: 'time',
      value: t('design.window', { duration: MISSION_DURATION_S / 60, sunset: POWER.duskEndS / 60 }),
      ratio: undefined,
      bad: false,
    },
  ];
  return (
    <main className="screen design-screen">
      <h1>{t('design.title')}</h1>
      <nav className="stepper" aria-label={t('design.steps')}>
        {steps.map((key, i) => (
          <button key={key} className={step === i ? 'on' : ''} onClick={() => setStep(i)}>
            <span className="step-num">{i + 1}</span>
            {t(`design.step.${key}`)}
          </button>
        ))}
      </nav>
      <section className="design-indicators">
        {indicators.map((item) => (
          <Gauge
            key={item.key}
            label={t(`design.${item.key}`)}
            value={item.value}
            ratio={item.ratio}
            bad={item.bad}
          />
        ))}
      </section>
      <section className="fields">
        {fields
          .filter((f) => f.step === step || step === 4)
          .map(({ field, options }) => (
            <label key={field} className="panel field">
              {(field === 'vehicle' || field === 'relay') && (
                <PixelIcon name={`icon_${field}_${design[field]}`} scale={FIELD_ICON_SCALE} />
              )}
              <span className="field-body">
                <span className="field-label">{t(`design.field.${field}`)}</span>
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
                <span className="field-desc">{t(`${field}.${design[field]}.desc`)}</span>
              </span>
            </label>
          ))}
      </section>
      {(step === 2 || step === 3 || step === 4) && (
        <section className="module-grid">
          {MODULE_ORDER.filter(
            (id) =>
              step === 4 ||
              (step === 3 ? MODULES[id].group === 'comms' : MODULES[id].group !== 'comms'),
          ).map((id) => (
            <ModuleCard
              key={id}
              module={MODULES[id]}
              on={design.modules.includes(id)}
              onToggle={() => send({ t: 'design:module', id, on: !design.modules.includes(id) })}
            />
          ))}
        </section>
      )}
      <div className="panel bays">
        {t('design.bays')}
        <span className="bay-pips">
          {Array.from({ length: Math.max(totals.baysMax, totals.baysUsed) }, (_, i) => (
            <span
              key={i}
              className={`bay-pip ${i >= totals.baysMax ? 'over' : i < totals.baysUsed ? 'used' : ''}`}
            />
          ))}
        </span>
        {totals.baysUsed} / {totals.baysMax}
      </div>
      <section className="panel issues">
        <h2 className="panel-title">{t('design.review')}</h2>
        {check.issues.length === 0 && <div className="all-clear">{t('design.allClear')}</div>}
        {(['error', 'warning'] as const).map((severity) =>
          check.issues
            .filter((i) => i.severity === severity)
            .map((issue) => (
              <p key={issue.code} className={severity === 'error' ? 'err' : 'warn'}>
                {t(`issue.${issue.code}`, issue.params)}
              </p>
            )),
        )}
      </section>
      <section className="panel">
        <h2 className="panel-title">{t('design.forecast')}</h2>
        <div className="forecast">
          {Object.entries(prediction).map(([key, value]) => (
            <div className="forecast-item" key={key}>
              <span>{t(`prediction.${key}`)}</span>
              <output>
                {Math.round(value * 10) / 10}
                {t(`unit.${key}`)}
              </output>
            </div>
          ))}
        </div>
      </section>
      <section className="panel row">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <button key={id} onClick={() => send({ t: 'design:preset', id })}>
            {t(`preset.${id}`)}
          </button>
        ))}
      </section>
      <section className="panel">
        <h2 className="panel-title">{t('design.crew')}</h2>
        {room.players.map((p, i) => (
          <div key={p.id} className="crew-row">
            <span className="grow">
              {p.name} ·{' '}
              <span className="dim">
                {disciplines
                  .filter((_, index) => index % room.players.length === i)
                  .map((key) => t(`design.discipline.${key}`))
                  .join(' / ')}
              </span>
            </span>
            <span className={`tag ${p.ready ? 'ok' : ''}`}>
              {t(p.ready ? 'design.ready' : 'design.notReady')}
            </span>
            {p.id === self.id && (
              <button onClick={() => send({ t: 'lobby:ready', ready: !p.ready })}>
                {t('design.toggleReady')}
              </button>
            )}
          </div>
        ))}
      </section>
      {self.isHost && (
        <button
          className="btn-launch"
          disabled={!check.ok}
          onClick={() => send({ t: 'design:launch' })}
        >
          {t('design.launch')}
        </button>
      )}
    </main>
  );
}
