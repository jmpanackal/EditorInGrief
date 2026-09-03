import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { prepareUpload } from '../lib/image';
import { runOcr } from '../lib/ocr';

/**
 * Pre-round upload (Phase 3 pulled forward).
 *
 * Any player in the lobby may stage a screenshot as the next round's source. We
 * downscale/re-encode client-side (see lib/image) to keep the base64 payload
 * reasonable, then OCR it (lib/ocr) to estimate word_count so the round timer
 * scales. The image travels to the in-memory server via the existing WS channel
 * and appears to everyone as `state.pendingSource`. If nobody uploads, the round
 * falls back to the random seed bank.
 *
 * NOTE: persistence is still in-memory only — uploads live for the room's
 * lifetime and are not saved to any DB/object store (Phase 4 TODO).
 */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = src;
  });
}

type Busy = 'idle' | 'preparing' | 'ocr';

export function SourceUpload({ room }: { room: RoomApi }) {
  const pending = room.state?.pendingSource ?? null;
  const [busy, setBusy] = useState<Busy>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploaderName = pending
    ? room.state?.players.find((p) => p.id === pending.uploadedBy)?.nickname ?? 'Someone'
    : null;

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setError(null);
      try {
        setBusy('preparing');
        const prepared = await prepareUpload(file);
        setLocalPreview(prepared.dataUrl);

        // Estimate word count via OCR so the timer can scale. Best-effort: if OCR
        // fails or finds nothing we still upload (timer falls back to the 60s floor).
        setBusy('ocr');
        let wordCount = 0;
        let text: string | null = null;
        try {
          const img = await loadImg(prepared.dataUrl);
          const res = await runOcr(img);
          wordCount = res.wordCount;
          text = res.text || null;
        } catch (err) {
          console.warn('[upload] OCR failed; continuing without word count', err);
        }

        room.uploadSource(prepared.dataUrl, wordCount, text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setBusy('idle');
        setLocalPreview(null);
      }
    },
    [room],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (busy !== 'idle') return;
      handleFile(e.dataTransfer.files?.[0]);
    },
    [busy, handleFile],
  );

  // Paste a screenshot straight from the clipboard while in the lobby.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busy !== 'idle') return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) handleFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [busy, handleFile]);

  const working = busy !== 'idle';
  const busyLabel = busy === 'preparing' ? 'Sizing the plate…' : busy === 'ocr' ? 'Reading the copy…' : '';

  // ---- staged upload preview -------------------------------------------
  if (pending) {
    return (
      <div className="rounded-[3px] border-2 border-ink bg-paper2 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="kicker text-[11px]">Filed photo</span>
          <span className="flex-1" />
          <span className="badge">by {uploaderName}</span>
        </div>
        <div className="rounded-[2px] overflow-hidden border-2 border-ink bg-papercard grid place-items-center">
          <img src={pending.imageUrl} alt="Uploaded source preview" className="max-h-52 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink3">
            {pending.wordCount > 0 ? `~${pending.wordCount} words in the copy` : 'No text read — manual tools still work'}
          </span>
          <span className="flex-1" />
          <button className="btn-ghost text-sm" onClick={() => room.clearSource()}>Spike it</button>
          <button className="btn-secondary text-sm !py-1.5" onClick={() => inputRef.current?.click()}>Replace</button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    );
  }

  // ---- empty dropzone ---------------------------------------------------
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={working}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!working) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`w-full rounded-[3px] border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? 'border-grief bg-grief/10' : 'border-ink/40 bg-paper2/50 hover:border-ink hover:bg-paper2'
        } disabled:opacity-60 disabled:cursor-wait`}
      >
        {working ? (
          <div className="flex flex-col items-center gap-2 text-sm text-ink2">
            <Spinner />
            <span>{busyLabel}</span>
            {localPreview && (
              <img src={localPreview} alt="" className="max-h-24 rounded-[2px] border-2 border-ink opacity-70" />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">🗞️</span>
            <span className="text-sm font-bold">File your own screenshot</span>
            <span className="text-xs text-ink3">Drag &amp; drop, click to browse, or paste (⌘/Ctrl-V)</span>
            <span className="text-[11px] text-ink3/80">PNG · JPEG · WebP — big plates are auto-shrunk</span>
          </div>
        )}
      </button>
      {error && <p className="text-xs text-grief font-semibold">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-5 h-5 rounded-full border-2 border-ink/25 border-t-grief animate-spin" />
  );
}
