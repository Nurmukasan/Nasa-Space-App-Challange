import { useEffect, useRef, useState } from 'react';
import { TacticalMap, MAP_SIZE } from '../console/TacticalMap';
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
import { fxBus } from '../fx/FxBus';
import { audio } from '../audio';
export function ConsoleScreen() {
  const canvas = useRef<HTMLCanvasElement>(null),
    map = useRef<TacticalMap | null>(null);
  const hud = useApp((s) => s.hud),
    players = useApp((s) => s.room?.players);
  const params = useApp((s) => s.room?.params ?? null);
  useEffect(() => {
    const off = fxBus.on('tremor', () => audio.sfx('alarm_seismic'));
    const impact = fxBus.on('impact', () => audio.sfx('alarm_seismic'));
    return () => {
      off();
      impact();
    };
  }, []);
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
    <main className="console-screen crt">
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
        <Commands target={target} crew={hud?.astronauts.map((a) => a.id) ?? []} />
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
