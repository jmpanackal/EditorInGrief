import { useEffect, useState, type ReactNode } from 'react';
import { HOW_TO_PLAY_STEPS } from '../lib/howToPlay';

/**
 * Self-contained "How to play" trigger + modal. Owns its own open/close state
 * so it can be dropped anywhere (the Header) with zero prop plumbing. Content
 * is a condensed version of the README's "How to play" + "The redaction
 * editor" sections — the in-app copy of what was previously docs-only.
 */
export function HowToPlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="btn-ghost text-sm !py-1.5 !px-3" onClick={() => setOpen(true)}>
        ? How to play
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 p-4 sm:p-8 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="How to play"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-2xl max-h-full overflow-y-auto p-6 flex flex-col gap-5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="kicker text-[11px]">The Redactionist's Primer</div>
                <h2 className="font-display font-black text-2xl leading-tight mt-1">How to play</h2>
              </div>
              <button type="button" className="btn-secondary !py-1.5 !px-3 text-sm shrink-0" onClick={() => setOpen(false)}>
                Close ×
              </button>
            </div>

            <p className="text-sm text-ink2 leading-snug">{HOW_TO_PLAY_STEPS[0].body}</p>

            <div className="hr-thin" />

            <div className="grid gap-3 sm:grid-cols-2">
              {HOW_TO_PLAY_STEPS.slice(1).map((step) => (
                <Beat key={step.title} n={step.n} title={step.title}>
                  {step.body}
                </Beat>
              ))}
            </div>

            <div className="hr-thin" />

            <div>
              <div className="kicker text-[11px] mb-2">Editor tools</div>
              <ul className="text-sm text-ink2 flex flex-col gap-1.5">
                <li><b>▭ Box</b> — drag a filled rectangle. Fastest for whole lines.</li>
                <li><b>✎ Marker</b> — freehand painting with an adjustable thickness.</li>
                <li><b>🔤 Tap text</b> (under "⋯ More") — auto-detected words; tap to hide/reveal one, drag across a range to hide several.</li>
                <li><b>⌫ Eraser</b> (under "⋯ More") — tap a redaction to lift just that one.</li>
                <li>Hold <b>Shift</b> (or the 📐 toggle) for straight lines / perfect squares.</li>
                <li>Scroll or pinch to zoom; Space + drag (or middle-drag) to pan.</li>
              </ul>
            </div>

            <p className="text-xs text-ink3 italic">
              Every redaction blends into the image's own background — no more solid black
              boxes than you draw. Undo removes the last shape; Reset clears everything.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Beat({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="card-inset px-3 py-2.5 flex gap-3">
      <span className="font-display font-black text-lg text-grief shrink-0 leading-none">{n}</span>
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-ink2 leading-snug mt-0.5">{children}</div>
      </div>
    </div>
  );
}
