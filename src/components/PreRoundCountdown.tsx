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
 * Uses a solid paper card so digits stay readable over any source image.
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
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/55 backdrop-blur-[3px]"
      role="status"
      aria-live="assertive"
      aria-label={`Starting in ${remaining}`}
    >
      <div className="mx-4 w-full max-w-sm rounded-[4px] border-4 border-ink bg-paper shadow-press px-8 py-8 sm:px-12 sm:py-10 text-center">
        <div className="kicker text-xs mb-3 tracking-[0.28em] text-ink">Hold the press</div>
        <div
          key={`${countdownStartedAt}-${label}`}
          className={`font-display font-black leading-none select-none animate-countdown-pop ${
            isGo ? 'text-grief text-7xl sm:text-8xl tracking-[0.08em]' : 'text-ink text-8xl sm:text-9xl'
          }`}
        >
          {label}
        </div>
        <div className="mt-5 hr-double w-40 sm:w-56 mx-auto" />
        <p className="mt-4 text-sm text-ink2 italic font-slab">
          {isGo ? 'Markers up — redact!' : 'Get ready to redact the story…'}
        </p>
      </div>
    </div>
  );
}
