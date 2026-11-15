import type { CrewClassId, Role, SampleTier } from './types';

/** Launch roster, including MC (who has no astronaut). Frozen for one attempt. */
export interface TaskCrew {
  id: string;
  name: string;
  role: Role;
  crewClass: CrewClassId;
}

export type PersonalTaskKind = 'collect' | 'deliver' | 'discover' | 'deploy' | 'guide' | 'observe';
export type PersonalTaskState = 'queued' | 'active' | 'blocked' | 'done' | 'failed';
export type TaskReason = 'consumed' | 'unavailable' | 'disconnected' | 'lost' | 'no_work';

/** Public site/anomaly or route target. Never contains undisclosed site coordinates. */
export interface TaskTarget {
  id: string;
  x: number;
  y: number;
  r?: number;
  tier?: SampleTier;
  playerId?: string;
}

/** Bounded audit trail; original ownership is retained separately. */
export interface TaskChange {
  at: number;
  ownerId: string;
  kind: PersonalTaskKind;
  reason: 'transfer' | 'consumed' | 'unavailable';
}

export interface PersonalTask {
  id: string;
  originalOwnerId: string;
  ownerId: string;
  kind: PersonalTaskKind;
  state: PersonalTaskState;
  /** Previous milestone, if any. */
  after?: string;
  target?: TaskTarget;
  reason?: TaskReason;
  completedAt?: number;
  offerTo?: string;
  changes?: TaskChange[];
}

/** Optional until the host opts into assignments; absent in the classic free mission. */
export interface TaskBoard {
  crew: TaskCrew[];
  tasks: PersonalTask[];
}
