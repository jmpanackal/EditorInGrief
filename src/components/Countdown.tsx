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

  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`text-2xl font-bold tabular-nums ${danger ? 'text-grief animate-pulse' : 'text-white'}`}>
        {String(Math.floor(secs / 60)).padStart(1, '0')}:{String(secs % 60).padStart(2, '0')}
      </div>
      <div className="flex-1 h-2 rounded-full bg-panel2 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${danger ? 'bg-grief' : 'bg-accent'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
