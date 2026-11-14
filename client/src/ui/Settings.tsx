import { useEffect, useState } from 'react';
import { prefs, usePrefs } from '../state/prefs';
import { t } from '../i18n';
import './menu.css';
import './settings.css';
export function Settings() {
  const [open, setOpen] = useState(false);
  const music = usePrefs((s) => s.musicVolume),
    effects = usePrefs((s) => s.sfxVolume),
    muted = usePrefs((s) => s.muted),
    reduce = usePrefs((s) => s.reduceMotion);
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduce);
  }, [reduce]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div className="settings">
      <button onClick={() => setOpen(!open)}>{t('settings.title')}</button>
      {open && (
        <section className="panel" role="dialog" aria-label={t('settings.title')}>
          <label className="setting-slider">
            <span className="setting-head">
              {t('settings.music')}
              <output>{Math.round(music * 100)}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music}
              onChange={(e) => prefs.setState({ musicVolume: Number(e.target.value) })}
            />
          </label>
          <label className="setting-slider">
            <span className="setting-head">
              {t('settings.effects')}
              <output>{Math.round(effects * 100)}%</output>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={effects}
              onChange={(e) => prefs.setState({ sfxVolume: Number(e.target.value) })}
            />
          </label>
          <label className="setting-check">
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => prefs.setState({ muted: e.target.checked })}
            />
            {t('settings.muted')}
          </label>
          <label className="setting-check">
            <input
              type="checkbox"
              checked={reduce}
              onChange={(e) => prefs.setState({ reduceMotion: e.target.checked })}
            />
            {t('settings.reduceMotion')}
          </label>
          <button onClick={() => setOpen(false)}>{t('settings.close')}</button>
        </section>
      )}
    </div>
  );
}
