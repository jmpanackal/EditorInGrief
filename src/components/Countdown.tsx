import { useEffect, useRef, useState } from 'react';

interface Props {
  startedAt: number; // epoch ms (server clock)
  durationSeconds: number;
  clockOffsetMs: number; // serverTime - Date.now() at last snapshot
  onExpire?: () => void;
}

/** A synced countdown. Each device derives remaining time from the shared
 * round start time (+ a clock-skew correction), so nobody is ahead. */
export function Countdown({ startedAt, durationSeconds, clockOffsetMs, onExpire }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const firedRef = useRef(false);
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

  const pct = Math.max(0, Math.min(1, remaining / durationSeconds));
  const secs = Math.ceil(remaining);
  const danger = remaining <= 10;
  const warn = remaining <= 30 && !danger;

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="kicker text-[10px] hidden sm:inline">Deadline</span>
      <div className={`font-display text-3xl font-black tabular-nums leading-none ${danger ? 'text-grief animate-pulse' : 'text-ink'}`}>
        {String(Math.floor(secs / 60)).padStart(1, '0')}:{String(secs % 60).padStart(2, '0')}
      </div>
      <div className="flex-1 h-3 rounded-[2px] bg-paper2 overflow-hidden border-2 border-ink">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${danger ? 'bg-grief' : warn ? 'bg-gold' : 'bg-ink'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
