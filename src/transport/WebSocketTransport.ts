import { WS_PORT, type ClientMessage, type ServerMessage } from '@shared/types';
import type { ConnectionStatus, Transport } from './Transport';

/**
 * WebSocket transport for the local realtime server.
 *
 * Development uses the standalone local server on {@link WS_PORT}. Production
 * uses a same-origin `/ws` endpoint, so Render can serve the game and its
 * WebSocket upgrade from one HTTPS URL. `VITE_WS_URL` remains an escape hatch
 * for a future split frontend/backend deployment.
 */
export function defaultWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  if (configured) return configured;

  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  if (import.meta.env.DEV) return `${scheme}//${host}:${WS_PORT}/ws`;
  return `${scheme}//${window.location.host}/ws`;
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private url: string;
  private messageCbs = new Set<(m: ServerMessage) => void>();
  private statusCbs = new Set<(s: ConnectionStatus) => void>();
  private queue: ClientMessage[] = [];
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  constructor(url: string = defaultWsUrl()) {
    this.url = url;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.open();
  }

  private open(): void {
    this.setStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setStatus('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0; // reset backoff on a healthy connection
      this.setStatus('open');
      // flush any queued messages
      const pending = this.queue.splice(0);
      for (const m of pending) this.rawSend(m);
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage;
        for (const cb of this.messageCbs) cb(msg);
      } catch {
        // ignore malformed frames
      }
    };

    // While auto-reconnect is armed, keep status on "connecting" through the
    // backoff gap. Reporting "closed"/"error" here made JoinScreen show a
    // CONNECTING… CTA beside a CLOSED footer even though retries were pending.
    this.ws.onerror = () => {
      if (!this.shouldReconnect) this.setStatus('error');
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.setStatus('connecting');
        this.scheduleReconnect();
      } else {
        this.setStatus('closed');
      }
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    // Exponential backoff with jitter, capped — so a wifi hiccup reconnects fast
    // but we don't hammer a downed server.
    const base = Math.min(15000, 500 * 2 ** this.reconnectAttempts);
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.rawSend(message);
    } else {
      this.queue.push(message);
    }
  }

  private rawSend(message: ClientMessage): void {
    this.ws?.send(JSON.stringify(message));
  }

  onMessage(cb: (m: ServerMessage) => void): () => void {
    this.messageCbs.add(cb);
    return () => this.messageCbs.delete(cb);
  }

  onStatus(cb: (s: ConnectionStatus) => void): () => void {
    this.statusCbs.add(cb);
    return () => this.statusCbs.delete(cb);
  }

  private setStatus(s: ConnectionStatus): void {
    for (const cb of this.statusCbs) cb(s);
  }

  close(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
