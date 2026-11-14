import { useMemo } from 'react';
import { SKINS, skinSheet } from '../../game/skins';
import { prefs, usePrefs } from '../../state/prefs';
import { t } from '../../i18n';

/** Suit choice before the mission. Only you see it for now: the choice lives in your browser. */
export function SkinPicker() {
  const current = usePrefs((p) => p.skin);
  const previews = useMemo(() => {
    const out: Record<string, string> = {};
    for (const skin of SKINS) {
      const src = skinSheet(skin);
      const one = document.createElement('canvas');
      one.width = one.height = 16;
      one.getContext('2d')!.drawImage(src, 0, 0, 16, 16, 0, 0, 16, 16);
      out[skin.id] = one.toDataURL();
    }
    return out;
  }, []);
  return (
    <div className="panel skin-picker" role="radiogroup" aria-label={t('lobby.skin')}>
      <span className="field-label">{t('lobby.skin')}</span>
      <div className="skin-row">
        {SKINS.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={current === s.id}
            className={current === s.id ? 'on' : ''}
            onClick={() => prefs.setState({ skin: s.id })}
          >
            <img src={previews[s.id]} alt="" width={48} height={48} />
            <span>{t(`skin.${s.id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
