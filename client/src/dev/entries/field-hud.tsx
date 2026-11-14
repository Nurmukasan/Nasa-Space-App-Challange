import { useEffect, useState } from 'react';
import { HelmetHud } from '../../screens/eva/HelmetHud';
import { evaText as t } from '../../i18n/en/eva';
import { FIELD_STATES, fieldFixture } from '../fixtures/field';
import { prefs } from '../../state/prefs';
export const name = 'field-hud';
export function render() {
  return <HudPlayground />;
}
function HudPlayground() {
  const [index, setIndex] = useState(0),
    [cycle, setCycle] = useState(false);
  useEffect(() => {
    if (!cycle) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % FIELD_STATES.length), 3000);
    return () => clearInterval(timer);
  }, [cycle]);
  const fixture = fieldFixture(FIELD_STATES[index]);
  return (
    <div className="stage" style={{ background: 'linear-gradient(135deg,#6c2a2e,#c6643a)' }}>
      <HelmetHud key={index} {...fixture} />
      <div
        style={{
          position: 'absolute',
          zIndex: 1500,
          left: 36,
          top: '45%',
          pointerEvents: 'auto',
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          maxWidth: 600,
        }}
      >
        {FIELD_STATES.map((state, i) => (
          <button key={state} onClick={() => setIndex(i)} aria-pressed={index === i}>
            {state.toUpperCase().replace('_', ' ')}
          </button>
        ))}
        <button onClick={() => setCycle((v) => !v)} aria-pressed={cycle}>
          {t('eva.fixture_cycle')}
        </button>
        <button onClick={() => prefs.setState({ reduceMotion: !prefs.getState().reduceMotion })}>
          REDUCE MOTION
        </button>
      </div>
    </div>
  );
}
