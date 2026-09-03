import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { prepareUpload } from '../lib/image';
import { runOcr } from '../lib/ocr';
import type { Source } from '@shared/types';

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

/** Pull the first image File from a ClipboardEvent (Ctrl/Cmd+V path). */
function fileFromClipboardEvent(e: ClipboardEvent): File | null {
  const items = Array.from(e.clipboardData?.items ?? []);
  const item = items.find((i) => i.type.startsWith('image/'));
  return item?.getAsFile() ?? null;
}

/**
 * Read an image via the Async Clipboard API (right-click Paste).
 * Returns null when the clipboard has no image; throws on permission / API failures.
 */
async function fileFromClipboardApi(): Promise<File | null> {
  if (!navigator.clipboard?.read) {
    throw new Error('Clipboard paste blocked — try Ctrl+V or choose a file');
  }
  let items: ClipboardItems;
  try {
    items = await navigator.clipboard.read();
  } catch {
    throw new Error('Clipboard paste blocked — try Ctrl+V or choose a file');
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (!type) continue;
    const blob = await item.getType(type);
    const ext = type.split('/')[1] || 'png';
    return new File([blob], `clipboard.${ext}`, { type });
  }
  return null;
}

type Busy = 'idle' | 'preparing' | 'ocr';

type MenuState = { x: number; y: number } | null;

export function SourceUpload({ room }: { room: RoomApi }) {
  const pendingSources = room.state?.pendingSources ?? [];
  const pending = pendingSources.at(-1) ?? null;
  const [busy, setBusy] = useState<Busy>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pointerOverZone = useRef(false);

  const uploaderName = pending
    ? room.state?.players.find((p) => p.id === pending.uploadedBy)?.nickname ?? 'Someone'
    : null;

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setError(null);
      setMenu(null);
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

  const pasteFromClipboardApi = useCallback(async () => {
    if (busy !== 'idle') return;
    setMenu(null);
    try {
      const file = await fileFromClipboardApi();
      if (!file) {
        setError('No image on the clipboard — snip first, then paste.');
        return;
      }
      await handleFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clipboard paste blocked — try Ctrl+V or choose a file');
    }
  }, [busy, handleFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (busy !== 'idle') return;
      handleFile(e.dataTransfer.files?.[0]);
    },
    [busy, handleFile],
  );

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy !== 'idle') return;
    setMenu({ x: e.clientX, y: e.clientY });
  }, [busy]);

  // Dismiss context menu on outside click / Escape / scroll.
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  // Ctrl/Cmd+V: accept paste when the pointer is over the drop zone, the zone
  // (or lobby card) is focused, or nothing texty is focused — snip workflows
  // typically paste without focusing a field.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busy !== 'idle') return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const active = document.activeElement;
      const zone = zoneRef.current;
      const overOrFocused =
        pointerOverZone.current ||
        (zone !== null && (zone.contains(active) || active === zone || zone.contains(target as Node)));
      // Also allow paste anywhere in the lobby when no other control owns focus —
      // matches the previous window-level behavior for snipping-tool workflows.
      const lobbyLoose = !overOrFocused && (active === document.body || active === document.documentElement || active === null);
      if (!overOrFocused && !lobbyLoose) return;

      const file = fileFromClipboardEvent(e);
      if (!file) return;
      e.preventDefault();
      handleFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [busy, handleFile]);

  const working = busy !== 'idle';
  const busyLabel = busy === 'preparing' ? 'Sizing the plate…' : busy === 'ocr' ? 'Reading the copy…' : '';

  const contextMenu = menu && (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[10.5rem] rounded-[3px] border-2 border-ink bg-papercard shadow-clip py-1 font-slab text-sm"
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-1.5 hover:bg-paper2 font-bold"
        onClick={() => void pasteFromClipboardApi()}
      >
        Paste
      </button>
      <button
        type="button"
        role="menuitem"
        className="w-full text-left px-3 py-1.5 hover:bg-paper2"
        onClick={() => {
          setMenu(null);
          inputRef.current?.click();
        }}
      >
        Choose file…
      </button>
      {pending && (
        <button
          type="button"
          role="menuitem"
          className="w-full text-left px-3 py-1.5 hover:bg-paper2 text-grief"
          onClick={() => {
            setMenu(null);
            if (pending) room.clearSource(pending.id);
          }}
        >
          Clear
        </button>
      )}
    </div>
  );

  // ---- staged upload preview -------------------------------------------
  // Sources are now kept on a session shelf, so uploads never replace each other.
  const showLegacyPreview = false;
  if (pending && showLegacyPreview) {
    return (
      <div
        ref={zoneRef}
        className="rounded-[3px] border-2 border-ink bg-paper2 p-3 flex flex-col gap-3"
        onContextMenu={openMenu}
        onPointerEnter={() => { pointerOverZone.current = true; }}
        onPointerLeave={() => { pointerOverZone.current = false; }}
      >
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
          <button className="btn-ghost text-sm" onClick={() => room.clearSource(pending.id)}>Remove</button>
          <button className="btn-secondary text-sm !py-1.5" onClick={() => inputRef.current?.click()}>Replace</button>
        </div>
        <p className="text-[11px] text-ink3/80">Right-click to paste a replacement · Ctrl+V works too</p>
        {error && <p className="text-xs text-grief font-semibold">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {contextMenu}
      </div>
    );
  }

  // ---- empty dropzone ---------------------------------------------------
  return (
    <div
      ref={zoneRef}
      className="flex flex-col gap-2"
      onPointerEnter={() => { pointerOverZone.current = true; }}
      onPointerLeave={() => { pointerOverZone.current = false; }}
    >
      <div
        role="button"
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); if (!working) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onPaste={(e) => {
          const file = fileFromClipboardEvent(e.nativeEvent);
          if (!file) return;
          e.preventDefault();
          void handleFile(file);
        }}
        className={`w-full rounded-[3px] border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-grief bg-grief/10' : 'border-ink/40 bg-paper2/50 hover:border-ink hover:bg-paper2'
        } ${working ? 'opacity-60 cursor-wait pointer-events-none' : ''}`}
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
            <span className="text-2xl" aria-hidden>🗞️</span>
            <span className="text-sm font-bold">Upload a screenshot</span>
            <span className="text-xs text-ink3">Drop, click, or paste (Ctrl+V / right-click)</span>
            <span className="text-[11px] text-ink3/80">PNG · JPEG · WebP — big plates are auto-shrunk</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn-ghost self-center text-xs !py-1"
        disabled={working}
        onClick={() => void pasteFromClipboardApi()}
      >
        Paste image from clipboard
      </button>
      {error && <p className="text-xs text-grief font-semibold">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {contextMenu}
      {pendingSources.length > 0 && <SourceShelf room={room} sources={pendingSources} />}
    </div>
  );
}

function SourceShelf({ room, sources }: { room: RoomApi; sources: NonNullable<RoomApi['state']>['pendingSources'] }) {
  const state = room.state!;
  const [preview, setPreview] = useState<Source | null>(null);
  const myVote = room.playerId ? state.sourceVotes[room.playerId] : undefined;
  const voteCount = (sourceId: string) => Object.values(state.sourceVotes).filter((id) => id === sourceId).length;

  return (
    <div className="mt-2 border-t border-ink/25 pt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="kicker text-[10px]">Image shelf</span>
        <span className="text-xs text-ink3">Vote for the next story; filed images stay for later rounds.</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sources.map((source) => {
          const owner = state.players.find((player) => player.id === source.uploadedBy)?.nickname ?? 'Wire desk';
          const selected = state.selectedSourceId === source.id;
          const votes = voteCount(source.id);
          const canRemove = room.isHost || source.uploadedBy === room.playerId;
          return (
            <div key={source.id} className={`rounded-[3px] border-2 p-2 flex flex-col gap-2 ${selected ? 'border-grief bg-grief/5' : 'border-ink/35 bg-paper2'}`}>
              <button type="button" onClick={() => setPreview(source)} className="block w-full rounded-[2px] overflow-hidden border border-ink bg-papercard hover:border-grief focus:outline-none focus:ring-2 focus:ring-grief/50">
                <img src={source.imageUrl} alt={`Preview image filed by ${owner}`} className="w-full h-44 object-contain bg-paper" />
                <span className="block text-[11px] py-1 text-ink2 font-semibold">Click to inspect full size</span>
              </button>
              <div className="min-w-0 flex flex-col gap-1">
                <div className="text-xs font-bold truncate">Filed by {owner}</div>
                <div className="text-[11px] text-ink3">{source.wordCount ? `~${source.wordCount} words` : 'Image only'} · {votes} vote{votes === 1 ? '' : 's'}</div>
                <div className="flex flex-wrap gap-1 mt-auto">
                  <button className={`btn-ghost text-xs !px-2 !py-1 ${myVote === source.id ? 'bg-ink text-paper' : ''}`} onClick={() => room.voteForSource(source.id)}>{myVote === source.id ? 'Voted' : 'Vote'}</button>
                  {room.isHost && <button className={`btn-ghost text-xs !px-2 !py-1 ${selected ? 'bg-grief/15' : ''}`} onClick={() => room.selectSource(selected ? null : source.id)}>{selected ? 'Chosen' : 'Choose'}</button>}
                  {canRemove && <button className="btn-ghost text-xs !px-2 !py-1 text-grief" onClick={() => room.clearSource(source.id)}>Remove</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 bg-ink/70 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-label="Filed image preview" onMouseDown={() => setPreview(null)}>
          <div className="card w-full max-w-5xl max-h-[92dvh] p-3 flex flex-col gap-2" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="kicker text-[10px]">Full image preview</div>
              <span className="text-xs text-ink3">Inspect before voting or choosing</span>
              <span className="flex-1" />
              <button type="button" className="btn-secondary text-sm !py-1.5" onClick={() => setPreview(null)}>Close</button>
            </div>
            <div className="min-h-0 overflow-auto bg-paper2 border-2 border-ink rounded-[2px]">
              <img src={preview.imageUrl} alt="Full-size filed source" className="block w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-5 h-5 rounded-full border-2 border-ink/25 border-t-grief animate-spin" />
  );
}
