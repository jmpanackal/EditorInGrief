import type { ClientMessage, ServerMessage } from '@shared/types';

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Transport is the ONLY seam between the UI and the realtime backend.
 *
 * PHASE 1-2 implementation: {@link WebSocketTransport} talks to the local `ws`
 * server. PHASE 3-4: a hosted backend (Supabase/PartyKit/etc.) can implement this
 * same interface and be dropped in with zero UI changes.
 */
export interface Transport {
  connect(): void;
  send(message: ClientMessage): void;
  onMessage(cb: (message: ServerMessage) => void): () => void;
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  close(): void;
}
