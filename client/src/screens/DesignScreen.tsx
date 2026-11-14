import {
  DIFFICULTIES,
  MODULES,
  MODULE_ORDER,
  OBJECTIVES,
  RELAYS,
  SITES,
  VEHICLES,
} from '@rs/shared';
import type { DesignField } from '@rs/shared';
import { send } from '../net/session';
import { me, useApp } from '../state/store';

// Walking-skeleton version: plain controls, fully data-driven from the catalog.
// The real screen (blueprint, bays, icons) replaces the markup, not the logic.
const FIELDS: Array<{ field: DesignField; options: string[] }> = [
  { field: 'objective', options: Object.keys(OBJECTIVES) },
  { field: 'site', options: Object.keys(SITES) },
  { field: 'vehicle', options: Object.keys(VEHICLES) },
  { field: 'relay', options: Object.keys(RELAYS) },
  { field: 'difficulty', options: Object.keys(DIFFICULTIES) },
];

export function DesignScreen() {
  const room = useApp((s) => s.room);
  const self = useApp(me);
  if (!room || !self) return null;
  const { design, check } = room;
  const tt = check.totals;
  return (
    <div className="screen">
      <h1>MISSION DESIGN</h1>
      <div className="panel row">
        {FIELDS.map(({ field, options }) => (
          <label key={field}>
            {field}{' '}
            <select
              value={design[field]}
              onChange={(e) => send({ t: 'design:set', field, value: e.target.value })}
            >
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="panel row" style={{ maxWidth: 760 }}>
        {MODULE_ORDER.map((id) => {
          const m = MODULES[id];
          const on = design.modules.includes(id);
          return (
            <button
              key={id}
              className={on ? 'on' : ''}
              onClick={() => send({ t: 'design:module', id, on: !on })}
            >
              {id} ${m.cost} {m.massKg}kg {m.powerW > 0 ? '+' : ''}
              {m.powerW}W
            </button>
          );
        })}
      </div>
      <div className="panel">
        <div className={tt.cost > tt.budget ? 'err' : ''}>
          BUDGET {tt.cost} / {tt.budget}
        </div>
        <div className={tt.massKg > tt.massCapKg ? 'err' : ''}>
          MASS {tt.massKg} / {tt.massCapKg} kg
        </div>
        <div className={tt.powerUseW > tt.powerGenW ? 'warn' : ''}>
          POWER {tt.powerUseW} / {tt.powerGenW} W
        </div>
        <div className={tt.dataGen > tt.dataCap ? 'warn' : ''}>
          DATA {tt.dataGen} / {tt.dataCap} Mb/sol
        </div>
        <div className={tt.baysUsed > tt.baysMax ? 'err' : ''}>
          BAYS {tt.baysUsed} / {tt.baysMax}
        </div>
        {check.issues.map((i) => (
          <div key={i.code} className={i.severity === 'error' ? 'err' : 'warn'}>
            {i.severity.toUpperCase()}: {i.code} {i.params ? JSON.stringify(i.params) : ''}
          </div>
        ))}
        <div className="dim">PREDICTION {JSON.stringify(check.prediction)}</div>
      </div>
      {self.isHost && (
        <button disabled={!check.ok} onClick={() => send({ t: 'design:launch' })}>
          LAUNCH
        </button>
      )}
    </div>
  );
}
