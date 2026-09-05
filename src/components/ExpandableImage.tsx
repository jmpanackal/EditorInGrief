import { useEffect, useState } from 'react';

type ExpandableImageProps = {
  src: string;
  alt: string;
  className: string;
  buttonClassName?: string;
  /** Show the “Click to expand” caption under the image (default true). */
  showHint?: boolean;
  /** Fill parent height — used when Verdict fits Original + ≤3 edits without scrolling. */
  fill?: boolean;
};

/** Full-size scrollable image overlay — shared by Scoreboard, Voting, and Reveal. */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 p-4 sm:p-8 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-full flex flex-col gap-3"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 text-paper">
          <span className="font-slab font-bold truncate">{alt}</span>
          <button
            type="button"
            className="btn-secondary !border-paper !text-paper !bg-transparent hover:!bg-paper hover:!text-ink"
            onClick={onClose}
          >
            Close ×
          </button>
        </div>
        <div className="min-h-0 overflow-auto rounded-[3px] border-2 border-paper bg-paper2">
          <img src={src} alt={alt} className="block w-full h-auto" />
        </div>
      </div>
    </div>
  );
}

/** A compact clipping that opens the untouched, full-size image on demand. */
export function ExpandableImage({
  src,
  alt,
  className,
  buttonClassName = '',
  showHint = true,
  fill = false,
}: ExpandableImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative ${
          fill
            ? 'flex h-full w-full min-h-0 items-center justify-center'
            : 'block w-full'
        } text-left focus:outline-none focus:ring-2 focus:ring-grief/60 ${buttonClassName}`}
        aria-label={`Expand ${alt}`}
      >
        <img src={src} alt={alt} className={`${fill ? '' : 'block '} ${className}`} />
        {showHint && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 pill !py-0.5 !px-2 text-[10px] sm:text-[11px] pointer-events-none opacity-0 transition-opacity [@media(hover:hover)]:group-hover:opacity-100">
            Click to expand
          </span>
        )}
      </button>

      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
