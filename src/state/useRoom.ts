import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RoomState,
  RoundRecap,
  RoundSettings,
  ServerMessage,
  VerdictReactionEmoji,
} from '@shared/types';
import type { ConnectionStatus, Transport } from '../transport/Transport';
import { WebSocketTransport } from '../transport/WebSocketTransport';
import { syncRoomUrl } from '../lib/roomUrl';

const IDENTITY_KEY = 'eig.identity.v1';

interface Identity {
  code: string;
  playerId: string;
  nickname: string;
}

/**
 * Tab-scoped seat identity (sessionStorage). localStorage used to share one
 * playerId across every tab in the browser, so opening an invite in a second
 * tab silently rejoined as the host instead of joining as a guest — and the
 * address bar could still show a different ?code= from the invite link.
 * First tab after upgrade claims any legacy localStorage identity, then clears
 * it so later tabs start clean.
 */
function loadIdentity(): Identity | null {
  try {
    const raw = sessionStorage.getItem(IDENTITY_KEY);
    if (raw) return JSON.parse(raw) as Identity;
    const legacy = localStorage.getItem(IDENTITY_KEY);
    if (legacy) {
      sessionStorage.setItem(IDENTITY_KEY, legacy);
      localStorage.removeItem(IDENTITY_KEY);
      return JSON.parse(legacy) as Identity;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveIdentity(id: Identity | null): void {
  try {
    if (id) sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
    else sessionStorage.removeItem(IDENTITY_KEY);
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    /* ignore */
  }
}

export interface RoomApi {
  status: ConnectionStatus;
  state: RoomState | null;
  playerId: string | null;
  error: string | null;
  clearError: () => void;
  me: RoomState['players'][number] | null;
  isHost: boolean;
  /** Per-round recaps accumulated across this session (for the end-of-game recap + export). */
  history: RoundRecap[];

  createRoom: (nickname: string) => void;
  joinRoom: (code: string, nickname: string) => void;
  leave: () => void;
  removePlayer: (playerId: string) => void;

  setVoting: (enabled: boolean) => void;
  setMaxPlayers: (max: number) => void;
  setRoundSettings: (settings: Partial<RoundSettings>) => void;
  uploadSource: (imageUrl: string, wordCount: number, ocrText: string | null) => void;
  clearSource: (sourceId: string) => void;
  voteForSource: (sourceId: string | null) => void;
  selectSource: (sourceId: string | null) => void;
  startRound: (sourceId?: string) => void;
  submit: (roundId: string, editedImageUrl: string, editCount: number) => void;
  unsubmit: (roundId: string) => void;
  advanceReveal: (direction?: 1 | -1) => void;
  beginVoting: () => void;
  forceReveal: () => void;
  castVote: (submissionId: string | null) => void;
  react: (submissionId: string, emoji: VerdictReactionEmoji) => void;
  showScoreboard: () => void;
  returnToLobby: () => void;
}

/**
 * Owns the realtime connection and the authoritative RoomState snapshot.
 * Instantiate ONCE (in App) and thread the returned API through the tree.
 */
export function useRoom(makeTransport: () => Transport = () => new WebSocketTransport()): RoomApi {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [state, setState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Client-accumulated recap of every round played this session. The server only
  // keeps the current round, so we snapshot each round (keyed by id) from the
  // full-state broadcasts as submissions land / votes settle.
  const [history, setHistory] = useState<RoundRecap[]>([]);

  const transportRef = useRef<Transport | null>(null);
  const identityRef = useRef<Identity | null>(loadIdentity());
  // Pending nickname while a create/join round-trips (so we can persist identity on ack).
  const pendingNick = useRef<string | null>(null);
  // A join creates a server-side player slot, so never send the same request
  // twice while its acknowledgement is still travelling over the wire.
  const requestPending = useRef(false);

  useEffect(() => {
    const transport = makeTransport();
    transportRef.current = transport;

    const offMsg = transport.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'joined': {
          requestPending.current = false;
          setPlayerId(msg.playerId);
          const nickname = pendingNick.current ?? identityRef.current?.nickname ?? 'Player';
          identityRef.current = { code: msg.code, playerId: msg.playerId, nickname };
          saveIdentity(identityRef.current);
          break;
        }
        case 'state': {
          setState(msg.state);
          // Accumulate a recap for any round that has results. Upsert by round id
          // so later snapshots (final vote tallies) overwrite earlier ones.
          const r = msg.state.currentRound;
          const src = msg.state.currentSource;
          if (r && src && r.submissions.length > 0) {
            const recap: RoundRecap = {
              roundId: r.id,
              roundNumber: msg.state.roundNumber,
              // Snapshot copies — server clears/replaces currentSource between rounds.
              source: { ...src },
              submissions: r.submissions.map((s) => ({ ...s })),
              votingEnabled: r.votingEnabled,
              players: msg.state.players.map((p) => ({ id: p.id, nickname: p.nickname })),
            };
            setHistory((prev) => {
              const idx = prev.findIndex((e) => e.roundId === recap.roundId);
              if (idx === -1) return [...prev, recap];
              const next = prev.slice();
              next[idx] = recap;
              return next;
            });
          }
          break;
        }
        case 'error':
          requestPending.current = false;
          setError(msg.message);
          // If our stored identity is invalid, drop it so we don't loop on rejoin.
          if (/not found|no longer in the room|removed from this room/i.test(msg.message)) {
            identityRef.current = null;
            saveIdentity(null);
            setPlayerId(null);
            setState(null);
          }
          break;
      }
    });

    const offStatus = transport.onStatus((s) => {
      setStatus(s);
      // On (re)connect, transparently rejoin if we hold an identity.
      if (s === 'open' && identityRef.current) {
        transport.send({
          type: 'rejoin',
          code: identityRef.current.code,
          playerId: identityRef.current.playerId,
        });
      }
    });

    transport.connect();

    return () => {
      offMsg();
      offStatus();
      transport.close();
    };
    // makeTransport is intentionally stable (default arg); we only want one connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((msg: Parameters<Transport['send']>[0]) => {
    transportRef.current?.send(msg);
  }, []);

  const createRoom = useCallback((nickname: string) => {
    if (requestPending.current) return;
    requestPending.current = true;
    pendingNick.current = nickname;
    send({ type: 'createRoom', nickname });
  }, [send]);

  const joinRoom = useCallback((code: string, nickname: string) => {
    if (requestPending.current) return;
    requestPending.current = true;
    pendingNick.current = nickname;
    const normalizedCode = code.toUpperCase().trim();
    const existing = identityRef.current;
    // If a click/reload happens after the server accepted the first request,
    // reconnect that identity instead of creating a lookalike player slot.
    if (existing?.code === normalizedCode) {
      send({ type: 'rejoin', code: existing.code, playerId: existing.playerId });
    } else {
      send({ type: 'joinRoom', code: normalizedCode, nickname });
    }
  }, [send]);

  const leave = useCallback(() => {
    requestPending.current = false;
    identityRef.current = null;
    saveIdentity(null);
    setPlayerId(null);
    setState(null);
    setHistory([]);
    syncRoomUrl(null);
  }, []);

  // Keep the address bar on the LIVE room code so invite/copy/share never
  // advertise a stale ?code= from a previous invite. Only write when we have a
  // code — never clear here on mount, or we'd erase the invite link before
  // JoinScreen can prefill it (leave() clears explicitly).
  useEffect(() => {
    if (state?.code) syncRoomUrl(state.code);
  }, [state?.code]);

  const removePlayer = useCallback((playerId: string) => send({ type: 'removePlayer', playerId }), [send]);

  const setVoting = useCallback((enabled: boolean) => send({ type: 'setVoting', enabled }), [send]);
  const setMaxPlayers = useCallback((max: number) => send({ type: 'setMaxPlayers', max }), [send]);
  const setRoundSettings = useCallback((settings: Partial<RoundSettings>) => send({ type: 'setRoundSettings', settings }), [send]);
  const uploadSource = useCallback((imageUrl: string, wordCount: number, ocrText: string | null) => send({ type: 'uploadSource', imageUrl, wordCount, ocrText }), [send]);
  const clearSource = useCallback((sourceId: string) => send({ type: 'clearSource', sourceId }), [send]);
  const voteForSource = useCallback((sourceId: string | null) => send({ type: 'voteForSource', sourceId }), [send]);
  const selectSource = useCallback((sourceId: string | null) => send({ type: 'selectSource', sourceId }), [send]);
  const startRound = useCallback((sourceId?: string) => send({ type: 'startRound', sourceId }), [send]);
  const submit = useCallback(
    (roundId: string, editedImageUrl: string, editCount: number) =>
      send({ type: 'submit', roundId, editedImageUrl, editCount }),
    [send],
  );
  const unsubmit = useCallback((roundId: string) => send({ type: 'unsubmit', roundId }), [send]);
  const advanceReveal = useCallback((direction: 1 | -1 = 1) => send({ type: 'advanceReveal', direction }), [send]);
  const beginVoting = useCallback(() => send({ type: 'beginVoting' }), [send]);
  const forceReveal = useCallback(() => send({ type: 'forceReveal' }), [send]);
  const castVote = useCallback((submissionId: string | null) => send({ type: 'castVote', submissionId }), [send]);
  const react = useCallback(
    (submissionId: string, emoji: VerdictReactionEmoji) => send({ type: 'react', submissionId, emoji }),
    [send],
  );
  const showScoreboard = useCallback(() => send({ type: 'nextRound' }), [send]);
  const returnToLobby = useCallback(() => send({ type: 'returnToLobby' }), [send]);

  const me = useMemo(() => state?.players.find((p) => p.id === playerId) ?? null, [state, playerId]);
  const isHost = !!me?.isHost;

  return {
    status,
    state,
    playerId,
    error,
    clearError: () => setError(null),
    me,
    isHost,
    history,
    createRoom,
    joinRoom,
    leave,
    removePlayer,
    setVoting,
    setMaxPlayers,
    setRoundSettings,
    uploadSource,
    clearSource,
    voteForSource,
    selectSource,
    startRound,
    submit,
    unsubmit,
    advanceReveal,
    beginVoting,
    forceReveal,
    castVote,
    react,
    showScoreboard,
    returnToLobby,
  };
}
