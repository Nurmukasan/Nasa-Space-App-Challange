import { useEffect, useState } from 'react';
import type { Role } from '@rs/shared';
import { t } from '../i18n';
import { endSession, send, startSession } from '../net/session';
import { me, useApp } from '../state/store';
import { ScenarioCards } from './lobby/ScenarioCards';
import { startSoloLobby } from './lobby/solo';

const ROLES: Role[] = ['mc', 'eva', 'solo'];

export function LobbyScreen() {
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

  if (!room || !self) {
    return (
      <div className="screen">
        <h1>{t('app.title')}</h1>
        <div className="dim">{t('app.tagline')}</div>
        {health === 'online' && (
          <div className="panel row">
            <input
              placeholder={t('lobby.name')}
              maxLength={12}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button disabled={busy} onClick={() => void startSession('online', name)}>
              {t('lobby.create')}
            </button>
          </div>
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
        {health !== 'online' && (
          <p role="status">{t(health === 'checking' ? 'lobby.checking' : 'lobby.offline')}</p>
        )}
        <button disabled={busy} onClick={() => void startSoloLobby(name)}>
          {t('lobby.solo')}
        </button>
        {error && <div className="err">{error}</div>}
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>{t('app.title')}</h1>
      <div className="panel">
        {t('lobby.code')}: <b className="ok">{room.code}</b>
      </div>
      <div className="panel">
        {room.players.map((p) => (
          <div key={p.id} className="row">
            <span>{p.isHost ? '★' : '·'}</span>
            <span>{p.name}</span>
            <span className="dim">{p.role ? t(`role.${p.role}`) : '—'}</span>
            {!p.connected && <span className="err">{t('lobby.offlinePlayer')}</span>}
          </div>
        ))}
      </div>
      <div className="row">
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
            onClick={() => {
              if (local) send({ t: 'lobby:scenario', id: 'training' });
              send({ t: 'lobby:start', quick: true });
            }}
          >
            {t(local ? 'lobby.quick_training' : 'lobby.quick')}
          </button>
          <button onClick={() => send({ t: 'lobby:start', quick: false })}>
            {t('lobby.design')}
          </button>
        </div>
      )}
      {error && <div className="err">{error}</div>}
      <button onClick={() => endSession()}>{t('lobby.leave')}</button>
    </div>
  );
}
