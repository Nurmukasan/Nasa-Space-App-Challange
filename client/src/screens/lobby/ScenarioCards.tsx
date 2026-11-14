import type { ScenarioId } from '@rs/shared';
import { FEATURES } from '../../ui/features';
import { send } from '../../net/session';
import { t } from '../../i18n';
import '../../ui/lobby.css';

const SCENARIOS: ScenarioId[] = ['training', 'signal', 'free'];
const ICON = { training: '◈', signal: '◎', free: '◇' };

export function ScenarioCards({ selected, isHost }: { selected: ScenarioId; isHost: boolean }) {
  return (
    <section className="scenario-picker" aria-label={t('lobby.scenarios')}>
      <h2>{t('lobby.scenarios')}</h2>
      <div className="scenario-cards">
        {SCENARIOS.filter((id) => id !== 'signal' || FEATURES.signalScenario).map((id) => (
          <button
            key={id}
            data-scenario={id}
            aria-pressed={id === selected}
            disabled={!isHost}
            className={id === selected ? 'on' : ''}
            onClick={() => send({ t: 'lobby:scenario', id })}
          >
            <span className="scenario-icon" aria-hidden="true">
              {ICON[id]}
            </span>
            <b>{t(`lobby.scenario.${id}.title`)}</b>
            <small>{t(`lobby.scenario.${id}.brief`)}</small>
            <small>{t(`lobby.scenario.${id}.duration`)}</small>
          </button>
        ))}
      </div>
      {!isHost && <small>{t('lobby.host_selects')}</small>}
    </section>
  );
}
