/**
 * Editor in Grief — shared domain model.
 *
 * This module is imported by BOTH the client (Vite) and the server (tsx),
 * so it must stay dependency-free and isomorphic.
 *
 * The data-model shapes below intentionally mirror the persistence schema the
 * game will eventually use (sources / sessions / rounds / submissions) so that
 * a real backend can be swapped in during Phases 3-4 without reshaping data.
 */

// ---------------------------------------------------------------------------
// Persistence-shaped domain model (kept faithful for future DB swap)
// ---------------------------------------------------------------------------

/** A source screenshot that gets redacted. */
export interface Source {
  id: string;
  uploadedBy: string | null; // player id, or null for seed/preset bank entries
  imageUrl: string; // URL path (seed bank) or data URL (uploaded)
  ocrText: string | null; // Phase 3 (OCR). null until then.
  wordCount: number; // rough estimate; only affects timer pacing
  createdAt: number; // epoch ms
  timesUsed: number;
}

/** A player's redacted result for a round. */
export interface Submission {
  id: string;
  roundId: string;
  playerId: string;
  editedImageUrl: string; // flattened PNG data URL
  /**
   * Number of redaction shapes at submit time (from the editor). Snapshot only —
   * cannot be recovered from the flattened PNG. Defaults to 0 for legacy payloads.
   */
  editCount: number;
  votesCount: number;
}

/** Host-facing round-length presets (lobby "Round length" control). */
export type TimerMode = 'quick' | 'normal' | 'long' | 'auto' | 'custom';

/** A single round within a session. */
export interface Round {
  id: string;
  sessionId: string;
  sourceId: string;
  timerSeconds: number;
  /**
   * Epoch ms when the synced 3-2-1-GO pre-round countdown began. Clients derive
   * the beat display from this (+ clock skew); the server advances to `round`
   * after {@link COUNTDOWN_SECONDS}.
   */
  countdownStartedAt: number;
  /**
   * Epoch ms when redaction / the round timer actually begins (end of countdown).
   * Clients derive the deadline bar from this once phase is `round`.
   */
  startedAt: number;
  // Round-mode config, snapshotted from the room settings at start (Batch 2):
  maxRedactions: number | null; // null = unlimited; otherwise cap on shapes/round
  /** Length preset snapshotted at start (for badges / copy). */
  timerMode: TimerMode;
  /**
   * True when the round has no deadline — advance when every connected player
   * has submitted. `timerSeconds` is 0 in this mode.
   */
  untimed: boolean;
  // Runtime-only fields (still safe to persist):
  submissions: Submission[];
  revealIndex: number; // which submission is currently shown at reveal
  votingEnabled: boolean;
  votes: Record<string, string>; // voterPlayerId -> submissionId
  /**
   * Emoji reactions on filed edits: submissionId → emoji → playerIds who reacted.
   * Synced during reveal and scoreboard so the room can react while browsing.
   */
  reactions: Record<string, Record<string, string[]>>;
}

/** Allowed reaction emojis (reveal + scoreboard). */
export const VERDICT_REACTION_EMOJIS = ['😂', '🔥', '💀', '👏'] as const;
export type VerdictReactionEmoji = (typeof VERDICT_REACTION_EMOJIS)[number];

/**
 * Host-configurable settings for the NEXT round(s). Persisted at the room level
 * (like {@link RoomState.votingEnabled}) and snapshotted onto each {@link Round}
 * when it starts, so every client sees the config via the full-state snapshot.
 */
export interface RoundSettings {
  /** Max redactions a player may draw per round. null = unlimited (default/off). */
  maxRedactions: number | null;
  /**
   * Round length preset. Ignored when {@link untimed} is on.
   * Default: `'auto'` (scales with source word count).
   */
  timerMode: TimerMode;
  /**
   * Duration when {@link timerMode} is `'custom'` (seconds). Clamped to
   * {@link CUSTOM_TIMER_MIN}–{@link CUSTOM_TIMER_MAX}.
   */
  customSeconds: number;
  /**
   * No countdown deadline — round ends when every connected player has
   * submitted (filed). Round length presets do not apply while this is on.
   */
  untimed: boolean;
}

/** A player in a session. */
export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  connected: boolean;
  score: number;
}

/** A play session (one lobby of players playing multiple rounds). */
export interface Session {
  id: string;
  createdAt: number;
  players: Player[];
}

/**
 * A client-side snapshot of one completed round, captured as rounds go by so we
 * can show an end-of-game recap and compose a shareable front-page export.
 *
 * The authoritative server state only ever holds the CURRENT round (Phase 1-2,
 * no persistence), so the client accumulates these from the full-state snapshots
 * it already receives — no backend/history storage required.
 *
 * PHASE 4 TODO: when a real datastore exists, source recaps from persisted
 * rounds/submissions instead of this in-tab accumulation.
 */
export interface RoundRecap {
  roundId: string;
  roundNumber: number;
  source: Source; // the original screenshot for the round
  submissions: Submission[]; // every player's redacted result
  votingEnabled: boolean;
  players: Pick<Player, 'id' | 'nickname'>[]; // byline lookup snapshot
}

// ---------------------------------------------------------------------------
// Game state machine
// ---------------------------------------------------------------------------

export type Phase =
  | 'lobby' // waiting for players; host can start
  | 'countdown' // synced 3-2-1-GO before redaction; timer not yet running
  | 'round' // everyone redacting their own copy
  | 'reveal' // submissions revealed one at a time, synced to all
  | 'voting' // all submissions shown together for a private ballot
  | 'scoreboard'; // between-round / end summary

/**
 * The full authoritative room state. The server owns one of these per room and
 * broadcasts a snapshot to every connected client on any change (full-state
 * sync — simplest robust approach for an MVP party game).
 */
export interface RoomState {
  code: string;
  phase: Phase;
  hostId: string;
  players: Player[];
  votingEnabled: boolean; // room-level setting (off by default)
  maxPlayers: number; // host-configured room capacity (default DEFAULT_MAX_PLAYERS)
  roundSettings: RoundSettings; // host-configured settings for the next round
  roundNumber: number;
  /** The source chosen for the current/most-recent round (denormalized for clients). */
  currentSource: Source | null;
  /** Screenshots filed by players for this session's upcoming rounds. */
  pendingSources: Source[];
  /** Each player can endorse one filed source; changing a vote replaces their old one. */
  sourceVotes: Record<string, string>;
  /** The host's explicit choice for the next round, if any. */
  selectedSourceId: string | null;
  currentRound: Round | null;
  serverTime: number; // epoch ms at snapshot; lets clients correct for clock skew
}

// ---------------------------------------------------------------------------
// Realtime message protocol (client <-> server)
// ---------------------------------------------------------------------------

export interface SeedSource {
  id: string;
  imageUrl: string;
  wordCount: number;
  label: string;
}

/** Messages sent FROM a client TO the server. */
export type ClientMessage =
  | { type: 'createRoom'; nickname: string }
  | { type: 'joinRoom'; code: string; nickname: string }
  | { type: 'rejoin'; code: string; playerId: string } // reconnect support
  | { type: 'removePlayer'; playerId: string } // host only
  | { type: 'setVoting'; enabled: boolean } // host only
  | { type: 'setMaxPlayers'; max: number } // host only; clamped to MIN/MAX_PLAYERS
  | { type: 'setRoundSettings'; settings: Partial<RoundSettings> } // host only
  // Players can file multiple screenshots for later rounds. Image travels as a
  // downscaled data URL through the same WS channel and lives for the session.
  | { type: 'uploadSource'; imageUrl: string; wordCount: number; ocrText: string | null }
  | { type: 'clearSource'; sourceId: string }
  | { type: 'voteForSource'; sourceId: string | null } // null clears your vote
  | { type: 'selectSource'; sourceId: string | null } // host only
  | { type: 'startRound'; sourceId?: string } // host only; sourceId optional (else random from bank)
  | { type: 'submit'; roundId: string; editedImageUrl: string; editCount: number }
  /** Withdraw Ready during an active round so the player can keep editing. */
  | { type: 'unsubmit'; roundId: string }
  | { type: 'advanceReveal'; direction?: 1 | -1 } // host only
  | { type: 'beginVoting' } // host only; reveal -> ballot when voting is enabled
  | { type: 'forceReveal' } // host only; skip waiting (e.g. AFK during untimed)
  | { type: 'castVote'; submissionId: string | null } // null clears your vote
  | { type: 'react'; submissionId: string; emoji: VerdictReactionEmoji } // reveal/scoreboard toggle
  | { type: 'nextRound' } // host only; ballot/reveal -> scoreboard (tallies votes)
  | { type: 'returnToLobby' }; // host only; scoreboard/any -> lobby (fresh upload window)

/** Messages sent FROM the server TO clients. */
export type ServerMessage =
  | { type: 'joined'; playerId: string; code: string } // ack for create/join/rejoin
  | { type: 'state'; state: RoomState } // full-state snapshot
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Fixed preset durations (seconds). */
export const TIMER_QUICK_SECONDS = 60;
export const TIMER_NORMAL_SECONDS = 180;
export const TIMER_LONG_SECONDS = 600;

/** Auto linear fit: base + seconds-per-word (see {@link computeTimerSeconds}). */
export const AUTO_TIMER_BASE_SECONDS = 55;
export const AUTO_SECONDS_PER_WORD = 2.17;

/** Auto formula floor / ceiling (seconds). */
export const AUTO_TIMER_MIN = 60;
export const AUTO_TIMER_MAX = 600;

/**
 * Auto round-length formula (when {@link TimerMode} is `'auto'`).
 *
 *   timer_seconds = clamp(55 + 2.17 * word_count, 60, 600)
 *
 * Tuned so ~30 words ≈ 2 minutes and ~113 words ≈ 5 minutes. Floor 60s so
 * Auto never feels rushed; ceiling matches Long / Custom max (10 minutes).
 * word_count is a rough estimate from the image (seed metadata or client
 * text-read at upload). Fixed presets and Custom bypass this
 * (see {@link resolveRoundTimerSeconds}).
 */
export function computeTimerSeconds(wordCount: number): number {
  const raw = AUTO_TIMER_BASE_SECONDS + AUTO_SECONDS_PER_WORD * wordCount;
  return Math.round(Math.min(AUTO_TIMER_MAX, Math.max(AUTO_TIMER_MIN, raw)));
}

/** Custom time-picker bounds (seconds). */
export const CUSTOM_TIMER_MIN = 30;
export const CUSTOM_TIMER_MAX = 600;

/** Room capacity bounds + default. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 24;
export const DEFAULT_MAX_PLAYERS = 10;

/** Clamp a host-chosen room capacity into sane bounds. */
export function clampMaxPlayers(max: number): number {
  if (!Number.isFinite(max)) return DEFAULT_MAX_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(max)));
}

/** @deprecated Use TIMER_QUICK_SECONDS. Kept so older imports don't break mid-refactor. */
export const QUICKFIRE_SECONDS = TIMER_QUICK_SECONDS;
/** @deprecated Use AUTO_TIMER_MIN. */
export const NORMAL_TIMER_MIN = AUTO_TIMER_MIN;
/** @deprecated Use TIMER_LONG_SECONDS / CUSTOM_TIMER_MAX as appropriate. */
export const NORMAL_TIMER_MAX = TIMER_LONG_SECONDS;

/** Synced pre-round countdown length (3 → 2 → 1 → GO, one second each). */
export const COUNTDOWN_SECONDS = 4;

/** Clamp a host-chosen custom duration into sane bounds. */
export function clampCustomTimerSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return TIMER_NORMAL_SECONDS;
  return Math.min(CUSTOM_TIMER_MAX, Math.max(CUSTOM_TIMER_MIN, Math.round(seconds)));
}

/** @deprecated Use {@link clampCustomTimerSeconds}. */
export function clampNormalTimerSeconds(seconds: number): number {
  return clampCustomTimerSeconds(seconds);
}

/**
 * Resolve the timer that will be snapshotted onto the next round.
 * Untimed rounds return 0 (no deadline). Otherwise: Quick / Normal / Long /
 * Custom presets, or Auto from word count.
 */
export function resolveRoundTimerSeconds(
  settings: Pick<RoundSettings, 'timerMode' | 'customSeconds' | 'untimed'>,
  wordCount: number,
): number {
  if (settings.untimed) return 0;
  switch (settings.timerMode) {
    case 'quick':
      return TIMER_QUICK_SECONDS;
    case 'normal':
      return TIMER_NORMAL_SECONDS;
    case 'long':
      return TIMER_LONG_SECONDS;
    case 'custom':
      return clampCustomTimerSeconds(settings.customSeconds);
    case 'auto':
    default:
      return computeTimerSeconds(wordCount);
  }
}

/** Human label for a timer mode (lobby / round badges). */
export function timerModeLabel(mode: TimerMode): string {
  switch (mode) {
    case 'quick':
      return 'Quick';
    case 'normal':
      return 'Normal';
    case 'long':
      return 'Long';
    case 'auto':
      return 'Auto';
    case 'custom':
      return 'Custom';
  }
}

/** Compact duration for round toast (e.g. "30s", "2m", "No limit"). */
export function formatRoundDuration(seconds: number, untimed: boolean): string {
  if (untimed || seconds <= 0) return 'No limit';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export const WS_PORT = 8787;
