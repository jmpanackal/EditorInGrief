import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomState, RoundRecap, RoundSettings, ServerMessage } from '@shared/types';
import type { ConnectionStatus, Transport } from '../transport/Transport';
import { WebSocketTransport } from '../transport/WebSocketTransport';

const IDENTITY_KEY = 'eig.identity.v1';

interface Identity {
  code: string;
  playerId: string;
  nickname: string;
}

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(id: Identity | null): void {
  try {
    if (id) localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
    else localStorage.removeItem(IDENTITY_KEY);
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

  setVoting: (enabled: boolean) => void;
  setRoundSettings: (settings: Partial<RoundSettings>) => void;
  uploadSource: (imageUrl: string, wordCount: number, ocrText: string | null) => void;
  clearSource: () => void;
  startRound: (sourceId?: string) => void;
  submit: (roundId: string, editedImageUrl: string) => void;
  advanceReveal: (direction?: 1 | -1) => void;
  forceReveal: () => void;
  castVote: (submissionId: string) => void;
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

  useEffect(() => {
    const transport = makeTransport();
    transportRef.current = transport;

    const offMsg = transport.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'joined': {
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
          setError(msg.message);
          // If our stored identity is invalid, drop it so we don't loop on rejoin.
          if (/not found|no longer in the room/i.test(msg.message)) {
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
    pendingNick.current = nickname;
    send({ type: 'createRoom', nickname });
  }, [send]);

  const joinRoom = useCallback((code: string, nickname: string) => {
    pendingNick.current = nickname;
    send({ type: 'joinRoom', code: code.toUpperCase().trim(), nickname });
  }, [send]);

  const leave = useCallback(() => {
    identityRef.current = null;
    saveIdentity(null);
    setPlayerId(null);
    setState(null);
    setHistory([]);
  }, []);

  const setVoting = useCallback((enabled: boolean) => send({ type: 'setVoting', enabled }), [send]);
  const setRoundSettings = useCallback((settings: Partial<RoundSettings>) => send({ type: 'setRoundSettings', settings }), [send]);
  const uploadSource = useCallback((imageUrl: string, wordCount: number, ocrText: string | null) => send({ type: 'uploadSource', imageUrl, wordCount, ocrText }), [send]);
  const clearSource = useCallback(() => send({ type: 'clearSource' }), [send]);
  const startRound = useCallback((sourceId?: string) => send({ type: 'startRound', sourceId }), [send]);
  const submit = useCallback((roundId: string, editedImageUrl: string) => send({ type: 'submit', roundId, editedImageUrl }), [send]);
  const advanceReveal = useCallback((direction: 1 | -1 = 1) => send({ type: 'advanceReveal', direction }), [send]);
  const forceReveal = useCallback(() => send({ type: 'forceReveal' }), [send]);
  const castVote = useCallback((submissionId: string) => send({ type: 'castVote', submissionId }), [send]);
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
    setVoting,
    setRoundSettings,
    uploadSource,
    clearSource,
    startRound,
    submit,
    advanceReveal,
    forceReveal,
    castVote,
    showScoreboard,
    returnToLobby,
  };
}
