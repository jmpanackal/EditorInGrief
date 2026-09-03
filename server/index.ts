/**
 * Local realtime server for "Editor in Grief" (Phase 1-2).
 *
 * A tiny `ws` WebSocket server that holds in-memory room state (via GameStore)
 * and broadcasts full-state snapshots to every client in a room on any change.
 *
 * This is intentionally the ONLY backend for now. The client talks to it through
 * a small Transport interface, so a hosted backend can replace this later without
 * touching UI code.
 *
 * Run standalone: `npm run dev:server`  (or both via `npm run dev`)
 */
import { WebSocketServer, WebSocket } from 'ws';
import { GameStore, GameError } from './gameStore.ts';
import { WS_PORT, type ClientMessage, type ServerMessage } from '@shared/types.ts';

interface SocketMeta {
  code?: string;
  playerId?: string;
}

const store = new GameStore();
const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });

// code -> set of live sockets
const roomSockets = new Map<string, Set<WebSocket>>();
const meta = new WeakMap<WebSocket, SocketMeta>();

function attach(ws: WebSocket, code: string, playerId: string) {
  const m = meta.get(ws) ?? {};
  m.code = code;
  m.playerId = playerId;
  meta.set(ws, m);
  let set = roomSockets.get(code);
  if (!set) {
    set = new Set();
    roomSockets.set(code, set);
  }
  set.add(ws);
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// The store calls this on any state change (including timer-driven ones).
store.broadcast = (code: string) => {
  const set = roomSockets.get(code);
  if (!set) return;
  const state = store.getState(code);
  if (!state) return;
  const payload: ServerMessage = { type: 'state', state };
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
};

wss.on('connection', (ws) => {
  meta.set(ws, {});

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      send(ws, { type: 'error', message: 'Malformed message.' });
      return;
    }

    try {
      handle(ws, msg);
    } catch (err) {
      const message = err instanceof GameError ? err.message : 'Something went wrong.';
      if (!(err instanceof GameError)) console.error('[server] handler error:', err);
      send(ws, { type: 'error', message });
    }
  });

  ws.on('close', () => {
    const m = meta.get(ws);
    if (m?.code) {
      roomSockets.get(m.code)?.delete(ws);
      if (m.playerId) store.markDisconnected(m.code, m.playerId);
    }
  });
});

function handle(ws: WebSocket, msg: ClientMessage) {
  switch (msg.type) {
    case 'createRoom': {
      const { code, playerId } = store.createRoom(msg.nickname);
      attach(ws, code, playerId);
      send(ws, { type: 'joined', playerId, code });
      store.broadcast(code);
      break;
    }
    case 'joinRoom': {
      const { code, playerId } = store.joinRoom(msg.code, msg.nickname);
      attach(ws, code, playerId);
      send(ws, { type: 'joined', playerId, code });
      break;
    }
    case 'rejoin': {
      const { code, playerId } = store.rejoin(msg.code, msg.playerId);
      attach(ws, code, playerId);
      send(ws, { type: 'joined', playerId, code });
      break;
    }
    case 'setVoting':
      withPlayer(ws, (code, pid) => store.setVoting(code, pid, msg.enabled));
      break;
    case 'setRoundSettings':
      withPlayer(ws, (code, pid) => store.setRoundSettings(code, pid, msg.settings));
      break;
    case 'uploadSource':
      withPlayer(ws, (code, pid) => store.uploadSource(code, pid, msg.imageUrl, msg.wordCount, msg.ocrText));
      break;
    case 'clearSource':
      withPlayer(ws, (code, pid) => store.clearSource(code, pid));
      break;
    case 'startRound':
      withPlayer(ws, (code, pid) => store.startRound(code, pid, msg.sourceId));
      break;
    case 'submit':
      withPlayer(ws, (code, pid) => store.submit(code, pid, msg.roundId, msg.editedImageUrl));
      break;
    case 'advanceReveal':
      withPlayer(ws, (code, pid) => store.advanceReveal(code, pid, msg.direction ?? 1));
      break;
    case 'forceReveal':
      withPlayer(ws, (code, pid) => store.forceReveal(code, pid));
      break;
    case 'castVote':
      withPlayer(ws, (code, pid) => store.castVote(code, pid, msg.submissionId));
      break;
    case 'nextRound':
      // Reveal → scoreboard. Host then uses returnToLobby ("Play Again") to stage
      // a new upload before Start Editing — never auto-start from scoreboard.
      withPlayer(ws, (code, pid) => store.showScoreboard(code, pid));
      break;
    case 'returnToLobby':
      withPlayer(ws, (code, pid) => store.returnToLobby(code, pid));
      break;
    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
    }
  }
}

function withPlayer(ws: WebSocket, fn: (code: string, playerId: string) => void) {
  const m = meta.get(ws);
  if (!m?.code || !m.playerId) {
    send(ws, { type: 'error', message: 'You are not in a room.' });
    return;
  }
  fn(m.code, m.playerId);
}

console.log(`[server] Editor in Grief realtime server listening on ws://0.0.0.0:${WS_PORT}`);
