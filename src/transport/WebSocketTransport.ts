import { WS_PORT, type ClientMessage, type ServerMessage } from '@shared/types';
import type { ConnectionStatus, Transport } from './Transport';

/**
 * WebSocket transport for the local realtime server.
 *
 * The server host is derived from the page's own hostname so that phones and
 * other computers on the LAN (which load the app from http://<host-ip>:5173)
 * connect back to the same machine's WS server on {@link WS_PORT}.
 */
export function defaultWsUrl(): string {
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:${WS_PORT}`;
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

    this.ws.onerror = () => this.setStatus('error');

    this.ws.onclose = () => {
      this.setStatus('closed');
      this.scheduleReconnect();
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
