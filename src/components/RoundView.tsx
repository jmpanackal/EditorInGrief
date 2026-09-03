import { useCallback, useEffect, useRef, useState } from 'react';
import { timerModeLabel, type TimerMode } from '@shared/types';
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
  const untimed = round.untimed;

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
  // Skipped for untimed / ready-up rounds (no deadline).
  useEffect(() => {
    if (inCountdown || submittedByMe || untimed || round.timerSeconds <= 0) return;
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
  }, [inCountdown, submittedByMe, untimed, round.startedAt, round.timerSeconds, clockOffsetMs, requestAutoSubmit]);

  const isUpload = source.uploadedBy != null;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="card p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="kicker text-xs flex items-center gap-2 flex-wrap">
              Story No. {state.roundNumber}
              {untimed ? (
                <span className="pill">No time limit</span>
              ) : (
                <span className="pill">{lengthBadge(round.timerMode, round.timerSeconds)}</span>
              )}
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
        {untimed ? (
          <div className="flex items-center gap-3 w-full flex-wrap">
            <span className="kicker text-[10px] hidden sm:inline">Status</span>
            <div className="font-display text-xl font-black leading-none text-ink">
              {inCountdown
                ? 'No deadline'
                : submittedByMe
                  ? 'Waiting for others…'
                  : 'File when ready'}
            </div>
            <div className="flex-1 h-3 rounded-[2px] bg-paper2 overflow-hidden border-2 border-ink/40 min-w-[4rem]">
              <div
                className="h-full bg-ink transition-[width] duration-300"
                style={{ width: `${connected > 0 ? (readyCount / connected) * 100 : 0}%` }}
              />
            </div>
            {room.isHost && !inCountdown && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => room.forceReveal()}
              >
                Force reveal
              </button>
            )}
          </div>
        ) : inCountdown ? (
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
          {untimed
            ? 'Filed to the desk. The reveal runs when everyone has filed.'
            : 'Filed to the desk. The reveal runs when everyone submits or the deadline passes.'}
        </p>
      )}
    </div>
  );
}

function lengthBadge(mode: TimerMode, seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const time =
    m <= 0 ? `${s}s` : s === 0 ? `${m}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  if (mode === 'auto') return `Auto · ${time}`;
  if (mode === 'custom') return time;
  return `${timerModeLabel(mode)} · ${time}`;
}
