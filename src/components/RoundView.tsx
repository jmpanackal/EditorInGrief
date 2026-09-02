import { useCallback, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { RedactionEditor } from './RedactionEditor';
import { Countdown } from './Countdown';

export function RoundView({ room, clockOffsetMs }: { room: RoomApi; clockOffsetMs: number }) {
  const state = room.state!;
  const round = state.currentRound!;
  const source = state.currentSource!;
  const [flushToken, setFlushToken] = useState(0);

  const submittedByMe = round.submissions.some((s) => s.playerId === room.playerId);
  const connected = state.players.filter((p) => p.connected).length;
  const readyCount = round.submissions.length;

  const handleSubmit = useCallback((png: string) => {
    room.submit(round.id, png);
  }, [room, round.id]);

  const handleExpire = useCallback(() => {
    // auto-submit whatever is on the canvas
    if (!submittedByMe) setFlushToken(Date.now());
  }, [submittedByMe]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-2">
              Round {state.roundNumber}
              {round.quickFire && <span className="pill bg-amber-500/20 text-amber-300 border-amber-500/40">⚡ Quick-fire</span>}
              {round.maxRedactions != null && <span className="pill">max {round.maxRedactions}</span>}
            </div>
            <div className="text-sm text-white/70">Black out the pixels to make it funnier.</div>
          </div>
          <span className="pill">{readyCount}/{connected} submitted</span>
        </div>
        <Countdown
          startedAt={round.startedAt}
          durationSeconds={round.timerSeconds}
          clockOffsetMs={clockOffsetMs}
          onExpire={handleExpire}
        />
      </div>

      <div className="card p-4">
        <RedactionEditor
          imageUrl={source.imageUrl}
          onSubmit={handleSubmit}
          submitted={submittedByMe}
          flushToken={flushToken}
          maxRedactions={round.maxRedactions}
          storageKey={room.playerId ? `eig.draft.${round.id}.${room.playerId}` : undefined}
        />
      </div>

      {submittedByMe && (
        <p className="text-center text-white/50 text-sm">
          Locked in. The reveal begins when everyone submits or the timer runs out.
        </p>
      )}
    </div>
  );
}
