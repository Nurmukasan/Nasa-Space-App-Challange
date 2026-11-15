import type { LogEntry } from '@rs/shared';
import { t } from '../../i18n';
import { useApp } from '../../state/store';
import { spriteFiles } from '../../game/assets';
import { HUD } from './style';
import { radioText, radioVoice } from '../../ui/radioText';

export function RadioLine({ entry }: { entry: LogEntry }) {
  const roster = useApp((s) => s.room?.players);
  const voice = radioVoice(entry.from);
  // Crew lines carry no portrait of their own: the MC portrait frames every relayed call.
  const speaker = voice === 'crew' ? 'mc' : voice;
  const label =
    voice === 'crew'
      ? (roster?.find((p) => p.id === entry.from)?.name ?? entry.from)
      : t(`eva.speaker.${speaker}`);
  const file = `portrait_${speaker}`;
  const text = radioText(entry, roster);
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
