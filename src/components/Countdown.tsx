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

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const now = Date.now() + clockOffsetMs;
      const elapsed = (now - startedAt) / 1000;
      const rem = Math.max(0, durationSeconds - elapsed);
      setRemaining(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startedAt, durationSeconds, clockOffsetMs, onExpire]);

  const pct = Math.max(0, Math.min(1, remaining / durationSeconds));
  const secs = Math.ceil(remaining);
  const danger = remaining <= 10;
  const warn = remaining <= 30 && !danger;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`font-display text-3xl font-bold tabular-nums leading-none ${danger ? 'text-grief animate-pulse' : warn ? 'text-gold' : 'text-white'}`}>
        {String(Math.floor(secs / 60)).padStart(1, '0')}:{String(secs % 60).padStart(2, '0')}
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-panel2 overflow-hidden ring-1 ring-white/5">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${danger ? 'bg-grief' : warn ? 'bg-gold' : 'bg-accent'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
