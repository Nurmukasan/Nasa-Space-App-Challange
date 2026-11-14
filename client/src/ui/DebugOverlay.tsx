import { useEffect, useState } from 'react';
import { diagnostics } from '../state/diagnostics';
import { frameStats } from '../state/frameStats';
import { snaps } from '../state/snapshots';
import { t } from '../i18n';
export function DebugOverlay() {
  const [visible, setVisible] = useState(new URLSearchParams(location.search).has('debug'));
  const [stats, setStats] = useState({
    fps: 0,
    script: null as number | null,
    ping: null as number | null,
    bytes: 0,
    tick: 0,
    objects: 0,
    particles: 0,
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!visible) return;
    let raf = 0,
      count = 0,
      start = performance.now(),
      frames = frameStats.frames,
      total = frameStats.scriptTotalMs;
    const update = (now: number) => {
      count++;
      if (now - start >= 1000) {
        const samples = frameStats.frames - frames;
        setStats({
          fps: Math.round((count * 1000) / (now - start)),
          script:
            samples > 0 && frameStats.scriptMs !== null
              ? (frameStats.scriptTotalMs - total) / samples
              : null,
          ping: diagnostics.pingMs,
          bytes: diagnostics.snapshotBytes,
          tick: snaps.curr?.tick ?? 0,
          objects: frameStats.scriptMs === null ? 0 : frameStats.objects,
          particles: frameStats.scriptMs === null ? 0 : frameStats.particles,
        });
        count = 0;
        start = now;
        frames = frameStats.frames;
        total = frameStats.scriptTotalMs;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  return visible ? (
    <aside className="debug-overlay">
      {t('debug.stats', {
        fps: stats.fps,
        script: stats.script?.toFixed(2) ?? '—',
        ping: stats.ping?.toFixed(0) ?? '—',
        bytes: stats.bytes,
        tick: stats.tick,
        objects: stats.objects,
        particles: stats.particles,
      })}
    </aside>
  ) : null;
}
