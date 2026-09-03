import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { RedactionEditor } from './RedactionEditor';
import { Countdown } from './Countdown';
import { PreRoundCountdown } from './PreRoundCountdown';

export function RoundView({ room, clockOffsetMs }: { room: RoomApi; clockOffsetMs: number }) {
  const state = room.state!;
  const round = state.currentRound!;
  const source = state.currentSource!;
  const [flushToken, setFlushToken] = useState(0);
  const inCountdown = state.phase === 'countdown';

  const submittedByMe = round.submissions.some((s) => s.playerId === room.playerId);
  const submittedRef = useRef(submittedByMe);
  submittedRef.current = submittedByMe;

  const connected = state.players.filter((p) => p.connected).length;
  const readyCount = round.submissions.length;

  const handleSubmit = useCallback((png: string) => {
    room.submit(round.id, png);
  }, [room, round.id]);

  const requestAutoSubmit = useCallback(() => {
    if (submittedRef.current) return;
    setFlushToken(Date.now());
  }, []);

  // Round deadline hit → flatten whatever is on the canvas (incl. unedited image).
  const handleExpire = useCallback(() => {
    requestAutoSubmit();
  }, [requestAutoSubmit]);

  // Safety net: if we somehow miss the Countdown onExpire (throttled tab, remount),
  // poll remaining time while the round is active and force a flush at zero.
  useEffect(() => {
    if (inCountdown || submittedByMe) return;
    const id = setInterval(() => {
      if (submittedRef.current) return;
      const now = Date.now() + clockOffsetMs;
      const elapsed = (now - round.startedAt) / 1000;
      if (elapsed >= round.timerSeconds) {
        requestAutoSubmit();
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, [inCountdown, submittedByMe, round.startedAt, round.timerSeconds, clockOffsetMs, requestAutoSubmit]);

  const isUpload = source.uploadedBy != null;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="card p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="kicker text-xs flex items-center gap-2 flex-wrap">
              Story No. {state.roundNumber}
              {round.quickFire && <span className="pill">⚡ Quick-fire</span>}
              {round.maxRedactions != null && (
                <span className="pill">max {round.maxRedactions}</span>
              )}
              <span className="pill">{isUpload ? 'Wire upload' : 'Wire photo'}</span>
            </div>
            <div className="font-display font-black text-xl mt-1">
              {inCountdown ? 'Get ready…' : 'Black out the story to make it funnier.'}
            </div>
          </div>
          <span className="pill">{readyCount}/{connected} filed</span>
        </div>
        {inCountdown ? (
          <div className="flex items-center gap-3 w-full opacity-60">
            <span className="kicker text-[10px] hidden sm:inline">Deadline</span>
            <div className="font-display text-3xl font-black tabular-nums leading-none text-ink3">
              {String(Math.floor(round.timerSeconds / 60)).padStart(1, '0')}:
              {String(round.timerSeconds % 60).padStart(2, '0')}
            </div>
            <div className="flex-1 h-3 rounded-[2px] bg-paper2 overflow-hidden border-2 border-ink/40">
              <div className="h-full bg-ink/25" style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          <Countdown
            startedAt={round.startedAt}
            durationSeconds={round.timerSeconds}
            clockOffsetMs={clockOffsetMs}
            onExpire={handleExpire}
          />
        )}
      </div>

      <div className="card p-4 sm:p-5 relative overflow-hidden">
        {inCountdown && (
          <PreRoundCountdown
            countdownStartedAt={round.countdownStartedAt}
            clockOffsetMs={clockOffsetMs}
          />
        )}
        <RedactionEditor
          imageUrl={source.imageUrl}
          onSubmit={handleSubmit}
          submitted={submittedByMe}
          flushToken={flushToken}
          disabled={inCountdown}
          maxRedactions={round.maxRedactions}
          storageKey={room.playerId ? `eig.draft.${round.id}.${room.playerId}` : undefined}
        />
      </div>

      {submittedByMe && !inCountdown && (
        <p className="text-center text-ink2 text-sm italic">
          Filed to the desk. The reveal runs when everyone submits or the deadline passes.
        </p>
      )}
    </div>
  );
}
