import { useEffect, useRef, useState } from 'react';
import { useRoom } from './state/useRoom';
import { JoinScreen } from './components/JoinScreen';
import { Lobby } from './components/Lobby';
import { RoundView } from './components/RoundView';
import { Reveal } from './components/Reveal';
import { Voting } from './components/Voting';
import { Scoreboard } from './components/Scoreboard';
import { dateline } from './lib/format';
import { Portal } from './components/ui/Portal';

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
  // Round + countdown need a locked viewport (Gartic-style editor) — no page
  // scroll, compact chrome. Reveal also locks so Prev/Next stay above the fold
  // while the submission image flex-shrinks. Other phases keep the scrollable shell.
  const phase = room.state?.phase;
  const isEditorPhase = phase === 'countdown' || phase === 'round';
  const isViewportLocked = isEditorPhase || phase === 'reveal';

  return (
    <div className={isViewportLocked ? 'h-dvh flex flex-col overflow-hidden' : 'min-h-full md:h-dvh flex flex-col'}>
      {inRoom && <Header room={room} compact={isEditorPhase} />}

      {/* Was capped at 5xl (1024px) for in-room phases, reading as a small
          island on large monitors — Lobby especially. At md+ this is also
          the app's one scroll container: bounded to the remaining viewport
          height below the header so a tall phase (the Lobby, mainly) scrolls
          internally instead of pushing the whole page taller than the
          window. Below md, phases keep the simpler natural page flow —
          except locked phases (editor + reveal), which fill the remaining dvh. */}
      <main
        className={
          isViewportLocked
            ? `flex-1 min-h-0 overflow-hidden flex flex-col mx-auto w-full max-w-[1600px] ${
                isEditorPhase
                  ? 'px-2 py-2 sm:px-3 sm:py-2.5'
                  : 'px-3 py-2.5 sm:px-4 sm:py-3'
              }`
            : 'md:flex-1 md:min-h-0 md:overflow-y-auto md:flex md:flex-col mx-auto w-full min-w-0 p-4 sm:p-6 max-w-[1600px]'
        }
      >
        {!inRoom ? (
          <JoinScreen room={room} />
        ) : (
          <PhaseView room={room} clockOffsetMs={clockOffsetRef.current} />
        )}
      </main>

      {/* Connection banner */}
      {inRoom && room.status !== 'open' && (
        <div className="fixed bottom-4 inset-x-0 flex justify-center pointer-events-none z-20">
          <div className="pill shadow-clip">
            <span className="w-2 h-2 rounded-full bg-grief animate-pulse" /> Reconnecting… ({room.status})
          </div>
        </div>
      )}

      {/* Error toast — styled as a wire bulletin */}
      {toast && (
        <div className="fixed top-4 inset-x-0 flex justify-center px-4 z-30 animate-fade-up">
          <div className="pill bg-grief text-paper border-ink max-w-md text-center shadow-clip">⚠ {toast}</div>
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
    case 'countdown':
    case 'round':
      // Same view: countdown overlays the editor (image preloads) until the
      // server flips phase to `round` and the deadline bar starts ticking.
      return <RoundView room={room} clockOffsetMs={clockOffsetMs} />;
    case 'reveal':
      return <Reveal room={room} />;
    case 'voting':
      return <Voting room={room} />;
    case 'scoreboard':
      return <Scoreboard room={room} />;
    default:
      return null;
  }
}

function Header({ room, compact = false }: { room: ReturnType<typeof useRoom>; compact?: boolean }) {
  const state = room.state!;
  // A stray click on "Leave" mid-game drops you out of a live room with no
  // way back in but the invite link — worth one confirm tap.
  const [confirmLeave, setConfirmLeave] = useState(false);
  return (
    <header className={`shrink-0 z-10 bg-paper/90 backdrop-blur-sm border-b-[3px] border-double border-ink ${compact ? '' : 'sticky top-0'}`}>
      <div className={`max-w-[1600px] mx-auto ${compact ? 'px-2 sm:px-3' : 'px-4 sm:px-6'}`}>
        {/* Top dateline strip — hidden in-round to reclaim vertical space */}
        {!compact && (
          <div className="flex items-center justify-between py-1 text-[10px] sm:text-[11px] kicker border-b border-ink/25">
            <span className="hidden sm:inline">The Daily Grief · Late Edition</span>
            <span className="sm:hidden">The Daily Grief</span>
            <span>{dateline()}</span>
          </div>
        )}
        {/* Masthead row — Leave far left, title dead-centered (equal 1fr
            flanks so off-center side content never pulls it off-axis). */}
        <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 ${compact ? 'py-1.5' : 'py-2.5'}`}>
          <div className="justify-self-start">
            <button className={`btn-ghost ${compact ? '!py-1 !px-2.5 text-sm' : 'text-base'}`} onClick={() => setConfirmLeave(true)}>Leave</button>
          </div>
          <div className={`font-display font-black leading-none tracking-tight text-center whitespace-nowrap ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
            Editor in <span className="text-grief">Grief</span>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            {!compact && state.votingEnabled && <span className="pill hidden sm:inline-flex">Voting</span>}
            {!compact && <span className="text-base sm:text-lg text-ink font-slab font-bold hidden sm:inline truncate max-w-[12rem]">{room.me?.nickname}</span>}
          </div>
        </div>
      </div>

      {confirmLeave && (
        // Portal: this modal is a descendant of <header>, which has
        // backdrop-blur-sm — a backdrop-filter, which (like transform/filter)
        // makes the header the containing block for `fixed` descendants in
        // every major browser. Without the portal, "fixed inset-0" resolves
        // against the header's own small box instead of the viewport, so the
        // overlay renders squashed near the top instead of covering/centering
        // on the whole page (and the page underneath can visually poke
        // through next to it).
        <Portal>
          <div
            className="fixed inset-0 z-50 bg-ink/70 p-4 grid place-items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm leaving the room"
            onMouseDown={() => setConfirmLeave(false)}
          >
            <div className="card w-full max-w-sm p-6 flex flex-col items-center gap-3 text-center shadow-clip" onMouseDown={(e) => e.stopPropagation()}>
              <div className="stamp stamp-ink animate-stamp-in text-sm">Hold on</div>
              <h2 className="font-display font-black text-xl mt-1">Leave the newsroom?</h2>
              <p className="text-sm text-ink2">You'll need the room code or invite link to get back in.</p>
              <div className="flex items-center gap-2 mt-2 w-full">
                <button className="btn-secondary flex-1" onClick={() => setConfirmLeave(false)}>Stay</button>
                <button className="btn-primary flex-1" onClick={room.leave}>Leave →</button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </header>
  );
}
