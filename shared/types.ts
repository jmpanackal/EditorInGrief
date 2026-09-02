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
  // Runtime-only fields (still safe to persist):
  submissions: Submission[];
  revealIndex: number; // which submission is currently shown at reveal
  votingEnabled: boolean;
  votes: Record<string, string>; // voterPlayerId -> submissionId
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
  roundNumber: number;
  /** The source chosen for the current/most-recent round (denormalized for clients). */
  currentSource: Source | null;
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
 * Round timer formula (per spec):
 *   timer_seconds = clamp(30 + 0.45 * word_count, 45, 150)
 * word_count only affects pacing; a rough estimate is fine.
 */
export function computeTimerSeconds(wordCount: number): number {
  const raw = 30 + 0.45 * wordCount;
  return Math.round(Math.min(150, Math.max(45, raw)));
}

export const WS_PORT = 8787;
