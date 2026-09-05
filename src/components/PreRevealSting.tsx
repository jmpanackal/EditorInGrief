import { useEffect, useState } from 'react';
import { REVEAL_STING_SECONDS } from '@shared/types';
import { Portal } from './ui/Portal';

interface Props {
  stingStartedAt: number;
  clockOffsetMs: number;
  isHost: boolean;
  onSkip: () => void;
}

const BEATS = ['3', '2', '1', 'REVEAL'] as const;

/**
 * Synced one-shot sting when the room flips edit → reveal. Beat index is
 * derived from `revealStingStartedAt` (+ clock skew). Host can skip for
 * everyone via `skipRevealSting`; guests wait for the timer or host skip.
 */
export function PreRevealSting({ stingStartedAt, clockOffsetMs, isHost, onSkip }: Props) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() + clockOffsetMs;
      const elapsed = Math.max(0, (now - stingStartedAt) / 1000);
      const idx = Math.min(BEATS.length - 1, Math.floor(elapsed));
      setBeat(idx);
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [stingStartedAt, clockOffsetMs]);

  // Host: Space / Enter / Escape skips for the whole room.
  useEffect(() => {
    if (!isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Escape') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost, onSkip]);

  const label = BEATS[beat];
  const isFinale = label === 'REVEAL';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/70 backdrop-blur-[2px]"
        role="status"
        aria-live="assertive"
        aria-label={isFinale ? 'Off the presses' : `Reveal in ${3 - beat}`}
        onMouseDown={isHost ? onSkip : undefined}
      >
        <div
          className="mx-4 w-full max-w-md rounded-[4px] border-4 border-ink bg-paper shadow-press px-8 py-8 sm:px-12 sm:py-10 text-center"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="kicker text-xs mb-3 tracking-[0.28em] text-ink">Extra, extra</div>
          <div
            key={`${stingStartedAt}-${label}`}
            className={`font-display font-black leading-none select-none animate-countdown-pop ${
              isFinale
                ? 'text-grief text-5xl sm:text-6xl tracking-[0.06em]'
                : 'text-ink text-8xl sm:text-9xl'
            }`}
          >
            {isFinale ? 'Off the presses' : label}
          </div>
          <div className="mt-5 hr-double w-40 sm:w-56 mx-auto" />
          <p className="mt-4 text-sm text-ink2 italic font-slab">
            {isFinale ? 'Walkthrough begins…' : 'Hold for the first reveal…'}
          </p>
          {isHost ? (
            <button
              type="button"
              className="btn-ghost mt-5 text-sm"
              onClick={onSkip}
            >
              Skip →
            </button>
          ) : (
            <p className="mt-5 text-xs text-ink3 font-slab">Waiting for the Host…</p>
          )}
        </div>
        {isHost && (
          <p className="mt-4 text-xs text-paper/80 font-slab tracking-wide">
            Click, Space, or Skip to open the reveal
          </p>
        )}
      </div>
    </Portal>
  );
}

/** True while the synced sting should cover the reveal walkthrough. */
export function isRevealStingActive(
  stingStartedAt: number | undefined,
  skipped: boolean | undefined,
  clockOffsetMs: number,
): boolean {
  if (skipped) return false;
  if (!stingStartedAt) return false;
  const elapsed = (Date.now() + clockOffsetMs - stingStartedAt) / 1000;
  return elapsed < REVEAL_STING_SECONDS;
}
