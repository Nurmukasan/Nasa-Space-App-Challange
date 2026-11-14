import { useEffect, useState } from 'react';
import {
  DIFFICULTIES,
  MODULES,
  MODULE_ORDER,
  OBJECTIVES,
  RELAYS,
  SITES,
  VEHICLES,
  PRESETS,
} from '@rs/shared';
import type { DesignField, PresetId } from '@rs/shared';
import { send } from '../net/session';
import { me, useApp } from '../state/store';
import { t } from '../i18n';
import { designHint, useDesignHint } from '../state/designHint';
import { ResourceGauges } from './design/ResourceGauges';
import { ChoiceCards } from './design/ChoiceCards';
import { ForecastChart } from './design/ForecastChart';
import { LanderCutaway } from './design/LanderCutaway';
import { ModuleCard } from './design/ModuleCard';
import '../ui/menu.css';
import '../ui/design.css';
import '../ui/designV2.css';
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
  const fix = useDesignHint();
  const [step, setStep] = useState(() =>
    fix?.module ? 2 : (fields.find((f) => f.field === fix?.field)?.step ?? 0),
  );
  useEffect(
    () => () => {
      designHint.setState({ fix: null });
    },
    [],
  );
  if (!room || !self) return null;
  const { design, check } = room;
  const totals = check.totals;
  const prediction = check.prediction;
  return (
    <main className="screen design-screen">
      <h1>{t('design.title')}</h1>
      {room.scenario === 'training' && <p className="dim">{t('design.training_fixed')}</p>}
      <nav className="stepper" aria-label={t('design.steps')}>
        {steps.map((key, i) => (
          <button key={key} className={step === i ? 'on' : ''} onClick={() => setStep(i)}>
            <span className="step-num">{i + 1}</span>
            {t(`design.step.${key}`)}
          </button>
        ))}
      </nav>
      <ResourceGauges check={check} scenario={room.scenario} />
      <LanderCutaway design={design} mass={totals.massKg} />
      <section className="fields">
        {fields
          .filter((f) => f.step === step || step === 4)
          .map(({ field, options }) => (
            <ChoiceCards
              key={field}
              field={field}
              options={options}
              selected={design[field]}
              suggested={fix?.field === field ? fix.value : undefined}
            />
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
              suggested={id === fix?.module}
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
      <ForecastChart
        forecast={check.forecast}
        scenario={room.scenario}
        site={room.scenario === 'training' ? 'jezero' : design.site}
      />
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
