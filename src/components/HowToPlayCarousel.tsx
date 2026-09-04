import { useEffect, useRef, useState } from 'react';
import { HOW_TO_PLAY_STEPS } from '../lib/howToPlay';

const AUTO_ADVANCE_MS = 4000;

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

  const goTo = useRef((_idx: number) => {});
  goTo.current = (idx: number) => setI(((idx % (last + 1)) + (last + 1)) % (last + 1));

  // Auto-advance, looping back to the start. Restarts whenever `i` changes
  // (including a manual click), so a manual nudge doesn't fight the timer.
  useEffect(() => {
    const id = setTimeout(() => goTo.current(i + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [i]);

  return (
    <div className="card p-6 flex flex-col gap-4 h-full">
      <div className="kicker text-sm text-center">How to play</div>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <div className="text-7xl leading-none" aria-hidden>{step.icon}</div>
        <div className="font-display font-black text-2xl leading-tight">
          {step.n ? `${step.n}. ${step.title}` : step.title}
        </div>
        <p className="text-lg text-ink2 leading-snug max-w-xs">{step.body}</p>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => goTo.current(i - 1)}
          aria-label="Previous"
          className="btn-ghost !px-2 !py-1 text-xl"
        >
          ◀
        </button>
        <div className="flex items-center gap-2" role="tablist" aria-label="How to play slides">
          {HOW_TO_PLAY_STEPS.map((s, idx) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`Slide ${idx + 1}: ${s.title}`}
              onClick={() => goTo.current(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${idx === i ? 'bg-grief' : 'bg-ink/25 hover:bg-ink/40'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo.current(i + 1)}
          aria-label="Next"
          className="btn-ghost !px-2 !py-1 text-xl"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
