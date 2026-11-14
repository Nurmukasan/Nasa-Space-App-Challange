import { useEffect, useRef, useState } from 'react';
import { TacticalMap, MAP_SIZE } from '../console/TacticalMap';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { useApp } from '../state/store';
import { t } from '../i18n';
import '../console/layout.css';
import '../ui/menu.css';
import { CrewPanel } from '../console/panels/CrewPanel';
import { PowerPanel } from '../console/panels/PowerPanel';
import { SeismicPanel } from '../console/panels/SeismicPanel';
import { Commands } from '../console/panels/Commands';
import { PixelIcon } from '../ui/PixelIcon';
import { ObjectivesPanel } from '../console/panels/ObjectivesPanel';
import { SystemsPanel } from '../console/panels/SystemsPanel';
import { fxBus } from '../fx/FxBus';
import { audio } from '../audio';
const VOICES = ['earth', 'tulpar', 'mc', 'sys'];
function voice(from: string): string {
  return VOICES.includes(from) ? from : 'crew';
}
function speaker(from: string, players: { id: string; name: string }[]): string {
  if (VOICES.includes(from)) return t(`voice.${from}`);
  return players.find((p) => p.id === from)?.name ?? from;
}

export function ConsoleScreen() {
  const canvas = useRef<HTMLCanvasElement>(null),
    map = useRef<TacticalMap | null>(null);
  const hud = useApp((s) => s.hud),
    players = useApp((s) => s.room?.players);
  const params = useApp((s) => s.room?.params ?? null);
  useEffect(() => {
    const off = fxBus.on('tremor', () => audio.sfx('alarm_seismic'));
    const impact = fxBus.on('impact', () => audio.sfx('alarm_seismic'));
    const fault = fxBus.on('fault', () => audio.sfx('fault_alarm'));
    return () => {
      off();
      fault();
      impact();
    };
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  const locatingRef = useRef(locating);
  locatingRef.current = locating;
  // Leave LOCATE mode once the event's decision window has closed.
  const locateLive = hud?.seismic.some((e) => e.id === locating && hud.t < e.deadline) ?? false;
  useEffect(() => {
    if (locating && !locateLive) setLocating(null);
  }, [locating, locateLive]);
  const target = selected ?? hud?.astronauts[0]?.id ?? null;
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    if (!canvas.current) return;
    map.current = new TacticalMap(
      canvas.current,
      () => targetRef.current,
      () => locatingRef.current,
    );
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
    <main className="screen console-screen">
      <section>
        <h1 className="console-title">
          {t('console.title')}
          {hud && (
            <small className="console-scenario">
              {' '}
              {t(`scenario.${hud.scenario}`)}
              {hud.scenario !== 'free' && ` · ${t('console.act', { n: hud.act })}`}
            </small>
          )}
        </h1>
        <canvas
          aria-label={t('console.title')}
          className="console-map"
          ref={canvas}
          width={MAP_SIZE}
          height={MAP_SIZE}
          onClick={(e) => {
            const p = map.current?.point(e.clientX, e.clientY);
            if (!p) return;
            if (locating) {
              send({ t: 'mc:locate', eventId: locating, ...p });
              return;
            }
            const hit = map.current?.hitAt(p.x, p.y);
            if (hit) setSelected(hit);
            else if (target) send({ t: 'mc:waypoint', playerId: target, ...p });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (locating) setLocating(null);
            else if (target) send({ t: 'mc:clearWaypoint', playerId: target });
          }}
        />
        <p>{t(locating ? 'console.helpLocate' : 'console.help')}</p>
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
            <ObjectivesPanel snap={hud} />
            <SeismicPanel snap={hud} locating={locating} setLocating={setLocating} />
            {hud.scenario !== 'free' && <SystemsPanel snap={hud} target={target} />}
            <PowerPanel snap={hud} />
          </>
        )}
      </aside>
      <footer className="console-footer panel">
        <Commands target={target} crew={hud?.astronauts.map((a) => a.id) ?? []} />
        <h2 className="panel-title">
          <PixelIcon name="icon_antenna_hg" scale={1} />
          {t('console.radio')}
        </h2>
        <div className="radio-log">
          {hud?.log.map((entry) => (
            <div key={entry.id} className={`voice-${voice(entry.from)}`}>
              {Math.floor(entry.t)} · {speaker(entry.from, players ?? [])}
              {entry.from === 'earth' && ` (${t('console.earthDelay')})`} ·{' '}
              {t(entry.key, entry.params)}
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
