// One game room: players, phases, design, and the running simulation.
// Pure logic, no network and no timers: the server (Socket.IO) and the client
// (LocalTransport for solo/offline play) both drive this same class.
import { MAX_EVA, MAX_PLAYERS, SEISMIC, SOLO, WEATHER } from '../balance';
import { PRESETS } from '../catalog';
import { SCENARIOS, isScenarioId } from '../scenarios';
import { debugSim } from '../sim/debug';
import {
  checkDesign,
  cloneDesign,
  defaultDesign,
  deriveParams,
  setDesignField,
  toggleModule,
} from '../design';
import type { ClientMsg, JoinRequest, JoinResult, ServerMsg } from '../protocol';
import { buildReport, createSim, endMission, handleSimMsg, stepSim } from '../sim';
import type { Sim } from '../sim';
import type { PlayerInfo, Role, RoomState } from '../types';

/** Emit target meaning "everyone in the room". */
export const ALL = '*';

export interface RoomOptions {
  code: string;
  seed: number;
  emit: (target: string, msg: ServerMsg) => void;
  /** Injected for deterministic tests. Defaults to Math.random based ids. */
  makeId?: () => string;
  allowDebug?: boolean;
}

interface PlayerSlot {
  info: PlayerInfo;
  token: string;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().slice(0, 12) : '';
  return s.length > 0 ? s : 'CREW';
}

export class GameRoom {
  readonly code: string;
  readonly state: RoomState;
  private readonly emit: RoomOptions['emit'];
  private readonly makeId: () => string;
  private readonly allowDebug: boolean;
  private slots: PlayerSlot[] = [];
  private sim: Sim | null = null;
  private dirty = false;

  constructor(opts: RoomOptions) {
    this.code = opts.code;
    this.emit = opts.emit;
    this.makeId = opts.makeId ?? randomId;
    this.allowDebug = opts.allowDebug === true;
    const design = defaultDesign();
    this.state = {
      code: opts.code,
      phase: 'lobby',
      seed: opts.seed >>> 0,
      hostId: '',
      attempt: 0,
      players: [],
      design,
      check: checkDesign(design),
      params: null,
      report: null,
      scenario: 'free',
    };
  }

  get playerCount(): number {
    return this.slots.length;
  }

  get connectedCount(): number {
    return this.slots.filter((s) => s.info.connected).length;
  }

  /** Current simulation, exposed for tests and debug tools only. */
  get simulation(): Sim | null {
    return this.sim;
  }

  join(req: JoinRequest): JoinResult {
    const token = typeof req.token === 'string' ? req.token : '';
    const existing = token ? this.slots.find((s) => s.token === token) : undefined;
    if (existing) {
      existing.info.connected = true;
      this.ensureHost();
      this.flush(true);
      return { ok: true, code: this.code, playerId: existing.info.id, token, state: this.state };
    }
    if (this.state.phase !== 'lobby') return { ok: false, error: 'game_in_progress' };
    if (this.slots.length >= MAX_PLAYERS) return { ok: false, error: 'room_full' };
    const used = new Set(this.slots.map((s) => s.info.colorIdx));
    let colorIdx = 0;
    while (used.has(colorIdx)) colorIdx++;
    const info: PlayerInfo = {
      id: this.makeId(),
      name: cleanName(req.name),
      colorIdx,
      role: null,
      ready: false,
      connected: true,
      isHost: false,
    };
    const slot: PlayerSlot = { info, token: this.makeId() + this.makeId() };
    this.slots.push(slot);
    // A second player cancels solo mode.
    for (const s of this.slots) if (s.info.role === 'solo') s.info.role = null;
    this.ensureHost();
    this.syncPlayers();
    this.flush(true);
    return { ok: true, code: this.code, playerId: info.id, token: slot.token, state: this.state };
  }

  /** Call when a player's connection drops or they leave. */
  disconnect(playerId: string): void {
    const slot = this.slots.find((s) => s.info.id === playerId);
    if (!slot) return;
    if (this.state.phase === 'lobby') {
      this.slots = this.slots.filter((s) => s !== slot);
    } else {
      slot.info.connected = false;
    }
    this.ensureHost();
    this.syncPlayers();
    this.flush(true);
  }

  /** Never throws. Unknown or invalid messages are ignored or answered with an error. */
  handle(playerId: string, raw: unknown): void {
    try {
      const slot = this.slots.find((s) => s.info.id === playerId);
      if (!slot) return;
      if (
        typeof raw !== 'object' ||
        raw === null ||
        typeof (raw as { t?: unknown }).t !== 'string'
      ) {
        this.emit(playerId, { t: 'error', code: 'bad_request' });
        return;
      }
      this.dispatch(slot, raw as ClientMsg);
    } catch {
      this.emit(playerId, { t: 'error', code: 'bad_request' });
    }
    this.flush(false);
  }

  /** Advance one fixed step. The caller owns the clock. */
  tick(dt: number): void {
    if (this.state.phase === 'eva' && this.sim) {
      stepSim(this.sim, dt);
      this.emit(ALL, { t: 'snap', snap: this.sim.pub });
      if (this.sim.pub.ended) this.finishMission();
    }
    this.flush(false);
  }

  // ---------------------------------------------------------------------------

  private dispatch(slot: PlayerSlot, msg: ClientMsg): void {
    const me = slot.info;
    const isHost = me.id === this.state.hostId;
    const phase = this.state.phase;
    switch (msg.t) {
      case 'lobby:role':
        if (phase !== 'lobby') return;
        if (this.canTakeRole(me, msg.role)) {
          me.role = msg.role;
          this.dirty = true;
        } else {
          this.emit(me.id, { t: 'error', code: 'not_allowed' });
        }
        return;
      case 'lobby:scenario':
        if ((phase !== 'lobby' && phase !== 'design') || !isHost || !isScenarioId(msg.id)) return;
        this.state.scenario = msg.id;
        this.state.check = checkDesign(this.state.design, msg.id);
        this.dirty = true;
        return;
      case 'lobby:ready':
        me.ready = msg.ready === true;
        this.dirty = true;
        return;
      case 'lobby:start':
        if (phase !== 'lobby' || !isHost) return;
        if (!this.rolesValid()) {
          this.emit(me.id, { t: 'error', code: 'not_allowed' });
          return;
        }
        if (msg.quick === true) {
          this.setDesign(cloneDesign(PRESETS[SCENARIOS[this.state.scenario].quickPreset]));
          this.launch();
        } else {
          this.state.phase = 'design';
          this.dirty = true;
        }
        return;
      case 'design:set': {
        if (phase !== 'design') return;
        const next = setDesignField(this.state.design, String(msg.field), String(msg.value));
        if (next) this.setDesign(next);
        return;
      }
      case 'design:module': {
        if (phase !== 'design') return;
        const next = toggleModule(this.state.design, String(msg.id), msg.on === true);
        if (next) this.setDesign(next);
        return;
      }
      case 'design:preset': {
        if (phase !== 'design') return;
        const id = String(msg.id);
        if (Object.prototype.hasOwnProperty.call(PRESETS, id)) {
          this.setDesign(cloneDesign(PRESETS[id as keyof typeof PRESETS]));
        }
        return;
      }
      case 'design:launch':
        if (phase !== 'design' || !isHost) return;
        if (!this.state.check.ok) {
          this.emit(me.id, { t: 'error', code: 'not_allowed' });
          return;
        }
        this.launch();
        return;
      case 'report:again':
        if (phase !== 'report' || !isHost) return;
        if (msg.redesign === true) {
          this.state.phase = 'design';
          this.state.report = null;
          this.dirty = true;
        } else {
          this.launch();
        }
        return;
      case 'debug':
        if (!this.allowDebug) return;
        if (phase !== 'eva' || !this.sim) return;
        if (msg.cmd === 'skip_phase') {
          endMission(this.sim);
          this.finishMission();
        } else if (msg.cmd === 'set_time' && typeof msg.n === 'number' && Number.isFinite(msg.n)) {
          this.sim.pub.t = Math.max(0, Math.min(this.sim.pub.durationS - 1, msg.n));
        } else if (
          msg.cmd === 'event_quake' ||
          msg.cmd === 'event_impact' ||
          msg.cmd === 'event_wind'
        ) {
          const a = this.sim.pub.astronauts[0];
          if (a)
            this.sim.hidden.schedule.push({
              id: `debug-${this.sim.hidden.schedule.length}`,
              kind:
                msg.cmd === 'event_quake'
                  ? 'quake'
                  : msg.cmd === 'event_impact'
                    ? 'impact'
                    : 'wind',
              t0: this.sim.pub.t + SEISMIC.debugDelayS,
              x: a.x,
              y: a.y,
              fired: false,
            });
        } else if (msg.cmd === 'storm') {
          const tStart = this.sim.pub.t + WEATHER.debugDelayS;
          this.sim.hidden.storm = { tStart, tEnd: tStart + WEATHER.stormDurS };
          this.sim.hidden.stormStarted = false;
          this.sim.hidden.stormEnded = false;
        } else if (msg.cmd === 'drain_o2') {
          for (const a of this.sim.pub.astronauts) a.o2 = Math.min(a.o2, a.o2Max * 0.15);
        } else {
          debugSim(this.sim, msg.cmd, typeof msg.n === 'number' ? msg.n : undefined);
        }
        return;
      default:
        if (phase === 'eva' && this.sim) {
          const canEva = me.role === 'eva' || me.role === 'solo';
          const canMc = me.role === 'mc' || me.role === 'solo';
          handleSimMsg(this.sim, me.id, canEva, canMc, msg);
        }
        return;
    }
  }

  private canTakeRole(me: PlayerInfo, role: Role | null): boolean {
    if (role === null) return true;
    const others = this.slots.map((s) => s.info).filter((p) => p.id !== me.id);
    if (role === 'solo') return others.length === 0;
    if (role === 'mc') return !others.some((p) => p.role === 'mc');
    if (role === 'eva') return others.filter((p) => p.role === 'eva').length < MAX_EVA;
    return false;
  }

  private rolesValid(): boolean {
    const players = this.slots.map((s) => s.info);
    if (players.length === 1) return players[0]!.role === 'solo';
    const mc = players.filter((p) => p.role === 'mc').length;
    const eva = players.filter((p) => p.role === 'eva').length;
    return mc === 1 && eva >= 1 && mc + eva === players.length;
  }

  private setDesign(design: RoomState['design']): void {
    this.state.design = design;
    this.state.check = checkDesign(design, this.state.scenario);
    this.dirty = true;
  }

  private launch(): void {
    this.state.attempt++;
    const sc = SCENARIOS[this.state.scenario];
    const design = sc.site ? { ...this.state.design, site: sc.site } : this.state.design;
    const seed = sc.seed ?? (this.state.seed + this.state.attempt) >>> 0;
    const params = deriveParams(design, seed, sc.id);
    const crew = this.slots.map((s) => s.info).filter((p) => p.role === 'eva' || p.role === 'solo');
    params.solo = crew.length === 1 && crew[0]!.role === 'solo';
    // Solo plays both roles: a longer decision window (v2 scenarios only; free keeps v1).
    if (params.solo && sc.id !== 'free') params.classifyWindowS *= SOLO.classifyMul;
    this.sim = createSim(
      params,
      crew.map((p) => p.id),
    );
    this.state.params = params;
    this.state.report = null;
    this.state.phase = 'eva';
    for (const s of this.slots) s.info.ready = false;
    this.dirty = true;
  }

  private finishMission(): void {
    if (!this.sim) return;
    this.state.report = buildReport(this.sim, this.state.design, this.state.check);
    this.state.phase = 'report';
    this.sim = null;
    this.dirty = true;
  }

  private ensureHost(): void {
    const current = this.slots.find((s) => s.info.id === this.state.hostId && s.info.connected);
    const host = current ?? this.slots.find((s) => s.info.connected) ?? this.slots[0];
    this.state.hostId = host ? host.info.id : '';
    for (const s of this.slots) s.info.isHost = s.info.id === this.state.hostId;
  }

  private syncPlayers(): void {
    this.state.players = this.slots.map((s) => s.info);
    this.dirty = true;
  }

  private flush(force: boolean): void {
    if (!force && !this.dirty) return;
    this.dirty = false;
    this.state.players = this.slots.map((s) => s.info);
    this.emit(ALL, { t: 'state', state: this.state });
  }
}
