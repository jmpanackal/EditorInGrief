import { useEffect, useState } from 'react';
import { COUNTDOWN_SECONDS } from '@shared/types';

interface Props {
  countdownStartedAt: number;
  clockOffsetMs: number;
}

const BEATS = ['3', '2', '1', 'GO'] as const;

/**
 * Synced 3-2-1-GO overlay. Beat index is derived from the server's
 * `countdownStartedAt` (+ clock skew) so every client lands on the same digit.
 */
export function PreRoundCountdown({ countdownStartedAt, clockOffsetMs }: Props) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + clockOffsetMs;
      const elapsed = Math.max(0, (now - countdownStartedAt) / 1000);
      const idx = Math.min(BEATS.length - 1, Math.floor(elapsed));
      setBeat(idx);
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [countdownStartedAt, clockOffsetMs]);

  const label = BEATS[beat];
  const isGo = label === 'GO';
  const remaining = Math.max(0, COUNTDOWN_SECONDS - beat);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-paper/88 backdrop-blur-[2px]"
      role="status"
      aria-live="assertive"
      aria-label={`Starting in ${remaining}`}
    >
      <div className="kicker text-xs mb-3 tracking-[0.28em]">Hold the press</div>
      <div
        key={`${countdownStartedAt}-${label}`}
        className={`font-display font-black leading-none select-none animate-countdown-pop ${
          isGo ? 'text-grief text-7xl sm:text-8xl tracking-[0.08em]' : 'text-ink text-8xl sm:text-9xl'
        }`}
      >
        {label}
      </div>
      <div className="mt-5 hr-double w-40 sm:w-56" />
      <p className="mt-4 text-sm text-ink2 italic font-slab">
        {isGo ? 'Markers up — redact!' : 'Get ready to redact the story…'}
      </p>
    </div>
  );
}
