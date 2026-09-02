/**
 * In-memory game store for "Editor in Grief".
 *
 * PHASE 1-2: everything lives in process memory. There is intentionally NO
 * database. The store is deliberately transport-agnostic: it mutates authoritative
 * RoomState and calls an injected `broadcast(code)` whenever a room changes (so
 * server-driven changes like timer expiry also reach clients).
 *
 * SEAM FOR PHASES 3-4: replace this class with one backed by a real datastore
 * (sources/sessions/rounds/submissions tables) — the RoomState shape and the
 * method surface are what the rest of the app depends on.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  computeTimerSeconds,
  type Player,
  type Round,
  type RoomState,
  type SeedSource,
  type Source,
  type Submission,
} from '@shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Seed bank (loaded once at startup from the generated manifest)
// ---------------------------------------------------------------------------
function loadSeedBank(): SeedSource[] {
  try {
    const manifestPath = join(__dirname, '..', 'public', 'seed', 'manifest.json');
    const raw = readFileSync(manifestPath, 'utf8');
    return JSON.parse(raw) as SeedSource[];
  } catch (err) {
    console.warn('[gameStore] Could not load seed manifest. Run `npm run seed`.', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Small id / code helpers
// ---------------------------------------------------------------------------
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

interface Room {
  state: RoomState;
  sessionId: string;
  usedSourceIds: string[];
  autoTimer?: ReturnType<typeof setTimeout>;
}

const AUTO_SUBMIT_GRACE_MS = 1800;

export class GameStore {
  private rooms = new Map<string, Room>();
  private seedBank: SeedSource[];
  private sources = new Map<string, Source>(); // all sources ever seen (seed + uploaded)
  broadcast: (code: string) => void = () => {};

  constructor() {
    this.seedBank = loadSeedBank();
    const now = Date.now();
    for (const s of this.seedBank) {
      this.sources.set(s.id, {
        id: s.id,
        uploadedBy: null,
        imageUrl: s.imageUrl,
        ocrText: null,
        wordCount: s.wordCount,
        createdAt: now,
        timesUsed: 0,
      });
    }
    console.log(`[gameStore] Loaded ${this.seedBank.length} seed sources.`);
  }

  // -------------------------------------------------------------------------
  // Lookups
  // -------------------------------------------------------------------------
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getState(code: string): RoomState | undefined {
    const room = this.getRoom(code);
    if (!room) return undefined;
    return { ...room.state, serverTime: Date.now() };
  }

  private newCode(): string {
    let code = '';
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------
  createRoom(nickname: string): { code: string; playerId: string } {
    const code = this.newCode();
    const playerId = randomId('p');
    const host: Player = { id: playerId, nickname: cleanNick(nickname), isHost: true, connected: true, score: 0 };
    const state: RoomState = {
      code,
      phase: 'lobby',
      hostId: playerId,
      players: [host],
      votingEnabled: false,
      roundNumber: 0,
      currentSource: null,
      currentRound: null,
      serverTime: Date.now(),
    };
    this.rooms.set(code, { state, sessionId: randomId('sess'), usedSourceIds: [] });
    return { code, playerId };
  }

  joinRoom(code: string, nickname: string): { code: string; playerId: string } {
    const room = this.requireRoom(code);
    const playerId = randomId('p');
    const player: Player = { id: playerId, nickname: cleanNick(nickname), isHost: false, connected: true, score: 0 };
    room.state.players.push(player);
    this.broadcast(room.state.code);
    return { code: room.state.code, playerId };
  }

  rejoin(code: string, playerId: string): { code: string; playerId: string } {
    const room = this.requireRoom(code);
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) throw new GameError('That player is no longer in the room.');
    player.connected = true;
    this.broadcast(room.state.code);
    return { code: room.state.code, playerId };
  }

  markDisconnected(code: string, playerId: string): void {
    const room = this.getRoom(code);
    if (!room) return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (player) player.connected = false;
    this.maybeAutoReveal(room);
    this.broadcast(room.state.code);
  }

  setVoting(code: string, playerId: string, enabled: boolean): void {
    const room = this.requireHost(code, playerId);
    room.state.votingEnabled = enabled;
    this.broadcast(room.state.code);
  }

  // -------------------------------------------------------------------------
  // Rounds
  // -------------------------------------------------------------------------
  startRound(code: string, playerId: string, sourceId?: string): void {
    const room = this.requireHost(code, playerId);
    const source = this.pickSource(room, sourceId);
    if (!source) throw new GameError('No source images available. Seed bank is empty.');

    source.timesUsed += 1;
    room.usedSourceIds.push(source.id);

    const round: Round = {
      id: randomId('r'),
      sessionId: room.sessionId,
      sourceId: source.id,
      timerSeconds: computeTimerSeconds(source.wordCount),
      startedAt: Date.now(),
      submissions: [],
      revealIndex: 0,
      votingEnabled: room.state.votingEnabled,
      votes: {},
    };

    room.state.currentRound = round;
    room.state.currentSource = { ...source };
    room.state.roundNumber += 1;
    room.state.phase = 'round';

    // Schedule server-side fallback: force reveal shortly after the timer ends
    // (clients auto-submit at 0; the grace window lets those submissions land).
    this.clearAutoTimer(room);
    room.autoTimer = setTimeout(() => {
      if (room.state.phase === 'round' && room.state.currentRound?.id === round.id) {
        this.toReveal(room);
        this.broadcast(room.state.code);
      }
    }, round.timerSeconds * 1000 + AUTO_SUBMIT_GRACE_MS);

    this.broadcast(room.state.code);
  }

  submit(code: string, playerId: string, roundId: string, editedImageUrl: string): void {
    const room = this.requireRoom(code);
    const round = room.state.currentRound;
    if (!round || round.id !== roundId) return; // stale submit; ignore
    if (room.state.phase !== 'round') return;

    const existing = round.submissions.find((s) => s.playerId === playerId);
    if (existing) {
      existing.editedImageUrl = editedImageUrl; // allow overwrite until reveal
    } else {
      const submission: Submission = {
        id: randomId('s'),
        roundId: round.id,
        playerId,
        editedImageUrl,
        votesCount: 0,
      };
      round.submissions.push(submission);
    }

    this.maybeAutoReveal(room);
    this.broadcast(room.state.code);
  }

  advanceReveal(code: string, playerId: string, direction: 1 | -1 = 1): void {
    const room = this.requireHost(code, playerId);
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'reveal') return;
    const max = Math.max(0, round.submissions.length - 1);
    round.revealIndex = Math.min(max, Math.max(0, round.revealIndex + direction));
    this.broadcast(room.state.code);
  }

  castVote(code: string, playerId: string, submissionId: string): void {
    const room = this.requireRoom(code);
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'reveal' || !round.votingEnabled) return;
    const target = round.submissions.find((s) => s.id === submissionId);
    if (!target) return;
    if (target.playerId === playerId) return; // can't vote for yourself
    round.votes[playerId] = submissionId;
    // recompute counts
    for (const s of round.submissions) s.votesCount = 0;
    for (const chosen of Object.values(round.votes)) {
      const s = round.submissions.find((x) => x.id === chosen);
      if (s) s.votesCount += 1;
    }
    this.broadcast(room.state.code);
  }

  /** From reveal -> scoreboard: tally this round's votes into running scores. */
  showScoreboard(code: string, playerId: string): void {
    const room = this.requireHost(code, playerId);
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'reveal') return;
    if (round.votingEnabled) {
      for (const s of round.submissions) {
        const player = room.state.players.find((p) => p.id === s.playerId);
        if (player) player.score += s.votesCount;
      }
    }
    room.state.phase = 'scoreboard';
    this.clearAutoTimer(room);
    this.broadcast(room.state.code);
  }

  returnToLobby(code: string, playerId: string): void {
    const room = this.requireHost(code, playerId);
    room.state.phase = 'lobby';
    room.state.currentRound = null;
    room.state.currentSource = null;
    this.clearAutoTimer(room);
    this.broadcast(room.state.code);
  }

  // -------------------------------------------------------------------------
  // Internal transitions
  // -------------------------------------------------------------------------
  private maybeAutoReveal(room: Room): void {
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'round') return;
    const active = room.state.players.filter((p) => p.connected);
    const submittedIds = new Set(round.submissions.map((s) => s.playerId));
    const everyoneIn = active.length > 0 && active.every((p) => submittedIds.has(p.id));
    if (everyoneIn) this.toReveal(room);
  }

  private toReveal(room: Room): void {
    room.state.phase = 'reveal';
    if (room.state.currentRound) room.state.currentRound.revealIndex = 0;
    this.clearAutoTimer(room);
  }

  private pickSource(room: Room, sourceId?: string): Source | undefined {
    if (sourceId && this.sources.has(sourceId)) return this.sources.get(sourceId);
    const all = [...this.sources.values()];
    if (all.length === 0) return undefined;
    // Prefer sources not used yet in this room; fall back to least-recently used.
    const fresh = all.filter((s) => !room.usedSourceIds.includes(s.id));
    const pool = fresh.length > 0 ? fresh : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private clearAutoTimer(room: Room): void {
    if (room.autoTimer) {
      clearTimeout(room.autoTimer);
      room.autoTimer = undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------
  private requireRoom(code: string): Room {
    const room = this.getRoom(code);
    if (!room) throw new GameError(`Room "${code?.toUpperCase?.() ?? code}" not found.`);
    return room;
  }

  private requireHost(code: string, playerId: string): Room {
    const room = this.requireRoom(code);
    if (room.state.hostId !== playerId) throw new GameError('Only the host can do that.');
    return room;
  }
}

export class GameError extends Error {}

function cleanNick(nickname: string): string {
  const trimmed = (nickname ?? '').trim().slice(0, 20);
  return trimmed || 'Player';
}
