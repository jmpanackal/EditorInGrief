import { useEffect, useRef, useState } from 'react';
import { HOW_TO_PLAY_STEPS } from '../lib/howToPlay';

/** Keep in sync with `--how-to-play-advance` in index.css. */
const AUTO_ADVANCE_MS = 5000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Compact "how to play" slideshow for the landing screen (Gartic-Phone-
 * style): passive onboarding a new player sees before ever joining, no
 * click required. Auto-advances on a timer and loops; any manual
 * interaction (dot, arrow) restarts the timer from that slide.
 */
export function HowToPlayCarousel() {
  const [i, setI] = useState(0);
  const last = HOW_TO_PLAY_STEPS.length - 1;
  const step = HOW_TO_PLAY_STEPS[i];
  const reducedMotion = usePrefersReducedMotion();

  const goTo = useRef((_idx: number) => {});
  goTo.current = (idx: number) => setI(((idx % (last + 1)) + (last + 1)) % (last + 1));

  // Auto-advance, looping back to the start. Restarts whenever `i` changes
  // (including a manual click), so a manual nudge doesn't fight the timer.
  // Paused entirely when the user prefers reduced motion.
  useEffect(() => {
    if (reducedMotion) return;
    const id = setTimeout(() => goTo.current(i + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [i, reducedMotion]);

  return (
    <div
      className="card p-6 sm:p-7 flex flex-col gap-5 h-full"
      style={{ ['--how-to-play-advance' as string]: `${AUTO_ADVANCE_MS}ms` }}
    >
      <div className="kicker text-sm sm:text-base text-center text-ink2">How to play</div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 px-1">
        <div className="text-6xl sm:text-7xl leading-none" aria-hidden>
          {step.icon}
        </div>
        <div className="font-display font-black text-3xl sm:text-[2rem] leading-tight text-ink tracking-tight">
          {step.n ? `${step.n}. ${step.title}` : step.title}
        </div>
        <p className="text-xl sm:text-[1.35rem] text-ink leading-relaxed max-w-[18rem] sm:max-w-xs">
          {step.body}
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => goTo.current(i - 1)}
          aria-label="Previous"
          className="btn-ghost !px-2 !py-1 text-xl text-ink"
        >
          ◀
        </button>

        <div className="flex items-center gap-2.5" role="tablist" aria-label="How to play slides">
          {HOW_TO_PLAY_STEPS.map((s, idx) => {
            const active = idx === i;
            return (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Slide ${idx + 1}: ${s.title}`}
                onClick={() => goTo.current(idx)}
                className="relative w-5 h-5 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/50"
              >
                {active && !reducedMotion && (
                  <svg
                    key={i}
                    className="how-to-play-ring absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    {/* pathLength=1 so CSS can use unit dash offsets (same trick as outline-chase). */}
                    <circle
                      cx="10"
                      cy="10"
                      r="9"
                      pathLength={1}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      className="text-ink/20"
                    />
                    <circle
                      cx="10"
                      cy="10"
                      r="9"
                      pathLength={1}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="butt"
                      strokeDasharray="1"
                      strokeDashoffset={0}
                      className="how-to-play-ring__progress text-grief"
                    />
                  </svg>
                )}
                <span
                  className={`block rounded-full transition-colors ${
                    active
                      ? 'w-2.5 h-2.5 bg-grief'
                      : 'w-2.5 h-2.5 bg-ink/30 hover:bg-ink/50'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => goTo.current(i + 1)}
          aria-label="Next"
          className="btn-ghost !px-2 !py-1 text-xl text-ink"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
