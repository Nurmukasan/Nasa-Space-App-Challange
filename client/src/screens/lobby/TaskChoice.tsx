import { send } from '../../net/session';
import { t } from '../../i18n';

export function TaskChoice({ enabled, isHost }: { enabled: boolean; isHost: boolean }) {
  return (
    <label className="panel personal-tasks">
      <span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!isHost}
          onChange={(e) => send({ t: 'lobby:tasks', enabled: e.target.checked })}
        />{' '}
        {t('tasks.toggle')}
      </span>
      <small>{t('tasks.toggle_hint')}</small>
    </label>
  );
}
