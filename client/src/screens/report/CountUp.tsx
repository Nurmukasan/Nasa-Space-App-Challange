import { useEffect, useRef } from 'react';
import { prefs } from '../../state/prefs';

interface Props {
  value: number;
  delayMs: number;
  durationMs: number;
}

/** Counts from 0 to `value`. Writes straight to the DOM so no React state changes per frame. */
export function CountUp({ value, delayMs, durationMs }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (prefs.getState().reduceMotion) {
      node.textContent = String(value);
      return;
    }
    node.textContent = '0';
    let frame = 0;
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / durationMs);
        node.textContent = String(Math.round(value * (1 - (1 - k) ** 3)));
        if (k < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [value, delayMs, durationMs]);
  return <span ref={ref}>{value}</span>;
}
