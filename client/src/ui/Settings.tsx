import { useEffect, useState } from 'react';
import { prefs, usePrefs } from '../state/prefs';
import { audio } from '../net/clientServices';
import { t } from '../i18n';
export function Settings() {
  const [open, setOpen] = useState(false);
  const value = usePrefs();
  useEffect(() => {
    audio?.setVolume?.('music', value.music);
    audio?.setVolume?.('sfx', value.effects);
    audio?.mute?.(value.muted);
    document.documentElement.dataset.reduceMotion = String(value.reduceMotion);
  }, [value]);
  return (
    <div className="settings">
      <button onClick={() => setOpen(!open)}>{t('settings.title')}</button>
      {open && (
        <section className="panel" role="dialog" aria-label={t('settings.title')}>
          {(['music', 'effects'] as const).map((key) => (
            <label key={key}>
              {t(`settings.${key}`)}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={value[key]}
                onChange={(e) => prefs.setState({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          {(['muted', 'reduceMotion'] as const).map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(e) => prefs.setState({ [key]: e.target.checked })}
              />
              {t(`settings.${key}`)}
            </label>
          ))}
          <button onClick={() => setOpen(false)}>{t('settings.close')}</button>
        </section>
      )}
    </div>
  );
}
