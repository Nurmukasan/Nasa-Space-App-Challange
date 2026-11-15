import type { CrewClassId } from '../types';

export type TaskChain = 'sampling' | 'deploy' | 'survey' | 'deep' | 'preferred';

/** All classes can collect samples; specialties bias the pool, not permissions. */
export const TASK_CHAINS: Record<CrewClassId, readonly TaskChain[]> = {
  engineer: ['deploy', 'deploy', 'sampling'],
  scout: ['survey', 'survey', 'sampling', 'deploy'],
  geologist: ['deep', 'deep', 'sampling', 'survey'],
  biologist: ['preferred', 'preferred', 'sampling', 'survey'],
};
