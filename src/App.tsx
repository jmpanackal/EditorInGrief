import { useEffect, useRef, useState } from 'react';
import { useRoom } from './state/useRoom';
import { JoinScreen } from './components/JoinScreen';
import { Lobby } from './components/Lobby';
import { RoundView } from './components/RoundView';
import { Reveal } from './components/Reveal';
import { Scoreboard } from './components/Scoreboard';

export default function App() {
  const room = useRoom();

  // Derive a clock-skew correction from the latest snapshot so every device's
  // countdown agrees (reveal + timer are fully synced / remote).
  const clockOffsetRef = useRef(0);
  if (room.state) clockOffsetRef.current = room.state.serverTime - Date.now();

  // Transient error toast.
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!room.error) return;
    setToast(room.error);
    const id = setTimeout(() => { setToast(null); room.clearError(); }, 3500);
    return () => clearTimeout(id);
  }, [room.error, room]);

  const inRoom = !!room.state && !!room.playerId;

  return (
    <div className="min-h-full">
      {inRoom && <Header room={room} />}

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {!inRoom ? (
          <JoinScreen room={room} />
        ) : (
          <PhaseView room={room} clockOffsetMs={clockOffsetRef.current} />
        )}
      </main>

      {/* Connection banner */}
      {inRoom && room.status !== 'open' && (
        <div className="fixed bottom-4 inset-x-0 flex justify-center pointer-events-none z-20">
          <div className="pill bg-gold/15 text-gold border-gold/40 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" /> Reconnecting… ({room.status})
          </div>
        </div>
      )}

      {/* Error toast */}
      {toast && (
        <div className="fixed top-4 inset-x-0 flex justify-center px-4 z-30 animate-fade-up">
          <div className="pill bg-grief/20 text-grief border-grief/40 max-w-md text-center shadow-glow-grief">{toast}</div>
        </div>
      )}
    </div>
  );
}

function PhaseView({ room, clockOffsetMs }: { room: ReturnType<typeof useRoom>; clockOffsetMs: number }) {
  const phase = room.state!.phase;
  switch (phase) {
    case 'lobby':
      return <Lobby room={room} />;
    case 'round':
      return <RoundView room={room} clockOffsetMs={clockOffsetMs} />;
    case 'reveal':
      return <Reveal room={room} />;
    case 'scoreboard':
      return <Scoreboard room={room} />;
    default:
      return null;
  }
}

function Header({ room }: { room: ReturnType<typeof useRoom> }) {
  const state = room.state!;
  const online = state.players.filter((p) => p.connected).length;
  return (
    <header className="sticky top-0 z-10 bg-ink/75 backdrop-blur-md border-b border-white/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="font-display font-bold text-lg">
          Editor in <span className="text-grief">Grief</span>
        </div>
        <span className="pill">Room <b className="tracking-widest ml-1 text-white">{state.code}</b></span>
        {state.votingEnabled && <span className="pill hidden sm:inline-flex">🗳️ voting</span>}
        <span className="flex-1" />
        <span className="badge hidden sm:inline-flex">
          <span className="w-1.5 h-1.5 rounded-full bg-mint" /> {online} online
        </span>
        <span className="text-sm text-white/70 font-medium hidden sm:inline">{room.me?.nickname}</span>
        <button className="btn-ghost text-sm !py-1.5 !px-3" onClick={room.leave}>Leave</button>
      </div>
    </header>
  );
}
