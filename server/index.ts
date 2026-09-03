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
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GameStore, GameError } from './gameStore.ts';
import { WS_PORT, type ClientMessage, type ServerMessage } from '@shared/types.ts';

interface SocketMeta {
  code?: string;
  playerId?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT) || WS_PORT;

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const store = new GameStore();

/**
 * Production uses one public port for both the Vite build and WebSockets.
 * In development Vite still serves the client on 5173 while this server owns
 * port 8787, so the exact same process can be used in both environments.
 */
const httpServer = createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (pathname === '/health') {
    sendText(res, 200, 'ok');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed');
    return;
  }

  // Vite's client-side router is not in use today, but returning index.html for
  // unknown paths makes future browser routes safe while keeping static assets
  // (including /seed/*.svg) directly cacheable.
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = resolve(distDir, requested);
  const safeCandidate = candidate === distDir || candidate.startsWith(`${distDir}\\`) || candidate.startsWith(`${distDir}/`);
  const filePath = safeCandidate ? candidate : join(distDir, 'index.html');

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': filePath.startsWith(join(distDir, 'assets')) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method !== 'HEAD') res.end(file);
    else res.end();
  } catch {
    try {
      const index = await readFile(join(distDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'], 'Cache-Control': 'no-cache' });
      if (req.method !== 'HEAD') res.end(index);
      else res.end();
    } catch {
      sendText(res, 503, 'The web client has not been built yet. Run npm run build.');
    }
  }
});

function sendText(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

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

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`[server] Editor in Grief listening on http://0.0.0.0:${port} (WebSockets: /ws)`);
});
