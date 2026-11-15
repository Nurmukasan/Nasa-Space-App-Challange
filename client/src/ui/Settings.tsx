import { useEffect, useState } from 'react';
import { prefs, usePrefs } from '../state/prefs';
import { me, useApp } from '../state/store';
import { LiftoffControl } from '../screens/eva/LiftoffControl';
import { endSession } from '../net/session';
import { t } from '../i18n';
import './menu.css';
import './settings.css';
export function Settings() {
  const [open, setOpen] = useState(false);
  const music = usePrefs((s) => s.musicVolume),
    effects = usePrefs((s) => s.sfxVolume),
    muted = usePrefs((s) => s.muted),
    reduce = usePrefs((s) => s.reduceMotion),
    glass = usePrefs((s) => s.visorGlass);
  // During the mission the button would sit on top of the HUD, so Esc opens it instead.
  const inMission = useApp((s) => s.room?.phase === 'eva');
  const inRoom = useApp((s) => !!s.room);
  const solo = useApp((s) => me(s)?.role === 'solo');
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduce);
  }, [reduce]);
  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen((v) => !v);
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);
  return (
    <div className="settings">
      {!inMission && <button onClick={() => setOpen(!open)}>{t('settings.title')}</button>}
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
          <label className="setting-check">
            <input
              type="checkbox"
              checked={glass}
              onChange={(e) => prefs.setState({ visorGlass: e.target.checked })}
            />
            {t('settings.visorGlass')}
          </label>
          {inMission && solo && <LiftoffControl />}
          <button onClick={() => setOpen(false)}>
            {t(inMission ? 'settings.resume' : 'settings.close')}
          </button>
          {inRoom && (
            <button
              className="danger"
              onClick={() => {
                setOpen(false);
                endSession();
              }}
            >
              {t('settings.leave')}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
