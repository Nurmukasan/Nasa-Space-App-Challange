import { useEffect, useRef, useState } from 'react';
import { TacticalMap } from '../console/TacticalMap';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { useApp } from '../state/store';
import { t } from '../i18n';
import '../console/layout.css';
import '../ui/crt.css';
import { CrewPanel } from '../console/panels/CrewPanel';
import { PowerPanel } from '../console/panels/PowerPanel';
import { SeismicPanel } from '../console/panels/SeismicPanel';
import { Commands } from '../console/panels/Commands';
export function ConsoleScreen() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useRef<TacticalMap | null>(null);
  const hud = useApp((s) => s.hud);
  const params = useApp((s) => s.room?.params ?? null);
  const players = useApp((s) => s.room?.players);
  const [selected, setSelected] = useState<string | null>(null);
  const target = selected ?? hud?.astronauts[0]?.id ?? null;
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!canvas.current) return;
    map.current = new TacticalMap(canvas.current, () => targetRef.current);
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
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
    <main className="console-screen crt">
      <section>
        <h1>{t('console.title')}</h1>
        <canvas
          aria-label={t('console.title')}
          className="console-map"
          ref={canvas}
          width={640}
          height={640}
          onClick={(e) => {
            const p = map.current?.point(e.clientX, e.clientY);
            if (!p) return;
            const hit = snaps.curr?.astronauts.find(
              (a) => a.linked && Math.hypot(a.x - p.x, a.y - p.y) < 35,
            );
            if (hit) setSelected(hit.id);
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
        {hud && (
          <>
            <CrewPanel
              snap={hud}
              params={params}
              players={players ?? []}
              target={target}
              select={setSelected}
            />
            <SeismicPanel snap={hud} />
            <PowerPanel snap={hud} />
          </>
        )}
      </aside>
      <footer className="console-footer panel">
        <Commands target={target} />
        <h2>{t('console.radio')}</h2>
        <div className="radio-log">
          {hud?.log.map((entry) => (
            <div key={entry.id}>
              {Math.floor(entry.t)} · {entry.from} · {t(entry.key, entry.params)}
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
