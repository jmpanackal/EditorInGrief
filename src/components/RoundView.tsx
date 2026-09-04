import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { timerModeLabel, type TimerMode } from '@shared/types';
import type { RoomApi } from '../state/useRoom';
import { RedactionEditor } from './RedactionEditor';
import { Countdown, CountdownIdle } from './Countdown';
import { PreRoundCountdown } from './PreRoundCountdown';
import { PlayerList, type PlayerPresenceStatus } from './PlayerList';
import { RoomInvite } from './RoomInvite';

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

  const readyIds = useMemo(
    () => new Set(round.submissions.map((s) => s.playerId)),
    [round.submissions],
  );
  const statusById = useMemo(() => {
    const map: Record<string, PlayerPresenceStatus> = {};
    for (const p of state.players) {
      map[p.id] = readyIds.has(p.id) ? 'ready' : 'editing';
    }
    return map;
  }, [state.players, readyIds]);

  useEffect(() => {
    if (readyCount === previousReadyCount.current) return;
    previousReadyCount.current = readyCount;
    setFiledPulse(true);
    const timeout = window.setTimeout(() => setFiledPulse(false), 650);
    return () => window.clearTimeout(timeout);
  }, [readyCount]);

  const handleSubmit = useCallback((png: string, editCount: number) => {
    room.submit(round.id, png, editCount);
  }, [room, round.id]);

  const handleUnsubmit = useCallback(() => {
    room.unsubmit(round.id);
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
          ? 'Ready — waiting for others…'
          : 'Ready — waiting for others or the deadline…')
      : 'Edit the post by redacting text';

  const renderReadyBadge = (compact = false) => (
    <span
      className={`shrink-0 rounded-[3px] border border-ink bg-paper2 font-display font-black tabular-nums text-ink leading-none transition-transform ${
        compact
          ? 'px-1.5 py-0.5 text-[10px] border'
          : 'border-2 px-2.5 py-1 text-base'
      } ${filedPulse ? 'animate-pop !bg-grief !text-paper scale-110' : ''}`}
      title="Players ready"
    >
      {readyCount}/{connected} ready
    </span>
  );

  return (
    // Mobile (<md): top presence rail + editor column (lobby-style).
    // Desktop (md+): left Players column + timer/editor — same shell as Lobby/Scoreboard.
    <div className="flex flex-col md:grid md:grid-cols-[340px_1fr] gap-1.5 sm:gap-2 md:gap-3 animate-fade-up min-w-0 flex-1 min-h-0 h-full">
      {/* —— Mobile top: compact horizontal presence rail (Lobby density) —— */}
      <div className="md:hidden shrink-0 grow-0 card px-2 py-1 flex flex-col gap-0.5 min-w-0 max-h-[45%]">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="kicker text-[9px] leading-none">In the newsroom</span>
            <span className="font-display font-black text-sm leading-none tracking-tight">Staff</span>
          </div>
          {renderReadyBadge(true)}
        </div>
        <div className="min-h-0">
          <PlayerList
            layout="rail"
            players={state.players}
            meId={room.playerId}
            maxPlayers={state.maxPlayers}
            statusById={statusById}
          />
        </div>
      </div>

      {/* —— Desktop left: content-sized roster, Invite snug underneath (Lobby shell) ——
          Do NOT flex-1 the Players card — that left a huge cream gutter below the seats. */}
      <div className="hidden md:flex flex-col gap-2 min-w-0 h-full min-h-0">
        <div className="card p-3 flex flex-col gap-2 shrink-0 grow-0 max-h-[50%] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-ink/25 shrink-0">
            <div className="min-w-0">
              <div className="kicker text-[10px]">In the newsroom</div>
              <h2 className="font-display font-black text-xl leading-none tracking-tight mt-0.5">Staff</h2>
            </div>
            {renderReadyBadge()}
          </div>
          <div className="min-h-0 overflow-y-auto themed-scroll pr-0.5 -mr-0.5">
            <PlayerList
              players={state.players}
              meId={room.playerId}
              maxPlayers={state.maxPlayers}
              statusById={statusById}
            />
          </div>
        </div>
        <div className="shrink-0">
          <RoomInvite code={state.code} />
        </div>
      </div>

      {/* —— Editor column: meta chrome + stage —— */}
      <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0 flex-1 min-h-0 md:h-full">
        {/* Compact chrome: meta row + slim horizontal deadline bar */}
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
            onUnsubmit={handleUnsubmit}
            submitted={submittedByMe}
            flushToken={flushToken}
            disabled={inCountdown}
            maxRedactions={round.maxRedactions}
            storageKey={room.playerId ? `eig.draft.${round.id}.${room.playerId}` : undefined}
          />
        </div>
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
      : 'Mark Ready when done';
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
