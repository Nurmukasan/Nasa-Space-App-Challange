import { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS, VIEW_H, VIEW_W, WORLD_PX } from '@rs/shared';
import { send } from '../net/session';
import { snaps } from '../state/snapshots';
import { store, useApp } from '../state/store';

const SCALE = VIEW_H / WORLD_PX;
const OFF_X = (VIEW_W - WORLD_PX * SCALE) / 2;

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Walking-skeleton Mission Control: a canvas map plus plain panels. */
export function ConsoleScreen() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hud = useApp((s) => s.hud);
  const players = useApp((s) => s.room?.players ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const target = selected ?? hud?.astronauts[0]?.id ?? null;

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (): void => {
      raf = requestAnimationFrame(draw);
      const snap = snaps.curr;
      ctx.fillStyle = '#050b0a';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (!snap) return;
      const px = (x: number): number => Math.round(OFF_X + x * SCALE);
      const py = (y: number): number => Math.round(y * SCALE);
      ctx.strokeStyle = '#1e604a';
      ctx.strokeRect(px(0), py(0), Math.round(WORLD_PX * SCALE), Math.round(WORLD_PX * SCALE));
      ctx.fillStyle = '#96ffb4';
      ctx.fillRect(px(snap.lander.x) - 2, py(snap.lander.y) - 2, 5, 5);
      ctx.fillStyle = '#46c878';
      for (const s of snap.sites) if (s.known) ctx.fillRect(px(s.x) - 1, py(s.y) - 1, 3, 3);
      const roster = store.getState().room?.players ?? [];
      for (const a of snap.astronauts) {
        if (!a.linked) continue;
        const colorIdx = roster.find((p) => p.id === a.id)?.colorIdx ?? 0;
        ctx.fillStyle = hex(PLAYER_COLORS[colorIdx] ?? 0xffffff);
        ctx.fillRect(px(a.x) - 1, py(a.y) - 1, 3, 3);
        if (a.waypoint) ctx.strokeRect(px(a.waypoint.x) - 2, py(a.waypoint.y) - 2, 5, 5);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!target) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * VIEW_W;
    const cy = ((e.clientY - r.top) / r.height) * VIEW_H;
    send({ t: 'mc:waypoint', playerId: target, x: (cx - OFF_X) / SCALE, y: cy / SCALE });
  };

  return (
    <div className="screen">
      <canvas
        ref={canvas}
        width={VIEW_W}
        height={VIEW_H}
        onClick={onClick}
        style={{ width: 'min(96vw, 960px)', border: '2px solid #1e604a', cursor: 'crosshair' }}
      />
      <div className="panel row">
        {hud?.astronauts.map((a) => (
          <button
            key={a.id}
            className={a.id === target ? 'on' : ''}
            onClick={() => setSelected(a.id)}
          >
            {players.find((p) => p.id === a.id)?.name ?? a.id} · O2{' '}
            {Math.round((a.o2 / a.o2Max) * 100)}% · {a.status}
          </button>
        ))}
        <span className="dim">
          STORE {hud ? Math.round(hud.lander.o2Store) : 0} · POWER {hud?.lander.power.availW ?? 0}W
        </span>
        <button onClick={() => send({ t: 'mc:liftoff' })}>LIFTOFF</button>
      </div>
    </div>
  );
}
