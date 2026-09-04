import { useEffect, useRef, useState } from 'react';

interface Props {
  startedAt: number; // epoch ms (server clock)
  durationSeconds: number;
  clockOffsetMs: number; // serverTime - Date.now() at last snapshot
  onExpire?: () => void;
}

/** A synced countdown. Each device derives remaining time from the shared
 * round start time (+ a clock-skew correction), so nobody is ahead.
 * Compact horizontal deadline bar — readable length cue without stealing
 * viewport height from the editor stage. */
export function Countdown({ startedAt, durationSeconds, clockOffsetMs, onExpire }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const firedRef = useRef(false);
  const lastBeepRef = useRef<number | null>(null);
  // Keep latest onExpire without resetting the fire latch when the callback identity changes.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const now = Date.now() + clockOffsetMs;
      const elapsed = (now - startedAt) / 1000;
      const rem = Math.max(0, durationSeconds - elapsed);
      setRemaining(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startedAt, durationSeconds, clockOffsetMs]);

  // If the tab was backgrounded (intervals throttled) and we resume past zero,
  // still fire expire once.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now() + clockOffsetMs;
      const elapsed = (now - startedAt) / 1000;
      if (elapsed >= durationSeconds && !firedRef.current) {
        firedRef.current = true;
        setRemaining(0);
        onExpireRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [startedAt, durationSeconds, clockOffsetMs]);

  const pct = durationSeconds > 0 ? Math.max(0, Math.min(1, remaining / durationSeconds)) : 0;
  const secs = Math.ceil(remaining);
  const danger = remaining <= 10;
  const warn = remaining <= 30 && !danger;
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  // A tiny generated beep keeps the bundle asset-free. Browsers only permit
  // sound after a user gesture; when they decline it, this harmlessly no-ops.
  useEffect(() => {
    if (!danger || secs <= 0 || secs === lastBeepRef.current) return;
    lastBeepRef.current = secs;
    try {
      const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = secs <= 5 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.10);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
      osc.onended = () => void ctx.close();
    } catch {
      // Sound is a helpful enhancement, never a reason to disrupt the timer.
    }
  }, [danger, secs]);

  return (
    <div
      className={`flex items-center gap-2 sm:gap-2.5 w-full min-w-0 ${danger ? 'animate-pulse' : ''}`}
      role="timer"
      aria-live="polite"
      aria-label={`Deadline ${label}`}
      title={`Deadline ${label}`}
    >
      <span className="kicker text-[9px] sm:text-[10px] shrink-0 hidden sm:inline">Deadline</span>
      <div
        className={`font-display text-base sm:text-lg font-black tabular-nums leading-none shrink-0 ${
          danger ? 'text-grief' : warn ? 'text-gold' : 'text-ink'
        }`}
      >
        {label}
      </div>
      <div className="flex-1 h-2 sm:h-2.5 rounded-[2px] bg-paper2 overflow-hidden border border-ink min-w-0">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${
            danger ? 'bg-grief' : warn ? 'bg-gold' : 'bg-ink'
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Static bar used during the pre-round countdown (full, dimmed). */
export function CountdownIdle({ durationSeconds }: { durationSeconds: number }) {
  const secs = Math.max(0, Math.ceil(durationSeconds));
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="flex items-center gap-2 sm:gap-2.5 w-full min-w-0 opacity-50" aria-hidden="true" title={`Deadline ${label}`}>
      <span className="kicker text-[9px] sm:text-[10px] shrink-0 hidden sm:inline">Deadline</span>
      <div className="font-display text-base sm:text-lg font-black tabular-nums leading-none shrink-0 text-ink3">
        {label}
      </div>
      <div className="flex-1 h-2 sm:h-2.5 rounded-[2px] bg-paper2 overflow-hidden border border-ink min-w-0">
        <div className="h-full w-full bg-ink" />
      </div>
    </div>
  );
}
