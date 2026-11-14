import type { CSSProperties } from 'react';
import { CREW, CREW_CLASS_IDS } from '@rs/shared';
import type { CrewClassId } from '@rs/shared';
import { CREW_FRAMES } from '../../game/crewArt';
import { crewCanvas } from '../../game/crewTextures';
import { t } from '../../i18n';
import { send } from '../../net/session';

/** Portrait: frame 0 at 4x. */
const PREVIEW = 96;

/** Perk as a signed percentage, read from balance.ts so the card never lies. */
function perk(id: CrewClassId): string {
  const rows: Array<[keyof typeof CREW, string]> = [
    ['speedMul', 'crew.perk.speed'],
    ['digMul', 'crew.perk.dig'],
    ['repairMul', 'crew.perk.repair'],
    ['sampleMul', 'crew.perk.sample'],
  ];
  const [table, key] = rows.find(([table]) => CREW[table][id] !== 1) ?? rows[0]!;
  return t(key, { n: Math.round((CREW[table][id] - 1) * 100) });
}

function preview(id: CrewClassId): CSSProperties {
  return {
    width: PREVIEW,
    height: PREVIEW,
    backgroundImage: `url(${crewCanvas(id).toDataURL()})`,
    backgroundSize: `${PREVIEW * CREW_FRAMES}px ${PREVIEW}px`,
  };
}

/** Field specialty for this mission. Everyone sees it: the choice is part of the room state. */
/** `current` is null until the player picks a class themselves. */
export function CrewClassPicker({ current }: { current: CrewClassId | null }) {
  return (
    <div className="panel skin-picker crew-picker" role="radiogroup" aria-label={t('crew.title')}>
      <span className="field-label">{t(current ? 'crew.title' : 'crew.prompt')}</span>
      <div className="skin-row">
        {CREW_CLASS_IDS.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={current === id}
            className={current === id ? 'on' : ''}
            onClick={() => send({ t: 'lobby:class', crewClass: id })}
          >
            <span className="crew-portrait" style={preview(id)} />
            <span>{t(`crew.${id}.name`)}</span>
            <small className="crew-desc">{t(`crew.${id}.desc`)}</small>
            <small className="crew-perk">{perk(id)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
