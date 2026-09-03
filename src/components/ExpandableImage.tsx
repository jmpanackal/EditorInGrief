import { useEffect, useState } from 'react';

type ExpandableImageProps = {
  src: string;
  alt: string;
  className: string;
  buttonClassName?: string;
};

/** A compact clipping that opens the untouched, full-size image on demand. */
export function ExpandableImage({ src, alt, className, buttonClassName = '' }: ExpandableImageProps) {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block w-full text-left focus:outline-none focus:ring-2 focus:ring-grief/60 ${buttonClassName}`}
        aria-label={`Expand ${alt}`}
      >
        <img src={src} alt={alt} className={className} />
        <span className="block text-center text-[10px] font-semibold text-ink2 py-1 bg-paper hover:text-grief">
          Click to expand
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/80 p-4 sm:p-8 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onMouseDown={() => setOpen(false)}
        >
          <div className="w-full max-w-6xl max-h-full flex flex-col gap-3" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 text-paper">
              <span className="font-slab font-bold truncate">{alt}</span>
              <button type="button" className="btn-secondary !border-paper !text-paper !bg-transparent hover:!bg-paper hover:!text-ink" onClick={() => setOpen(false)}>
                Close ×
              </button>
            </div>
            <div className="min-h-0 overflow-auto rounded-[3px] border-2 border-paper bg-paper2">
              <img src={src} alt={alt} className="block w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
