import { useEffect, useRef, useState } from 'react';
import { TacticalMap, MAP_SIZE } from '../console/TacticalMap';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { useApp } from '../state/store';
import { t } from '../i18n';
import '../console/layout.css';
export function ConsoleScreen() {
  const canvas = useRef<HTMLCanvasElement>(null),
    map = useRef<TacticalMap | null>(null);
  const hud = useApp((s) => s.hud),
    players = useApp((s) => s.room?.players);
  const [selected, setSelected] = useState<string | null>(null);
  const target = selected ?? hud?.astronauts[0]?.id ?? null;
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!canvas.current) return;
    map.current = new TacticalMap(canvas.current, () => targetRef.current);
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea,button')) return;
      const a = snaps.curr?.astronauts[Number(e.key) - 1];
      if (a) setSelected(a.id);
    };
    window.addEventListener('keydown', key);
    return () => {
      map.current?.destroy();
      window.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <main className="console-screen">
      <section>
        <h1>{t('console.title')}</h1>
        <canvas
          aria-label={t('console.title')}
          className="console-map"
          ref={canvas}
          width={MAP_SIZE}
          height={MAP_SIZE}
          onClick={(e) => {
            const p = map.current?.point(e.clientX, e.clientY);
            if (!p) return;
            const hit = map.current?.hitAt(p.x, p.y);
            if (hit) setSelected(hit);
            else if (target) send({ t: 'mc:waypoint', playerId: target, ...p });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (target) send({ t: 'mc:clearWaypoint', playerId: target });
          }}
        />
        <p>{t('console.help')}</p>
      </section>
      <aside className="console-side">
        <section className="panel">
          <h2>{t('console.crew')}</h2>
          {hud?.astronauts.map((a) => (
            <button
              key={a.id}
              className={target === a.id ? 'on' : ''}
              onClick={() => setSelected(a.id)}
            >
              {players?.find((p) => p.id === a.id)?.name ?? a.id} ·{' '}
              {Math.round((a.o2 / a.o2Max) * 100)}%
            </button>
          ))}
        </section>
        <section className="panel">
          <h2>{t('console.seismic')}</h2>
        </section>
        <section className="panel">
          <h2>{t('console.power')}</h2>
        </section>
      </aside>
      <footer className="console-footer panel">
        <h2>{t('console.radio')}</h2>
        <button onClick={() => send({ t: 'mc:liftoff' })}>{t('console.liftoff')}</button>
      </footer>
    </main>
  );
}
