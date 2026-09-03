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
  votesCount: number;
}

/** A single round within a session. */
export interface Round {
  id: string;
  sessionId: string;
  sourceId: string;
  timerSeconds: number;
  startedAt: number; // epoch ms; clients derive their own countdown from this
  // Round-mode config, snapshotted from the room settings at start (Batch 2):
  maxRedactions: number | null; // null = unlimited; otherwise cap on shapes/round
  quickFire: boolean; // true = short fixed timer for fast pacing
  // Runtime-only fields (still safe to persist):
  submissions: Submission[];
  revealIndex: number; // which submission is currently shown at reveal
  votingEnabled: boolean;
  votes: Record<string, string>; // voterPlayerId -> submissionId
}

/**
 * Host-configurable settings for the NEXT round(s). Persisted at the room level
 * (like {@link RoomState.votingEnabled}) and snapshotted onto each {@link Round}
 * when it starts, so every client sees the config via the full-state snapshot.
 */
export interface RoundSettings {
  /** Max redactions a player may draw per round. null = unlimited (default/off). */
  maxRedactions: number | null;
  /** Quick-fire mode: a short fixed timer overriding the word-count formula. */
  quickFire: boolean;
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
  | 'round' // everyone redacting their own copy
  | 'reveal' // submissions revealed one at a time, synced to all
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
  roundSettings: RoundSettings; // host-configured settings for the next round
  roundNumber: number;
  /** The source chosen for the current/most-recent round (denormalized for clients). */
  currentSource: Source | null;
  /**
   * A source uploaded during the lobby pre-round window, previewed to everyone.
   * When set, the next round uses it instead of pulling a random seed. Cleared
   * back to null (revert to seed bank) when a round starts or the uploader clears it.
   */
  pendingSource: Source | null;
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
  | { type: 'setVoting'; enabled: boolean } // host only
  | { type: 'setRoundSettings'; settings: Partial<RoundSettings> } // host only
  // Pre-round upload (Phase 3 pulled forward): any player may stage a screenshot
  // as the next round's source. Image travels as a (downscaled) data URL through
  // the same WS channel; server stores it in the in-memory source bank.
  | { type: 'uploadSource'; imageUrl: string; wordCount: number; ocrText: string | null }
  | { type: 'clearSource' } // remove the staged upload; revert to seed bank
  | { type: 'startRound'; sourceId?: string } // host only; sourceId optional (else random from bank)
  | { type: 'submit'; roundId: string; editedImageUrl: string }
  | { type: 'advanceReveal'; direction?: 1 | -1 } // host only
  | { type: 'castVote'; submissionId: string } // when voting enabled
  | { type: 'nextRound' } // host only; reveal/scoreboard -> lobby-ish round setup
  | { type: 'returnToLobby' }; // host only

/** Messages sent FROM the server TO clients. */
export type ServerMessage =
  | { type: 'joined'; playerId: string; code: string } // ack for create/join/rejoin
  | { type: 'state'; state: RoomState } // full-state snapshot
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Round timer formula (normal / non quick-fire rounds).
 *
 *   timer_seconds = clamp(60 + 0.5 * word_count, 60, 210)
 *
 * The floor is a hard 60s minimum so normal rounds never feel rushed; longer
 * sources scale up to a generous 3.5 minute ceiling. word_count only affects
 * pacing; a rough estimate (OCR or seed metadata) is fine. Quick-fire mode
 * bypasses this entirely (see {@link QUICKFIRE_SECONDS}).
 */
export function computeTimerSeconds(wordCount: number): number {
  const raw = 60 + 0.5 * wordCount;
  return Math.round(Math.min(210, Math.max(60, raw)));
}

/** Fixed timer (seconds) for quick-fire rounds — overrides the pacing formula. */
export const QUICKFIRE_SECONDS = 25;

export const WS_PORT = 8787;
