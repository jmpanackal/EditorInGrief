import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { prepareUpload } from '../lib/image';
import { runOcr } from '../lib/ocr';
import { useSeedBank } from '../lib/seedBank';
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

/** Pull the first image File from a ClipboardEvent (Ctrl/Cmd+V or long-press Paste). */
function fileFromClipboardEvent(e: ClipboardEvent): File | null {
  const items = Array.from(e.clipboardData?.items ?? []);
  const item = items.find((i) => i.type.startsWith('image/'));
  const fromItem = item?.getAsFile() ?? null;
  if (fromItem) return fromItem;
  // Some mobile browsers expose the image only via clipboardData.files.
  const files = Array.from(e.clipboardData?.files ?? []);
  return files.find((f) => f.type.startsWith('image/')) ?? null;
}

/** Touch-primary UI (phones) — prefer long-press / Paste-button copy over Ctrl+V. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

/** Thrown when Async Clipboard read isn't available or the browser denies it. */
class ClipboardApiUnavailableError extends Error {
  constructor(cause?: unknown) {
    const name =
      cause && typeof cause === 'object' && 'name' in cause
        ? String((cause as { name: unknown }).name)
        : undefined;
    super(name ? `CLIPBOARD_API_UNAVAILABLE (${name})` : 'CLIPBOARD_API_UNAVAILABLE');
    this.name = 'ClipboardApiUnavailableError';
  }
}

/**
 * Read an image via the Async Clipboard API (button / right-click Paste).
 * Must be invoked from a user gesture — call read() first, with no prior awaits
 * (a permissions.query pre-check used to report "denied" on Chromium even when a
 * gesture-backed read() would succeed, which forced the Ctrl+V fallback).
 * Returns null when the clipboard has no image; throws ClipboardApiUnavailableError
 * when the API is missing or permanently blocked (caller should fall back to Ctrl+V).
 */
async function fileFromClipboardApi(): Promise<File | null> {
  if (!navigator.clipboard?.read) {
    throw new ClipboardApiUnavailableError();
  }
  let items: ClipboardItems;
  try {
    // First await in this call — preserves transient user activation on Chromium.
    items = await navigator.clipboard.read();
  } catch (err) {
    const errName = err instanceof Error ? err.name : '';
    console.warn('[clipboard] read() failed:', errName || err);
    // NotAllowedError: permission denied / no gesture. Missing API browsers
    // (Firefox) never expose read(). Both → Ctrl+V fallback.
    // NotFoundError / DataError: empty or non-image clipboard → treat as no image.
    if (errName === 'NotFoundError' || errName === 'DataError') {
      return null;
    }
    throw new ClipboardApiUnavailableError(err);
  }
  for (const item of items) {
    // Prefer common snip formats (Win+Shift+S → image/png) but accept any image/*.
    const type =
      item.types.find((t) => t === 'image/png') ||
      item.types.find((t) => t === 'image/jpeg' || t === 'image/jpg') ||
      item.types.find((t) => t === 'image/webp' || t === 'image/gif') ||
      item.types.find((t) => t.startsWith('image/'));
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
  const coarsePointer = useCoarsePointer();
  const pendingSources = room.state?.pendingSources ?? [];
  const pending = pendingSources.at(-1) ?? null;
  const [busy, setBusy] = useState<Busy>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Soft prompt after clipboard.read() fails — paste-event path (Ctrl+V / long-press) still works. */
  const [pastePrompt, setPastePrompt] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const dropTileRef = useRef<HTMLDivElement | null>(null);
  /** Inner shell that receives long-press Paste; kept separate from the Paste button. */
  const pasteTargetRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pointerOverZone = useRef(false);
  const pastePromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPastePrompt = useCallback(() => {
    setPastePrompt(false);
    if (pastePromptTimer.current) {
      clearTimeout(pastePromptTimer.current);
      pastePromptTimer.current = null;
    }
  }, []);

  /** Arm paste-event fallback — focus the editable shell after render. */
  const armCtrlVPaste = useCallback(() => {
    setError(null);
    setPastePrompt(true);
    if (pastePromptTimer.current) clearTimeout(pastePromptTimer.current);
    pastePromptTimer.current = setTimeout(() => setPastePrompt(false), 8000);
  }, []);

  const uploaderName = pending
    ? room.state?.players.find((p) => p.id === pending.uploadedBy)?.nickname ?? 'Someone'
    : null;

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setError(null);
      clearPastePrompt();
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
    [room, clearPastePrompt],
  );

  const pasteFromClipboardApi = useCallback(async () => {
    if (busy !== 'idle') return;
    // Read immediately from the click/tap gesture — don't await UI work first.
    // On iOS Safari a button tap counts as the gesture; WebKit may still show its
    // own Paste callout before granting read access.
    const readPromise = fileFromClipboardApi();
    setMenu(null);
    try {
      const file = await readPromise;
      if (!file) {
        setError(
          coarsePointer
            ? 'No image on the clipboard — screenshot, tap Copy, then try Paste again.'
            : 'No image on the clipboard — snip with Win+Shift+S, then try again.',
        );
        return;
      }
      await handleFile(file);
    } catch (err) {
      if (err instanceof ClipboardApiUnavailableError) {
        // API missing / blocked — paste-event path (Ctrl+V or long-press Paste) still works.
        console.warn('[clipboard] falling back to paste event:', err.message);
        armCtrlVPaste();
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not read the clipboard.');
    }
  }, [busy, handleFile, armCtrlVPaste, coarsePointer]);

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

  useEffect(() => () => {
    if (pastePromptTimer.current) clearTimeout(pastePromptTimer.current);
  }, []);

  // After arming, focus the editable shell so Ctrl+V / long-press Paste lands here.
  useEffect(() => {
    if (!pastePrompt) return;
    (pasteTargetRef.current ?? dropTileRef.current)?.focus({ preventScroll: true });
  }, [pastePrompt]);

  // Ctrl/Cmd+V or long-press Paste: accept when the pointer is over the drop zone,
  // the zone (or lobby card) is focused, we're waiting after a failed clipboard.read(),
  // or nothing texty is focused — snip workflows typically paste without focusing a field.
  useEffect(() => {
    const isOurPasteShell = (node: EventTarget | null) => {
      if (!(node instanceof Node)) return false;
      const pasteShell = pasteTargetRef.current;
      const tile = dropTileRef.current;
      return (
        (pasteShell !== null && (pasteShell === node || pasteShell.contains(node))) ||
        (tile !== null && (tile === node || tile.contains(node)))
      );
    };

    const onPaste = (e: ClipboardEvent) => {
      if (busy !== 'idle') return;
      const target = e.target;
      const isTextField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement &&
          target.isContentEditable &&
          !isOurPasteShell(target));
      if (isTextField) return;

      const active = document.activeElement;
      const zone = zoneRef.current;
      const overOrFocused =
        pointerOverZone.current ||
        pastePrompt ||
        isOurPasteShell(active) ||
        isOurPasteShell(target) ||
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
  }, [busy, handleFile, pastePrompt]);

  const working = busy !== 'idle';
  const busyLabel = busy === 'preparing' ? 'Sizing the plate…' : busy === 'ocr' ? 'Detecting text…' : '';
  // contentEditable only when armed (API fallback). Always-on editable on phones
  // steals taps for the keyboard and fights "tap to choose file."
  const pasteShellEditable = !working && pastePrompt;

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

  // The shelf always shows ≥2 candidates now (server tops up with wire-photo
  // fillers — see gameStore.syncFillerSlots), so it's unconditional here.
  // "hasUploads" only flavors the add-tile's copy ("another" vs "a").
  const hasUploads = pendingSources.some((s) => s.uploadedBy != null);

  return (
    <div
      ref={zoneRef}
      className="flex flex-col gap-2 min-w-0"
      onPointerEnter={() => { pointerOverZone.current = true; }}
      onPointerLeave={() => { pointerOverZone.current = false; }}
    >
      <SourceShelf room={room} sources={pendingSources}>
        {/* Filing a screenshot always just ADDS a new tile — it never
            replaces or displaces an existing one. Same grid cell as a shelf
            card (one column; stretches to peer height via grid stretch)
            so it reads as "one more tile," not a full-width strip. */}
        <div
          ref={dropTileRef}
          role="button"
          tabIndex={0}
          onClick={() => {
            // On touch, prefer explicit Choose file / Paste — whole-tile tap still opens picker.
            inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              clearPastePrompt();
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => { e.preventDefault(); if (!working) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onContextMenu={openMenu}
          className={`rounded-[3px] border-2 border-dashed p-1.5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-grief/40 h-full min-h-[17.5rem] min-w-0 ${
            pastePrompt
              ? 'border-grief bg-grief/10'
              : dragOver
                ? 'border-grief bg-grief/10'
                : 'border-ink/40 bg-paper2/40 hover:border-ink hover:bg-paper2'
          } ${working ? 'opacity-60 cursor-wait pointer-events-none' : ''}`}
        >
          {working ? (
            <>
              <Spinner />
              <span className="text-sm text-ink2">{busyLabel}</span>
              {localPreview && (
                <img src={localPreview} alt="" className="h-14 w-14 object-cover rounded-[2px] border-2 border-ink opacity-70" />
              )}
            </>
          ) : (
            <>
              {/* Editable shell is separate from the Paste button so clipboard.read()
                  from a tap isn't nested inside contentEditable (iOS/Chromium quirks). */}
              <div
                ref={pasteTargetRef}
                tabIndex={pasteShellEditable ? 0 : undefined}
                contentEditable={pasteShellEditable || undefined}
                inputMode={pasteShellEditable ? 'none' : undefined}
                suppressContentEditableWarning
                onBeforeInput={(e) => {
                  if (!pasteShellEditable) return;
                  const inputType = (e.nativeEvent as InputEvent).inputType ?? '';
                  if (inputType.startsWith('insertFromPaste') || inputType === 'insertFromDrop') return;
                  e.preventDefault();
                }}
                onPaste={(e) => {
                  const file = fileFromClipboardEvent(e.nativeEvent);
                  if (!file) return;
                  e.preventDefault();
                  e.stopPropagation();
                  void handleFile(file);
                }}
                className="w-full flex flex-col items-center justify-center gap-1.5 outline-none caret-transparent min-w-0"
              >
                {pastePrompt ? (
                  <>
                    <span className="text-base font-bold">
                      {coarsePointer ? 'Long-press and tap Paste' : 'Press Ctrl+V to paste'}
                    </span>
                    <span className="text-sm text-ink3 px-2 leading-snug">
                      {coarsePointer
                        ? 'Safari may ask you to confirm Paste — or use Paste image below'
                        : 'Snip with Win+Shift+S, then paste here — or click to choose a file'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl leading-none text-grief" aria-hidden>+</span>
                    <span className="text-base font-bold">{hasUploads ? 'Add another screenshot' : 'Add a screenshot'}</span>
                    <span className="text-sm text-ink3 px-2 leading-snug">
                      {coarsePointer
                        ? 'After Copy on a screenshot, tap Paste image — or choose a file'
                        : 'Drop, click, or paste to add a new option — remove any you don\'t want'}
                    </span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-0.5">
                <button
                  type="button"
                  className={`${coarsePointer ? 'btn-secondary' : 'btn-ghost'} text-sm !py-1.5`}
                  disabled={working}
                  onClick={(e) => {
                    e.stopPropagation();
                    void pasteFromClipboardApi();
                  }}
                >
                  Paste image
                </button>
                {coarsePointer && (
                  <button
                    type="button"
                    className="btn-ghost text-sm !py-1.5"
                    disabled={working}
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    Choose file
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </SourceShelf>
      {pastePrompt && (
        <p className="text-xs text-ink2 text-center font-semibold" role="status">
          {coarsePointer ? (
            <>Ready for paste — long-press the tile and choose <span className="font-bold">Paste</span>, or tap <span className="font-bold">Paste image</span></>
          ) : (
            <>Ready for paste — press <kbd className="font-bold">Ctrl+V</kbd> (or click the tile to choose a file)</>
          )}
        </p>
      )}
      {error && !pastePrompt && <p className="text-xs text-grief font-semibold text-center">{error}</p>}
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

/**
 * The shelf always shows ≥2 candidates (server-enforced — see
 * gameStore.syncFillerSlots): real player uploads first, wire-bank
 * "filler" sources (Source.uploadedBy === null) padding the rest, so
 * there's always something to compare/choose from, never a single lonely
 * card or an empty state. Voting/Choosing work identically for both kinds
 * since a filler is a normal Source once picked — chrome differs only in
 * tag/label text, optional Shuffle, and a corner Remove on user uploads.
 *
 * Uniform card footer (seed + user) — same rows, gaps, height:
 *   Row 1 — Tag (Suggested | Submitted) + primary label + · word count / Image only
 *   Row 2 — host Choose (tiebreak only) / Shuffle (Shuffle only on fillers; slot always reserved)
 * Vote is a single tappable ♥ circle badge on the thumbnail (top-right) —
 * count + toggle; filled when you've voted. Remove is × top-left.
 *
 * Filing a screenshot only ever ADDS a tile here (see gameStore.uploadSource)
 * — never auto-removes one — so `children` (the "add another" tile) is one
 * more single-column cell in the same grid (not a full-width strip).
 */
function SourceShelf({
  room,
  sources,
  children,
}: {
  room: RoomApi;
  sources: NonNullable<RoomApi['state']>['pendingSources'];
  children?: React.ReactNode;
}) {
  const state = room.state!;
  const seedBank = useSeedBank();
  const [preview, setPreview] = useState<Source | null>(null);
  const myVote = room.playerId ? state.sourceVotes[room.playerId] : undefined;
  const voteCount = (sourceId: string) => Object.values(state.sourceVotes).filter((id) => id === sourceId).length;
  // Highlight every card tied for most votes (count > 0). All-zero shelf stays quiet.
  const maxVotes = sources.reduce((max, source) => Math.max(max, voteCount(source.id)), 0);
  const leadingIds = sources.filter((source) => voteCount(source.id) === maxVotes).map((source) => source.id);
  // Host Choose only when there's a tie for the lead (including all-zero).
  // A unique most-voted winner is locked server-side — no free pick.
  const isVoteTie = leadingIds.length > 1;

  return (
    // min-w-0 lets shelf tiles shrink inside the lobby card: otherwise a wide
    // screenshot's intrinsic width (min-width:auto) expands the outer card past
    // <main> padding and clips the right border on mobile.
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
        <span className="kicker text-sm shrink-0">Choose Today's Story</span>
        <span className="text-sm text-ink3 leading-snug">
          Most votes wins. Host breaks a tie — add or remove screenshots any time.
        </span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 min-w-0">
        {sources.map((source) => {
          const isFiller = source.uploadedBy == null;
          const seedLabel = isFiller ? seedBank.find((s) => s.id === source.id)?.label : undefined;
          const owner = isFiller ? null : state.players.find((player) => player.id === source.uploadedBy)?.nickname ?? 'Someone';
          const selected = state.selectedSourceId === source.id;
          const votes = voteCount(source.id);
          const isLeading = maxVotes > 0 && votes === maxVotes;
          const voted = myVote === source.id;
          const canRemove = !isFiller && (room.isHost || source.uploadedBy === room.playerId);
          // Host Choose keeps clip shadow + "Next story" stamp. Vote lead =
          // grief outline (+ light tint) so max-votes reads clearly at a glance.
          const cardChrome = selected
            ? 'border-grief bg-grief/5 shadow-clip'
            : isLeading
              ? 'border-grief bg-grief/5'
              : 'border-ink/35 bg-paper2';
          return (
            <div key={source.id} className={`rounded-[3px] border-2 p-1.5 flex flex-col gap-1.5 min-w-0 ${cardChrome}`}>
              <div className="relative min-w-0">
                <button type="button" onClick={() => setPreview(source)} className="relative block w-full max-w-full rounded-[2px] overflow-hidden border border-ink bg-papercard hover:border-grief focus:outline-none focus:ring-2 focus:ring-grief/50">
                  {/* Stamp shifts right when Remove × occupies top-left. */}
                  {selected && (
                    <span className={`absolute top-1.5 z-10 stamp !px-2 !py-0.5 text-[10px] animate-stamp-in ${canRemove ? 'left-10' : 'left-1.5'}`}>
                      Next story
                    </span>
                  )}
                  <img
                    src={source.imageUrl}
                    alt={isFiller ? (seedLabel ?? 'Suggested story') : `Preview image submitted by ${owner}`}
                    className="w-full max-w-full h-40 object-contain bg-paper"
                  />
                  <span className="block text-xs py-0.5 text-ink2 font-semibold">Click to inspect full size</span>
                </button>
                {/* ♥ circle — count + vote toggle (same grief badge as verdict/shelf).
                    Outside the preview button so tap votes without opening inspect.
                    Opposite Remove × (top-left); clear of host Choose/Shuffle in footer. */}
                <button
                  type="button"
                  className={`absolute top-2 right-2 z-20 inline-flex items-center justify-center gap-0.5 min-w-10 h-10 px-2 rounded-full border-2 border-ink text-base font-extrabold leading-none shadow-clip tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/50 ${
                    voted
                      ? 'bg-grief text-paper'
                      : 'bg-papercard text-grief hover:bg-grief/10'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    room.voteForSource(voted ? null : source.id);
                  }}
                  aria-pressed={voted}
                  aria-label={
                    voted
                      ? `Remove your vote, ${votes} ${votes === 1 ? 'vote' : 'votes'}`
                      : `Vote for this story, ${votes} ${votes === 1 ? 'vote' : 'votes'}`
                  }
                  title={voted ? 'Remove vote' : 'Vote'}
                >
                  <span aria-hidden>♥</span>
                  <span aria-hidden>{votes}</span>
                </button>
                {/* Remove sits on the thumb (top-left), opposite the vote badge. */}
                {canRemove && (
                  <button
                    type="button"
                    className="absolute top-1.5 left-1.5 z-20 inline-flex h-7 w-7 items-center justify-center rounded-[2px] border-2 border-ink bg-papercard text-base font-black leading-none text-ink hover:bg-grief hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/50"
                    onClick={() => room.clearSource(source.id)}
                    aria-label="Remove this screenshot"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
              {/* Footer packs under the thumb — no mt-auto. Grid stretch (esp. vs the
                  taller add-tile) used to dump empty space above SUBMITTED/SUGGESTED. */}
              <div className="flex flex-col gap-1 px-0.5">
                <div className="min-w-0 text-sm font-bold flex items-baseline gap-x-1.5 overflow-hidden">
                  <span className="badge shrink-0">{isFiller ? 'Suggested' : 'Submitted'}</span>
                  <span className="truncate">{isFiller ? (seedLabel ?? 'Story') : owner}</span>
                  <span className="text-xs text-ink3 font-normal shrink-0 whitespace-nowrap">
                    · {source.wordCount ? `~${source.wordCount} words` : 'Image only'}
                  </span>
                </div>
                {/* Host row: same slot on every card so seed/user footers match height. */}
                {room.isHost && (
                  <div className="flex flex-wrap items-center gap-1 min-h-8">
                    {isVoteTie ? (
                      <button
                        type="button"
                        className={`btn-ghost text-xs font-bold !px-2 !py-1 ${selected ? 'bg-grief/15 text-grief' : ''}`}
                        onClick={() => room.selectSource(selected ? null : source.id)}
                      >
                        {selected ? '✓ Chosen' : 'Choose'}
                      </button>
                    ) : selected ? (
                      <span className="text-xs font-bold text-grief !px-2 !py-1">✓ Most voted</span>
                    ) : (
                      <span className="invisible text-xs font-bold !px-2 !py-1" aria-hidden>
                        Choose
                      </span>
                    )}
                    {isFiller ? (
                      <button
                        type="button"
                        className="btn-ghost text-xs font-bold !px-2 !py-1"
                        onClick={() => room.clearSource(source.id)}
                        title="Swap this suggested story for a different one"
                      >
                        Shuffle
                      </button>
                    ) : (
                      <span className="invisible text-xs font-bold !px-2 !py-1" aria-hidden>
                        Shuffle
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {children}
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
