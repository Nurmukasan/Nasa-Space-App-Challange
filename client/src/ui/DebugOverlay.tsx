import { useEffect, useState } from 'react';
import { diagnostics } from '../state/diagnostics';
import { snaps } from '../state/snapshots';
import { t } from '../i18n';
export function DebugOverlay() {
  const [visible, setVisible] = useState(new URLSearchParams(location.search).has('debug'));
  const [stats, setStats] = useState({
    fps: 0,
    frame: 0,
    script: null as number | null,
    ping: null as number | null,
    bytes: 0,
    tick: 0,
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
    let frame = 0,
      count = 0,
      start = performance.now(),
      last = start;
    let script: number | null = null;
    const observer = PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
      ? new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const scripts = (entry as PerformanceEntry & { scripts: { duration: number }[] })
              .scripts;
            script = scripts.reduce((sum, value) => sum + value.duration, 0);
          }
        })
      : null;
    observer?.observe({ type: 'long-animation-frame' });
    const update = (now: number) => {
      count++;
      const delta = now - last;
      last = now;
      if (now - start >= 1000) {
        setStats({
          fps: Math.round((count * 1000) / (now - start)),
          frame: delta,
          script,
          ping: diagnostics.pingMs,
          bytes: diagnostics.snapshotBytes,
          tick: snaps.curr?.tick ?? 0,
        });
        count = 0;
        start = now;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [visible]);
  return visible ? (
    <aside className="debug-overlay">
      {t('debug.stats', {
        fps: stats.fps,
        frame: stats.frame.toFixed(1),
        script: stats.script?.toFixed(1) ?? '—',
        ping: stats.ping?.toFixed(0) ?? '—',
        bytes: stats.bytes,
        tick: stats.tick,
      })}
    </aside>
  ) : null;
}
