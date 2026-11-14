import type { LogEntry } from '@rs/shared';
import { t } from '../../i18n';
import { useApp } from '../../state/store';
import { spriteFiles } from '../../game/assets';
import { HUD } from './style';

export function RadioLine({ entry }: { entry: LogEntry }) {
  const roster = useApp((s) => s.room?.players);
  const speaker = ['earth', 'tulpar', 'mc'].includes(entry.from) ? entry.from : 'mc';
  const label = ['earth', 'tulpar', 'mc'].includes(entry.from)
    ? t(`eva.speaker.${speaker}`)
    : (roster?.find((p) => p.id === entry.from)?.name ?? entry.from);
  const file = `portrait_${speaker}`;
  const text = t(entry.key, entry.params);
  return (
    <div className="helmet-radio" aria-live="polite" key={entry.id}>
      {spriteFiles[`/public/assets/sprites/${file}.png`] ? (
        <img
          src={`${import.meta.env.BASE_URL}assets/sprites/${file}.png`}
          alt=""
          width={24}
          height={24}
        />
      ) : (
        <b className="radio-icon" aria-hidden="true">
          ◈
        </b>
      )}
      <b className="radio-speaker">{label}</b>
      <span
        className="radio-text"
        style={{
          animationDuration: `${text.length * HUD.radioCharMs}ms`,
          animationTimingFunction: `steps(${Math.max(1, text.length)}, end)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
