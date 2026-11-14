import { DIRECTOR, SCENARIOS } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { t } from '../../i18n';
import '../../ui/cinematics.css';
/** The known launch window is independent of critical danger-banner priority. */
export function MissionFlow({ snap }: { snap: EvaState }) {
  const beat = SCENARIOS[snap.scenario].beats.find((b) => b.action.kind === 'window');
  const at = beat?.at ?? snap.durationS - DIRECTOR.windowWarnS;
  if (snap.t < 0 || snap.t < at) return null;
  return (
    <div className="helmet-window" role="status">
      {t('eva.window_closing')}
      <b>{Math.max(0, Math.ceil(snap.durationS - snap.t))}s</b>
    </div>
  );
}
