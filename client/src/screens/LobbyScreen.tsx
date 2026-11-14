import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { spriteFiles } from '../game/assets';
import type { Role } from '@rs/shared';
import { t } from '../i18n';
import { endSession, send, startSession } from '../net/session';
import { me, useApp } from '../state/store';
import { ScenarioCards } from './lobby/ScenarioCards';
import { startSoloLobby } from './lobby/solo';
import '../ui/menu.css';

const ROLES: Role[] = ['mc', 'eva', 'solo'];

export function LobbyScreen() {
  const background = spriteFiles['/public/assets/sprites/title_bg.png']
    ? ({
        '--title-bg': `url(${import.meta.env.BASE_URL}assets/sprites/title_bg.png)`,
      } as CSSProperties)
    : undefined;
  const room = useApp((s) => s.room);
  const self = useApp(me);
  const conn = useApp((s) => s.conn);
  const error = useApp((s) => s.error);
  const local = useApp((s) => s.mode === 'local');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const busy = conn === 'connecting';
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    void fetch('/healthz', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || (await response.json()).ok !== true) throw Error('offline');
        setHealth('online');
      })
      .catch(() => setHealth('offline'))
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const logo = (
    <div className="logo">
      <h1>{t('app.title')}</h1>
      <div className="logo-tag">
        <span className="logo-dot" />
        {t('app.tagline')}
      </div>
    </div>
  );

  if (!room || !self) {
    return (
      <div className="screen" style={background}>
        {logo}
        <div className="menu-col">
          <label className="panel name-field">
            <span className="field-label">{t('lobby.name')}</span>
            <input
              placeholder={t('lobby.namePlaceholder')}
              maxLength={12}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {health === 'online' && (
            <button
              className="btn-main"
              disabled={busy}
              onClick={() => void startSession('online', name)}
            >
              {t('lobby.create')}
            </button>
          )}
          {health === 'online' && (
            <div className="panel row">
              <input
                placeholder={t('lobby.code')}
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                disabled={busy || code.length !== 4}
                onClick={() => void startSession('online', name, code)}
              >
                {t('lobby.join')}
              </button>
            </div>
          )}
          <button className="btn-main" disabled={busy} onClick={() => void startSoloLobby(name)}>
            {t('lobby.solo')}
          </button>
          <div className="status-line" role="status">
            <span className={`status-dot ${health}`} />
            {t(`lobby.server.${health}`)}
          </div>
          {error && <div className="err">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={background}>
      {logo}
      <div className="panel row">
        <span className="dim">{t('lobby.code')}</span>
        <b className="ok">{room.code}</b>
      </div>
      <div className="panel roster">
        <h2 className="panel-title">{t('lobby.crew')}</h2>
        {room.players.map((p) => (
          <div key={p.id} className={`roster-row ${p.isHost ? 'host' : ''}`}>
            <span>{p.name}</span>
            {p.isHost && <span className="tag">{t('lobby.host')}</span>}
            <span className="tag">{p.role ? t(`role.${p.role}`) : '—'}</span>
            {!p.connected && <span className="tag err">{t('lobby.offlinePlayer')}</span>}
          </div>
        ))}
      </div>
      <div className="role-grid">
        {ROLES.map((r) => (
          <button
            key={r}
            className={self.role === r ? 'on' : ''}
            onClick={() => send({ t: 'lobby:role', role: self.role === r ? null : r })}
          >
            {t(`role.${r}`)}
          </button>
        ))}
      </div>
      <ScenarioCards selected={room.scenario} isHost={self.isHost} />
      {self.isHost && (
        <div className="row">
          <button
            className="btn-main"
            onClick={() => {
              if (local) send({ t: 'lobby:scenario', id: 'training' });
              send({ t: 'lobby:start', quick: true });
            }}
          >
            {t(local ? 'lobby.quick_training' : 'lobby.quick')}
          </button>
          <button className="btn-main" onClick={() => send({ t: 'lobby:start', quick: false })}>
            {t('lobby.design')}
          </button>
        </div>
      )}
      {error && <div className="err">{error}</div>}
      <button onClick={() => endSession()}>{t('lobby.leave')}</button>
    </div>
  );
}
