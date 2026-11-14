// =============================================================================
// CONTRACT FILE. Messages between client and engine. Transport-agnostic:
// Socket.IO carries them as event 'msg'; LocalTransport passes them directly.
// =============================================================================
import type {
  DesignField,
  EvaState,
  EventKind,
  ModuleId,
  PowerAlloc,
  PresetId,
  Role,
  RoomState,
  ScenarioId,
} from './types';

export type PingKind = 'ok' | 'help' | 'low_o2' | 'returning' | 'found' | 'shaking';
export type AlertKind = 'evac' | 'return' | 'hold';
export type DebugCmd =
  | 'skip_phase'
  | 'event_quake'
  | 'event_impact'
  | 'event_wind'
  | 'storm'
  | 'set_time'
  | 'drain_o2'
  | 'event_signal'
  | 'devil'
  | 'fault'
  | 'flare'
  | 'next_act'
  | 'reveal_all';

export type ClientMsg =
  | { t: 'lobby:role'; role: Role | null }
  | { t: 'lobby:ready'; ready: boolean }
  | { t: 'lobby:start'; quick: boolean }
  | { t: 'lobby:scenario'; id: ScenarioId }
  | { t: 'design:set'; field: DesignField; value: string }
  | { t: 'design:module'; id: ModuleId; on: boolean }
  | { t: 'design:preset'; id: PresetId }
  | { t: 'design:launch' }
  | { t: 'eva:move'; x: number; y: number; facing: number; moving: boolean; running: boolean }
  | { t: 'eva:dig'; on: boolean }
  | { t: 'eva:interact' }
  | { t: 'eva:ping'; kind: PingKind }
  | { t: 'mc:waypoint'; playerId: string; x: number; y: number }
  | { t: 'mc:clearWaypoint'; playerId: string }
  | { t: 'mc:classify'; eventId: string; kind: EventKind }
  | { t: 'mc:locate'; eventId: string; x: number; y: number }
  | { t: 'mc:power'; alloc: PowerAlloc }
  | { t: 'mc:dispense'; playerId: string }
  | { t: 'mc:ration'; on: boolean }
  | { t: 'mc:alert'; playerId: string; kind: AlertKind }
  | { t: 'mc:liftoff' }
  | { t: 'report:again'; redesign: boolean }
  | { t: 'debug'; cmd: DebugCmd; n?: number };

export type ErrorCode =
  | 'room_not_found'
  | 'room_full'
  | 'game_in_progress'
  | 'bad_request'
  | 'not_allowed'
  | 'server_full';

export type ServerMsg =
  | { t: 'state'; state: RoomState }
  | { t: 'snap'; snap: EvaState }
  | { t: 'error'; code: ErrorCode };

export interface JoinRequest {
  name: string;
  /** Omit to create a new room. */
  code?: string;
  /** Reconnect token from a previous JoinOk. */
  token?: string;
}

export interface JoinOk {
  ok: true;
  code: string;
  playerId: string;
  token: string;
  state: RoomState;
}

export interface JoinErr {
  ok: false;
  error: ErrorCode;
}

export type JoinResult = JoinOk | JoinErr;

/** Socket.IO event names. */
export const EV_JOIN = 'join';
export const EV_MSG = 'msg';
