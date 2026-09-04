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
  COUNTDOWN_SECONDS,
  DEFAULT_MAX_PLAYERS,
  TIMER_NORMAL_SECONDS,
  clampCustomTimerSeconds,
  clampMaxPlayers,
  resolveRoundTimerSeconds,
  type Player,
  type Round,
  type RoomState,
  type RoundSettings,
  type SeedSource,
  type Source,
  type Submission,
  type TimerMode,
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
  /** Ends the synced 3-2-1-GO and enters the active redaction phase. */
  countdownTimer?: ReturnType<typeof setTimeout>;
  /** Authoritative round-deadline timer → force reveal (+ grace for late submits). */
  autoTimer?: ReturnType<typeof setTimeout>;
  /** Per-player timers that let the round progress if a disconnect is not brief. */
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** Pending host-transfer timer while a disconnected host is within their grace. */
  hostGraceTimer?: ReturnType<typeof setTimeout>;
}

/** Extra window after the deadline so client auto-submits can still land. */
const AUTO_SUBMIT_GRACE_MS = 2500;
/**
 * Reconnect/session policy (Batch 3):
 * - A disconnect never removes a player or their submission; we only flip
 *   `connected=false` and keep the slot so they can rejoin the same room and
 *   resume the current phase.
 * - During an active round we wait PLAYER_DISCONNECT_GRACE_MS before letting the
 *   round advance without them (so a brief wifi hiccup doesn't skip their turn).
 * - If the HOST disconnects we keep the room alive and, after
 *   HOST_GRACE_MS, transfer host to the longest-standing connected player. If the
 *   original host rejoins within the grace window they stay host.
 */
const PLAYER_DISCONNECT_GRACE_MS = 20000;
const HOST_GRACE_MS = 30000;

const DEFAULT_ROUND_SETTINGS: RoundSettings = {
  maxRedactions: null,
  timerMode: 'normal',
  customSeconds: TIMER_NORMAL_SECONDS,
  untimed: false,
};

const TIMER_MODES: ReadonlySet<TimerMode> = new Set(['quick', 'normal', 'long', 'auto', 'custom']);

/** The Lobby's source shelf always shows at least this many candidates —
 * real uploads first, wire-bank "filler" sources (Source.uploadedBy = null)
 * padding the rest. Fillers shrink to nothing once uploads reach the floor. */
const MIN_SHELF_SOURCES = 2;

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
    this.normalizeRoomSettings(room);
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
      maxPlayers: DEFAULT_MAX_PLAYERS,
      roundSettings: { ...DEFAULT_ROUND_SETTINGS },
      roundNumber: 0,
      currentSource: null,
      pendingSources: [],
      sourceVotes: {},
      selectedSourceId: null,
      currentRound: null,
      serverTime: Date.now(),
    };
    const room: Room = {
      state,
      sessionId: randomId('sess'),
      usedSourceIds: [],
      disconnectTimers: new Map(),
    };
    this.rooms.set(code, room);
    this.syncFillerSlots(room, { refresh: true });
    return { code, playerId };
  }

  joinRoom(code: string, nickname: string): { code: string; playerId: string } {
    const room = this.requireRoom(code);
    if (room.state.players.length >= room.state.maxPlayers) {
      throw new GameError(`Room "${room.state.code}" is full (max ${room.state.maxPlayers} players).`);
    }
    const playerId = randomId('p');
    const player: Player = { id: playerId, nickname: cleanNick(nickname), isHost: false, connected: true, score: 0 };
    room.state.players.push(player);
    return { code: room.state.code, playerId };
  }

  rejoin(code: string, playerId: string): { code: string; playerId: string } {
    const room = this.requireRoom(code);
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) throw new GameError('That player is no longer in the room.');
    player.connected = true;
    // Cancel any pending grace timers now that they're back.
    const dt = room.disconnectTimers.get(playerId);
    if (dt) {
      clearTimeout(dt);
      room.disconnectTimers.delete(playerId);
    }
    // If this player is still the host, their grace window can be cancelled.
    if (room.state.hostId === playerId && room.hostGraceTimer) {
      clearTimeout(room.hostGraceTimer);
      room.hostGraceTimer = undefined;
    }
    return { code: room.state.code, playerId };
  }

  /** Host-only cleanup for duplicate/abandoned player slots. */
  removePlayer(code: string, hostId: string, targetId: string): void {
    const room = this.requireHost(code, hostId);
    if (targetId === hostId || targetId === room.state.hostId) {
      throw new GameError('The Host cannot be removed from the room.');
    }
    if (!room.state.players.some((player) => player.id === targetId)) {
      throw new GameError('That player is no longer in the room.');
    }

    room.state.players = room.state.players.filter((player) => player.id !== targetId);
    const disconnectTimer = room.disconnectTimers.get(targetId);
    if (disconnectTimer) clearTimeout(disconnectTimer);
    room.disconnectTimers.delete(targetId);

    const round = room.state.currentRound;
    if (round) {
      const removedSubmissionIds = new Set(
        round.submissions.filter((submission) => submission.playerId === targetId).map((submission) => submission.id),
      );
      round.submissions = round.submissions.filter((submission) => submission.playerId !== targetId);
      for (const [voterId, submissionId] of Object.entries(round.votes)) {
        if (voterId === targetId || removedSubmissionIds.has(submissionId)) delete round.votes[voterId];
      }
      for (const submission of round.submissions) submission.votesCount = 0;
      for (const chosenId of Object.values(round.votes)) {
        const chosen = round.submissions.find((submission) => submission.id === chosenId);
        if (chosen) chosen.votesCount += 1;
      }
    }

    const removedSourceIds = new Set(
      room.state.pendingSources.filter((source) => source.uploadedBy === targetId).map((source) => source.id),
    );
    room.state.pendingSources = room.state.pendingSources.filter((source) => source.uploadedBy !== targetId);
    for (const sourceId of removedSourceIds) this.sources.delete(sourceId);
    for (const [voterId, sourceId] of Object.entries(room.state.sourceVotes)) {
      if (voterId === targetId || removedSourceIds.has(sourceId)) delete room.state.sourceVotes[voterId];
    }
    if (room.state.selectedSourceId && removedSourceIds.has(room.state.selectedSourceId)) {
      room.state.selectedSourceId = null;
    }

    this.maybeAutoReveal(room);
  }

  markDisconnected(code: string, playerId: string): void {
    const room = this.getRoom(code);
    if (!room) return;
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    player.connected = false;

    // Host disconnect: keep the room alive; transfer host after a grace window
    // unless they reconnect first.
    if (room.state.hostId === playerId) this.scheduleHostTransfer(room);

    // During countdown/round, don't advance immediately on a drop — give the
    // player a grace window to reconnect. If they're still gone when it elapses,
    // let the round proceed without them (once redaction is active).
    if (room.state.phase === 'round' || room.state.phase === 'countdown') {
      const existing = room.disconnectTimers.get(playerId);
      if (existing) clearTimeout(existing);
      room.disconnectTimers.set(
        playerId,
        setTimeout(() => {
          room.disconnectTimers.delete(playerId);
          if (room.state.phase === 'round') {
            this.maybeAutoReveal(room);
            this.broadcast(room.state.code);
          }
        }, PLAYER_DISCONNECT_GRACE_MS),
      );
    }
    this.broadcast(room.state.code);
  }

  private scheduleHostTransfer(room: Room): void {
    if (room.hostGraceTimer) clearTimeout(room.hostGraceTimer);
    room.hostGraceTimer = setTimeout(() => {
      room.hostGraceTimer = undefined;
      const host = room.state.players.find((p) => p.id === room.state.hostId);
      if (host && host.connected) return; // reconnected in time
      // Transfer to the longest-standing connected player (players are in join order).
      const next = room.state.players.find((p) => p.connected && p.id !== room.state.hostId);
      if (!next) return; // nobody to hand off to; leave room as-is until someone returns
      if (host) host.isHost = false;
      next.isHost = true;
      room.state.hostId = next.id;
      this.broadcast(room.state.code);
    }, HOST_GRACE_MS);
  }

  setVoting(code: string, playerId: string, enabled: boolean): void {
    const room = this.requireHost(code, playerId);
    room.state.votingEnabled = enabled;
    this.broadcast(room.state.code);
  }

  /** Never lowers below the room's current connected player count — a host
   * shrinking the cap can't accidentally strand someone already seated. */
  setMaxPlayers(code: string, playerId: string, max: number): void {
    const room = this.requireHost(code, playerId);
    const floor = Math.max(room.state.players.length, 1);
    room.state.maxPlayers = Math.max(floor, clampMaxPlayers(max));
    this.broadcast(room.state.code);
  }

  setRoundSettings(code: string, playerId: string, settings: Partial<RoundSettings>): void {
    const room = this.requireHost(code, playerId);
    this.normalizeRoomSettings(room);
    const current = room.state.roundSettings;
    const next: RoundSettings = { ...current };
    if ('maxRedactions' in settings) {
      const v = settings.maxRedactions;
      // Clamp to a sane positive range; null/invalid = unlimited.
      next.maxRedactions = v == null || !Number.isFinite(v) || v <= 0 ? null : Math.min(99, Math.floor(v));
    }
    if ('timerMode' in settings && settings.timerMode != null && TIMER_MODES.has(settings.timerMode)) {
      next.timerMode = settings.timerMode;
    }
    if ('customSeconds' in settings) {
      next.customSeconds = clampCustomTimerSeconds(Number(settings.customSeconds));
    }
    if ('untimed' in settings) next.untimed = !!settings.untimed;
    room.state.roundSettings = next;
    this.broadcast(room.state.code);
  }

  // -------------------------------------------------------------------------
  // Source filing (pre-round window). Every player can add screenshots for the
  // session; the host selects a source or lets the room's votes decide.
  // -------------------------------------------------------------------------
  uploadSource(
    code: string,
    playerId: string,
    imageUrl: string,
    wordCount: number,
    ocrText: string | null,
  ): void {
    const room = this.requireRoom(code);
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) throw new GameError('That player is no longer in the room.');
    if (room.state.phase !== 'lobby') throw new GameError('You can only upload while in the lobby.');
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image/')) {
      throw new GameError('Unsupported image data.');
    }
    // Guard against absurd payloads (base64 is ~1.37x raw bytes). ~8MB data URL.
    if (imageUrl.length > 8_000_000) {
      throw new GameError('That image is too large — try a smaller screenshot.');
    }
    const wc = Number.isFinite(wordCount) ? Math.max(0, Math.min(2000, Math.floor(wordCount))) : 0;
    const source: Source = {
      id: randomId('src'),
      uploadedBy: playerId,
      imageUrl,
      ocrText: ocrText ?? null,
      wordCount: wc,
      createdAt: Date.now(),
      timesUsed: 0,
    };
    this.sources.set(source.id, source);
    // Filing a screenshot always just ADDS a new candidate to the shelf — it
    // never displaces an existing wire-photo filler. syncFillerSlots is only
    // a safety top-up here (a no-op once the floor is already met, which it
    // always is once any filler exists).
    room.state.pendingSources.push({ ...source });
    this.syncFillerSlots(room);
    this.broadcast(room.state.code);
  }

  clearSource(code: string, playerId: string, sourceId: string): void {
    const room = this.requireRoom(code);
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) return;
    if (room.state.phase !== 'lobby') throw new GameError('You can only remove sources in the lobby.');
    const index = room.state.pendingSources.findIndex((source) => source.id === sourceId);
    if (index === -1) return;
    const pending = room.state.pendingSources[index];
    if (pending.uploadedBy !== playerId && room.state.hostId !== playerId) {
      throw new GameError('You can only remove your own filed image.');
    }
    // Only forget a REAL upload permanently. A wire-photo filler's id is a
    // seed-bank entry loaded once at startup and shared across every room —
    // deleting it from the registry here would remove it globally forever.
    // "Remove" on a filler card is really "shuffle" (syncFillerSlots below
    // immediately repicks a replacement), so the seed itself must survive.
    if (pending.uploadedBy != null) this.sources.delete(pending.id);
    const next = room.state.pendingSources.slice();
    next.splice(index, 1);
    room.state.pendingSources = next;
    for (const [voterId, votedId] of Object.entries(room.state.sourceVotes)) {
      if (votedId === sourceId) delete room.state.sourceVotes[voterId];
    }
    if (room.state.selectedSourceId === sourceId) room.state.selectedSourceId = null;
    // Backfill (if needed) at the vacated index — keeps every OTHER card's
    // slot stable, so shuffling/removing one card never visibly touches
    // its neighbor (see syncFillerSlots).
    this.syncFillerSlots(room, { insertAt: index });
    this.broadcast(room.state.code);
  }

  voteForSource(code: string, playerId: string, sourceId: string | null): void {
    const room = this.requireRoom(code);
    if (room.state.phase !== 'lobby') throw new GameError('Vote for the next image while in the lobby.');
    if (!room.state.players.some((p) => p.id === playerId)) throw new GameError('That player is no longer in the room.');
    if (sourceId == null) {
      delete room.state.sourceVotes[playerId];
      this.broadcast(room.state.code);
      return;
    }
    if (!room.state.pendingSources.some((source) => source.id === sourceId)) throw new GameError('That image is no longer available.');
    room.state.sourceVotes[playerId] = sourceId;
    this.broadcast(room.state.code);
  }

  selectSource(code: string, playerId: string, sourceId: string | null): void {
    const room = this.requireHost(code, playerId);
    if (room.state.phase !== 'lobby') throw new GameError('Choose the next image while in the lobby.');
    // Validate against the full registry (seed bank + every upload ever seen),
    // not just this room's pendingSources — lets the host lock in a seed-bank
    // pick too (the Lobby's "shuffle a wire photo" affordance), not only an
    // uploaded one.
    if (sourceId != null && !this.sources.has(sourceId)) {
      throw new GameError('That image is no longer available.');
    }
    room.state.selectedSourceId = sourceId;
    this.broadcast(room.state.code);
  }

  // -------------------------------------------------------------------------
  // Rounds
  // -------------------------------------------------------------------------
  startRound(code: string, playerId: string, sourceId?: string): void {
    const room = this.requireHost(code, playerId);
    this.normalizeRoomSettings(room);
    // Host starts from the lobby after staging a fresh upload / bank pick.
    // Scoreboard only offers "Play again" → returnToLobby (never skip the lobby).
    if (room.state.phase !== 'lobby') {
      throw new GameError('You can only start a round from the lobby.');
    }
    const source = this.pickSource(room, sourceId);
    if (!source) throw new GameError('No source images available. Seed bank is empty.');

    source.timesUsed += 1;
    room.usedSourceIds.push(source.id);

    const settings = room.state.roundSettings;
    const timerSeconds = resolveRoundTimerSeconds(settings, source.wordCount);
    const now = Date.now();

    const round: Round = {
      id: randomId('r'),
      sessionId: room.sessionId,
      sourceId: source.id,
      timerSeconds,
      countdownStartedAt: now,
      startedAt: now + COUNTDOWN_SECONDS * 1000,
      maxRedactions: settings.maxRedactions,
      timerMode: settings.timerMode,
      untimed: settings.untimed,
      submissions: [],
      revealIndex: 0,
      votingEnabled: room.state.votingEnabled,
      votes: {},
    };

    room.state.currentRound = round;
    room.state.currentSource = { ...source };
    room.state.roundNumber += 1;
    room.state.phase = 'countdown';
    // Keep filed sources around for later rounds; only clear the one-shot choice.
    room.state.selectedSourceId = null;
    // A vote has done its job once that image is played. Votes for the remaining
    // shelf stay intact, making it easy to queue up later rounds.
    for (const [voterId, votedId] of Object.entries(room.state.sourceVotes)) {
      if (votedId === source.id) delete room.state.sourceVotes[voterId];
    }

    // Synced pre-round countdown, then begin redaction + deadline timer.
    this.clearPhaseTimers(room);
    room.countdownTimer = setTimeout(() => {
      room.countdownTimer = undefined;
      if (room.state.phase === 'countdown' && room.state.currentRound?.id === round.id) {
        this.beginRedaction(room);
        this.broadcast(room.state.code);
      }
    }, COUNTDOWN_SECONDS * 1000);

    this.broadcast(room.state.code);
  }

  submit(code: string, playerId: string, roundId: string, editedImageUrl: string): void {
    const room = this.requireRoom(code);
    const round = room.state.currentRound;
    if (!round || round.id !== roundId) return; // stale submit; ignore

    // Active redaction: normal submit (+ overwrite until reveal).
    if (room.state.phase === 'round') {
      this.upsertSubmission(round, playerId, editedImageUrl);
      this.maybeAutoReveal(room);
      this.broadcast(room.state.code);
      return;
    }

    // Late / auto-submit that arrived after the authoritative deadline flipped us
    // to reveal — still accept a first submission so the player isn't missing.
    if (room.state.phase === 'reveal') {
      const existing = round.submissions.find((s) => s.playerId === playerId);
      if (existing) return;
      this.upsertSubmission(round, playerId, editedImageUrl);
      this.broadcast(room.state.code);
    }
  }

  advanceReveal(code: string, playerId: string, direction: 1 | -1 = 1): void {
    const room = this.requireHost(code, playerId);
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'reveal') return;
    const max = Math.max(0, round.submissions.length - 1);
    round.revealIndex = Math.min(max, Math.max(0, round.revealIndex + direction));
    this.broadcast(room.state.code);
  }

  /** The reveal is presentation-only. The host explicitly opens the ballot after it. */
  beginVoting(code: string, playerId: string): void {
    const room = this.requireHost(code, playerId);
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'reveal' || !round.votingEnabled) return;
    room.state.phase = 'voting';
    this.broadcast(room.state.code);
  }

  /** Host skips waiting for remaining players (untimed AFK escape hatch). */
  forceReveal(code: string, playerId: string): void {
    const room = this.requireHost(code, playerId);
    if (room.state.phase !== 'round') return;
    this.toReveal(room);
    this.broadcast(room.state.code);
  }

  castVote(code: string, playerId: string, submissionId: string): void {
    const room = this.requireRoom(code);
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'voting' || !round.votingEnabled) return;
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

  /** From the ballot (or a no-voting reveal) -> scoreboard: tally this round. */
  showScoreboard(code: string, playerId: string): void {
    const room = this.requireHost(code, playerId);
    const round = room.state.currentRound;
    if (!round || (room.state.phase !== 'reveal' && room.state.phase !== 'voting')) return;
    if (round.votingEnabled && room.state.phase !== 'voting') return;
    if (round.votingEnabled) {
      for (const s of round.submissions) {
        const player = room.state.players.find((p) => p.id === s.playerId);
        if (player) player.score += s.votesCount;
      }
    }
    room.state.phase = 'scoreboard';
    this.clearPhaseTimers(room);
    this.broadcast(room.state.code);
  }

  returnToLobby(code: string, playerId: string): void {
    const room = this.requireHost(code, playerId);
    room.state.phase = 'lobby';
    room.state.currentRound = null;
    room.state.currentSource = null;
    this.clearPhaseTimers(room);
    // Fresh wire-photo suggestions each time the table's back deciding what's
    // next — a filler is a suggestion, not a filing, so it doesn't linger
    // stale across rounds the way a real upload does.
    this.syncFillerSlots(room, { refresh: true });
    this.broadcast(room.state.code);
  }

  // -------------------------------------------------------------------------
  // Internal transitions
  // -------------------------------------------------------------------------
  /** Countdown finished → active redaction (+ authoritative deadline when timed). */
  private beginRedaction(room: Room): void {
    const round = room.state.currentRound;
    if (!round || room.state.phase !== 'countdown') return;
    room.state.phase = 'round';
    // Align startedAt to "now" so clock skew / timer drift during countdown
    // doesn't eat into the redaction window.
    round.startedAt = Date.now();

    this.clearPhaseTimers(room);
    // Untimed / ready-up: no deadline — reveal when everyone has submitted.
    if (round.untimed || round.timerSeconds <= 0) return;

    room.autoTimer = setTimeout(() => {
      if (room.state.phase === 'round' && room.state.currentRound?.id === round.id) {
        this.toReveal(room);
        this.broadcast(room.state.code);
      }
    }, round.timerSeconds * 1000 + AUTO_SUBMIT_GRACE_MS);
  }

  private upsertSubmission(round: Round, playerId: string, editedImageUrl: string): void {
    const existing = round.submissions.find((s) => s.playerId === playerId);
    if (existing) {
      existing.editedImageUrl = editedImageUrl; // allow overwrite until reveal
      return;
    }
    const submission: Submission = {
      id: randomId('s'),
      roundId: round.id,
      playerId,
      editedImageUrl,
      votesCount: 0,
    };
    round.submissions.push(submission);
  }

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
    this.clearPhaseTimers(room);
  }

  private pickSource(room: Room, sourceId?: string): Source | undefined {
    if (sourceId && this.sources.has(sourceId)) return this.sources.get(sourceId);
    if (room.state.selectedSourceId && this.sources.has(room.state.selectedSourceId)) {
      return this.sources.get(room.state.selectedSourceId);
    }
    // When the host has not picked, choose the room's most-voted filed image.
    const voteCounts = new Map<string, number>();
    for (const sourceId of Object.values(room.state.sourceVotes)) {
      voteCounts.set(sourceId, (voteCounts.get(sourceId) ?? 0) + 1);
    }
    const voted = room.state.pendingSources
      .map((source) => ({ source, votes: voteCounts.get(source.id) ?? 0 }))
      .filter((entry) => entry.votes > 0)
      .sort((a, b) => b.votes - a.votes || a.source.createdAt - b.source.createdAt)[0]?.source;
    if (voted && this.sources.has(voted.id)) return this.sources.get(voted.id);
    // Prefer the room's OWN shelf (what's actually on screen — real uploads +
    // wire-photo fillers) over the entire cross-room source registry; falls
    // back to the registry only if the shelf is somehow empty (shouldn't
    // happen once syncFillerSlots keeps it topped up, but stay safe).
    const shelf = room.state.pendingSources.map((s) => this.sources.get(s.id)).filter((s): s is Source => !!s);
    const all = shelf.length > 0 ? shelf : [...this.sources.values()];
    if (all.length === 0) return undefined;
    // Prefer sources not used yet in this room; fall back to least-recently used.
    const fresh = all.filter((s) => !room.usedSourceIds.includes(s.id));
    const pool = fresh.length > 0 ? fresh : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Keeps the Lobby's source shelf at ≥MIN_SHELF_SOURCES by topping up with
   * wire-bank "filler" sources (uploadedBy = null) — never trims. Filing a
   * screenshot always just ADDS a new candidate; a filler only ever leaves
   * the shelf via an explicit Shuffle/Remove. `refresh` discards existing
   * fillers first (a fresh suggestion each time the room lands back in an
   * under-filled Lobby). `insertAt`, when given, splices any newly-picked
   * fillers in at that index instead of appending at the end — used after a
   * removal so the backfill lands in the vacated slot and every OTHER card
   * keeps its exact position (shuffling one card must never visibly move or
   * change its neighbor). */
  private syncFillerSlots(room: Room, opts: { refresh?: boolean; insertAt?: number } = {}): void {
    let pending = room.state.pendingSources;
    if (opts.refresh) pending = pending.filter((s) => s.uploadedBy != null);
    const shortfall = Math.max(0, MIN_SHELF_SOURCES - pending.length);
    if (shortfall === 0) {
      room.state.pendingSources = pending;
      return;
    }
    const shownIds = new Set(pending.map((s) => s.id));
    const added = this.pickDistinctSeeds(room, shortfall, shownIds);
    const at = opts.insertAt != null ? Math.min(Math.max(0, opts.insertAt), pending.length) : pending.length;
    const next = pending.slice();
    next.splice(at, 0, ...added);
    room.state.pendingSources = next;
  }

  /** `count` distinct seed-bank sources not already shown, preferring ones
   * this room hasn't used yet. */
  private pickDistinctSeeds(room: Room, count: number, excludeIds: Set<string>): Source[] {
    if (count <= 0) return [];
    const candidates = this.seedBank.filter((s) => !excludeIds.has(s.id));
    const unused = candidates.filter((s) => !room.usedSourceIds.includes(s.id));
    const pool = unused.length >= count ? unused : candidates;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked: Source[] = [];
    for (const seed of shuffled.slice(0, count)) {
      const src = this.sources.get(seed.id);
      if (src) picked.push({ ...src });
    }
    return picked;
  }

  private clearPhaseTimers(room: Room): void {
    if (room.countdownTimer) {
      clearTimeout(room.countdownTimer);
      room.countdownTimer = undefined;
    }
    if (room.autoTimer) {
      clearTimeout(room.autoTimer);
      room.autoTimer = undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------
  /**
   * Migrate legacy in-memory rooms that still have quickFire / timerSeconds
   * onto the Round length model so hot-reloads don't break live lobbies.
   */
  private normalizeRoomSettings(room: Room): void {
    room.state.roundSettings = normalizeRoundSettings(room.state.roundSettings as RoundSettings & Record<string, unknown>);
    if (room.state.maxPlayers == null) room.state.maxPlayers = DEFAULT_MAX_PLAYERS;
    const round = room.state.currentRound;
    if (!round) return;
    const legacy = round as Round & { quickFire?: boolean };
    if (legacy.timerMode == null) {
      legacy.timerMode = legacy.quickFire ? 'quick' : 'normal';
    }
    if (legacy.untimed == null) legacy.untimed = false;
  }

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

/** Coerce legacy or partial settings into the current RoundSettings shape. */
function normalizeRoundSettings(raw: RoundSettings & Record<string, unknown>): RoundSettings {
  const maxRaw = raw?.maxRedactions;
  const maxRedactions =
    maxRaw == null || !Number.isFinite(maxRaw) || (maxRaw as number) <= 0
      ? null
      : Math.min(99, Math.floor(maxRaw as number));

  let timerMode: TimerMode = 'normal';
  if (raw?.timerMode && TIMER_MODES.has(raw.timerMode as TimerMode)) {
    timerMode = raw.timerMode as TimerMode;
  } else if (raw && 'quickFire' in raw && raw.quickFire) {
    timerMode = 'quick';
  } else if (raw && 'timerSeconds' in raw) {
    const ts = raw.timerSeconds as number | null | undefined;
    if (ts == null) timerMode = 'auto';
    else if (ts === 30 || ts === 25) timerMode = 'quick';
    else if (ts === 120) timerMode = 'normal';
    else if (ts === 300) timerMode = 'long';
    else timerMode = 'custom';
  }

  let customSeconds = TIMER_NORMAL_SECONDS;
  if (typeof raw?.customSeconds === 'number' && Number.isFinite(raw.customSeconds)) {
    customSeconds = clampCustomTimerSeconds(raw.customSeconds);
  } else if (typeof raw?.timerSeconds === 'number' && Number.isFinite(raw.timerSeconds)) {
    customSeconds = clampCustomTimerSeconds(raw.timerSeconds as number);
  }

  const untimed = !!(raw && 'untimed' in raw ? raw.untimed : false);

  return { maxRedactions, timerMode, customSeconds, untimed };
}
