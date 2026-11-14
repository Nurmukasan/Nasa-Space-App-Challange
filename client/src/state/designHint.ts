import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Insight } from '@rs/shared';
export const designHint = createStore<{ fix: Insight['fix'] | null }>(() => ({ fix: null }));
export function useDesignHint() {
  return useStore(designHint, (s) => s.fix);
}
