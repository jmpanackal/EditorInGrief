import { useCallback, useEffect, useRef, useState } from 'react';
import { timerModeLabel, type TimerMode } from '@shared/types';
import type { RoomApi } from '../state/useRoom';
import { RedactionEditor } from './RedactionEditor';
import { Countdown, CountdownIdle } from './Countdown';
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
  const previousReadyCount = useRef(readyCount);
  const [filedPulse, setFiledPulse] = useState(false);

  useEffect(() => {
    if (readyCount === previousReadyCount.current) return;
    previousReadyCount.current = readyCount;
    setFiledPulse(true);
    const timeout = window.setTimeout(() => setFiledPulse(false), 650);
    return () => window.clearTimeout(timeout);
  }, [readyCount]);

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
  const prompt = inCountdown
    ? 'Get ready…'
    : submittedByMe
      ? (untimed
          ? 'Filed — waiting for others…'
          : 'Filed — waiting for others or the deadline…')
      : 'Redact the story to make it funnier.';

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full gap-1.5 sm:gap-2 animate-fade-up">
      {/* Compact chrome: meta row + slim horizontal deadline bar (no circular-only timer) */}
      <div className="card shrink-0 px-2.5 sm:px-3 py-1.5 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <span className="kicker text-[9px] sm:text-[10px] whitespace-nowrap shrink-0">
              Story No. {state.roundNumber}
            </span>
            {!untimed && (
              <span className="pill !px-1.5 !py-0 text-[9px] sm:text-[10px] hidden sm:inline-flex shrink-0">
                {lengthBadge(round.timerMode, round.timerSeconds)}
              </span>
            )}
            {untimed && (
              <span className="pill !px-1.5 !py-0 text-[9px] sm:text-[10px] hidden sm:inline-flex shrink-0">
                No time limit
              </span>
            )}
            <span className="pill !px-1.5 !py-0 text-[9px] sm:text-[10px] hidden md:inline-flex shrink-0">
              {isUpload ? 'Wire upload' : 'Wire photo'}
            </span>
            <span className={`font-display font-black text-sm sm:text-base truncate min-w-0 ${submittedByMe && !inCountdown ? 'text-ink2 italic' : ''}`}>
              {prompt}
            </span>
          </div>

          <span
            className={`pill font-display font-black shrink-0 transition-transform text-[10px] sm:text-xs ${
              filedPulse ? 'animate-pop bg-grief text-paper border-ink scale-110' : ''
            }`}
          >
            {readyCount}/{connected} filed
          </span>

          {untimed && (
            <UntimedStatus
              inCountdown={inCountdown}
              submittedByMe={submittedByMe}
              readyCount={readyCount}
              connected={connected}
              showForce={room.isHost && !inCountdown}
              onForce={() => room.forceReveal()}
            />
          )}
        </div>

        {!untimed && (
          inCountdown ? (
            <CountdownIdle durationSeconds={round.timerSeconds} />
          ) : (
            <Countdown
              startedAt={round.startedAt}
              durationSeconds={round.timerSeconds}
              clockOffsetMs={clockOffsetMs}
              onExpire={handleExpire}
            />
          )
        )}
      </div>

      {/* Stage — fills remaining viewport; editor chrome stays inside */}
      <div className="card flex-1 min-h-0 p-1.5 sm:p-2 relative overflow-hidden flex flex-col">
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
    </div>
  );
}

function UntimedStatus({
  inCountdown,
  submittedByMe,
  readyCount,
  connected,
  showForce,
  onForce,
}: {
  inCountdown: boolean;
  submittedByMe: boolean;
  readyCount: number;
  connected: number;
  showForce: boolean;
  onForce: () => void;
}) {
  const label = inCountdown
    ? 'No deadline'
    : submittedByMe
      ? 'Waiting…'
      : 'File when ready';
  const pct = connected > 0 ? (readyCount / connected) * 100 : 0;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex flex-col items-end gap-0.5 min-w-[4.5rem]">
        <span className="font-display text-xs sm:text-sm font-black leading-none text-ink whitespace-nowrap">
          {label}
        </span>
        <div className="w-16 sm:w-20 h-1.5 rounded-[2px] bg-paper2 overflow-hidden border border-ink/40">
          <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {showForce && (
        <button type="button" className="btn-secondary !px-2 !py-1 text-[10px] sm:text-xs" onClick={onForce}>
          Force
        </button>
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
