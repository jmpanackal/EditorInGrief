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

  const isUpload = source.uploadedBy != null;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="card p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="kicker text-xs flex items-center gap-2 flex-wrap">
              Story No. {state.roundNumber}
              {round.quickFire && <span className="pill">⚡ Quick-fire</span>}
              {round.maxRedactions != null && <span className="pill">max {round.maxRedactions}</span>}
              <span className="pill">{isUpload ? 'Wire upload' : 'Wire photo'}</span>
            </div>
            <div className="font-display font-black text-xl mt-1">Black out the story to make it funnier.</div>
          </div>
          <span className="pill">{readyCount}/{connected} filed</span>
        </div>
        <Countdown
          startedAt={round.startedAt}
          durationSeconds={round.timerSeconds}
          clockOffsetMs={clockOffsetMs}
          onExpire={handleExpire}
        />
      </div>

      <div className="card p-4 sm:p-5">
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
        <p className="text-center text-ink2 text-sm italic">
          Filed to the desk. The reveal runs when everyone submits or the deadline passes.
        </p>
      )}
    </div>
  );
}
