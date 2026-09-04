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

export function SourceUpload({
  room,
  onHostChose,
}: {
  room: RoomApi;
  /** Fired after the host picks a story so the lobby can focus Start Editing. */
  onHostChose?: () => void;
}) {
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
    setPastePrompt(true);
    setError(
      coarsePointer
        ? 'Clipboard blocked — long-press the strip and choose Paste, or choose a file.'
        : 'Clipboard blocked — press Ctrl+V here, or click to choose a file.',
    );
    if (pastePromptTimer.current) clearTimeout(pastePromptTimer.current);
    pastePromptTimer.current = setTimeout(() => {
      setPastePrompt(false);
      setError(null);
    }, 8000);
  }, [coarsePointer]);

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

  // The shelf always shows ≥3 candidates now (server tops up with wire-photo
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
      <SourceShelf room={room} sources={pendingSources} onHostChose={onHostChose}>
        {/* Slim add strip under the three suggestion cards — paste/file stay
            primary; no tall empty dashed box competing for lobby height. */}
        <div
          ref={dropTileRef}
          role="button"
          tabIndex={0}
          onClick={() => {
            // On touch, prefer explicit Choose file / Paste — strip tap still opens picker.
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
          className={`rounded-[3px] border-2 border-dashed px-2 py-1.5 sm:px-3 sm:py-2 flex flex-row flex-wrap items-center gap-x-2 gap-y-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-grief/40 min-w-0 ${
            pastePrompt || error
              ? 'border-grief bg-grief/10'
              : dragOver
                ? 'border-grief bg-grief/10'
                : 'border-ink/40 bg-paper2/40 hover:border-ink hover:bg-paper2'
          } ${working ? 'opacity-60 cursor-wait pointer-events-none' : ''}`}
        >
          {working ? (
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <Spinner />
              <span className="text-sm text-ink2 truncate">{busyLabel}</span>
              {localPreview && (
                <img src={localPreview} alt="" className="h-8 w-8 object-cover rounded-[2px] border border-ink opacity-70 shrink-0" />
              )}
            </div>
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
                className="flex flex-1 items-center gap-1.5 min-w-0 outline-none caret-transparent"
              >
                <span className="text-lg leading-none text-grief font-bold shrink-0" aria-hidden>+</span>
                {pastePrompt ? (
                  <span className="text-sm text-grief font-semibold leading-snug truncate">
                    {error ?? (coarsePointer
                      ? 'Long-press → Paste, or choose a file'
                      : 'Press Ctrl+V here, or choose a file')}
                  </span>
                ) : error ? (
                  <span className="text-sm text-grief font-semibold leading-snug truncate">{error}</span>
                ) : (
                  <span className="text-sm font-bold truncate">
                    {hasUploads ? 'Add another' : 'Add screenshot'}
                    <span className="font-normal text-ink3">
                      {coarsePointer ? ' · Paste or file' : ' · Drop, paste, or click'}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  className={`${coarsePointer ? 'btn-secondary' : 'btn-ghost'} text-sm !py-1 !px-2.5`}
                  disabled={working}
                  onClick={(e) => {
                    e.stopPropagation();
                    void pasteFromClipboardApi();
                  }}
                >
                  Paste
                </button>
                <button
                  type="button"
                  className="btn-ghost text-sm !py-1 !px-2.5"
                  disabled={working}
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  File
                </button>
              </div>
            </>
          )}
        </div>
      </SourceShelf>
      {pastePrompt && (
        <p className="text-sm text-grief font-semibold text-center leading-snug px-1" role="status">
          {error ?? (
            coarsePointer ? (
              <>Ready for paste — long-press the strip and choose <span className="font-bold">Paste</span>, or tap <span className="font-bold">Paste</span></>
            ) : (
              <>Ready for paste — press <kbd className="font-bold">Ctrl+V</kbd> (or click the strip to choose a file)</>
            )
          )}
        </p>
      )}
      {error && !pastePrompt && (
        <p className="text-sm text-grief font-semibold text-center leading-snug px-1" role="alert">
          {error}
        </p>
      )}
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

 * The shelf always shows ≥3 candidates (server-enforced — see

 * gameStore.syncFillerSlots): real player uploads first, wire-bank

 * "filler" sources (Source.uploadedBy === null) padding the rest.

 *

 * Mobile (coarse pointer): tap the photo to vote / host-choose on a tie.

 * Desktop: click the photo to inspect; host uses the Choose button.

 */

function SourceShelf({

  room,

  sources,

  children,

  onHostChose,

}: {

  room: RoomApi;

  sources: NonNullable<RoomApi['state']>['pendingSources'];

  children?: React.ReactNode;

  onHostChose?: () => void;

}) {

  const state = room.state!;

  const seedBank = useSeedBank();

  const coarsePointer = useCoarsePointer();

  const act = coarsePointer ? 'Tap' : 'Click';

  const [preview, setPreview] = useState<Source | null>(null);

  const myVote = room.playerId ? state.sourceVotes[room.playerId] : undefined;

  const voteCount = (sourceId: string) => Object.values(state.sourceVotes).filter((id) => id === sourceId).length;

  const maxVotes = sources.reduce((max, source) => Math.max(max, voteCount(source.id)), 0);

  const leadingIds = sources.filter((source) => voteCount(source.id) === maxVotes).map((source) => source.id);

  // Host Choose only when there's a tie for the lead (including all-zero).

  const isVoteTie = leadingIds.length > 1;

  const uniqueWinnerId = maxVotes > 0 && leadingIds.length === 1 ? leadingIds[0] : null;



  // Stable per role + pointer type — do not swap on isVoteTie / uniqueWinnerId.
  const instruction = room.isHost
    ? `Choose the image to edit this round. Most ♥ wins, Host can ${coarsePointer ? 'tap' : 'click'} Choose to break a tie.`
    : coarsePointer
      ? `Vote for the image you want to edit this round. Host starts when ready.`
      : `Vote for the image you want to edit this round. Host starts when ready. ${act} a photo to inspect.`;



  const chooseSource = (sourceId: string, currentlySelected: boolean) => {

    if (!room.isHost) return;

    // Unique most-voted is locked server-side — don't toggle it off.

    if (uniqueWinnerId === sourceId) {

      onHostChose?.();

      return;

    }

    if (!isVoteTie) return;

    if (currentlySelected) {

      room.selectSource(null);

      return;

    }

    room.selectSource(sourceId);

    onHostChose?.();

  };



  const onImageActivate = (sourceId: string, currentlySelected: boolean, voted: boolean) => {

    // Desktop: inspect only. Mobile: vote, or host-choose on a tie.

    if (!coarsePointer) {

      const source = sources.find((s) => s.id === sourceId);

      if (source) setPreview(source);

      return;

    }

    if (room.isHost && isVoteTie) {

      chooseSource(sourceId, currentlySelected);

      return;

    }

    room.voteForSource(voted ? null : sourceId);

  };



  return (

    <div className="min-w-0">

      <header className="mb-1.5 sm:mb-2.5 text-center">
        <h2 className="font-display font-black text-lg sm:text-2xl leading-none tracking-tight">
          Today's Story
        </h2>
        <div className="hr-double my-1 sm:my-1.5 mx-auto w-14 sm:w-24" />
        <p className="text-xs sm:text-base font-slab text-ink2 leading-snug max-w-prose mx-auto">
          {instruction}
        </p>
      </header>

      <div className="flex flex-col gap-1.5 sm:gap-2.5 min-w-0">
        {/* Mobile: one full-width column. md+: three-across wrap, centered. */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:justify-center gap-3 md:gap-2.5 min-w-0">

        {sources.map((source) => {

          const isFiller = source.uploadedBy == null;

          const seedLabel = isFiller ? seedBank.find((s) => s.id === source.id)?.label : undefined;

          const owner = isFiller ? null : state.players.find((player) => player.id === source.uploadedBy)?.nickname ?? 'Someone';

          const selected = state.selectedSourceId === source.id || uniqueWinnerId === source.id;

          const votes = voteCount(source.id);

          const isLeading = maxVotes > 0 && votes === maxVotes;

          const voted = myVote === source.id;

          const canRemove = !isFiller && (room.isHost || source.uploadedBy === room.playerId);

          const cardChrome = selected

            ? 'border-grief bg-grief/5 shadow-clip'

            : isLeading

              ? 'border-grief bg-grief/5 shadow-clip md:shadow-none'

              : 'border-ink md:border-ink/35 bg-paper2 shadow-clip md:shadow-none';

          const imageHint = coarsePointer

            ? (room.isHost && isVoteTie

              ? (selected ? `${act} to unchoose` : `${act} to choose`)

              : (voted ? `${act} to unvote` : `${act} to vote`))

            : `${act} to inspect`;

          // Host footer: always show Choose on the locked winner / tied cards.

          const showChoose = room.isHost && (isVoteTie || uniqueWinnerId === source.id);

          const chooseLocked = uniqueWinnerId === source.id;

          return (

            <div key={source.id} className={`w-full md:w-[calc((100%-1.25rem)/3)] shrink-0 rounded-[3px] border-2 p-2 md:p-1.5 flex flex-col gap-1 min-w-0 ${cardChrome}`}>

              <div className="relative min-w-0">

                <button

                  type="button"

                  onClick={() => onImageActivate(source.id, selected, voted)}

                  className="relative block w-full max-w-full rounded-[2px] overflow-hidden border border-ink bg-papercard hover:border-grief focus:outline-none focus:ring-2 focus:ring-grief/50"

                  aria-label={imageHint}

                >

                  {selected && (

                    <span className={`absolute top-1.5 z-10 stamp !px-2 !py-0.5 text-[10px] animate-stamp-in ${canRemove ? 'left-10' : 'left-1.5'}`}>

                      Next story

                    </span>

                  )}

                  {/* Mobile: cap height so Choose/Reroll stay in the tab viewport; md+ keeps full 3/4. */}
                  <span className="relative block aspect-[3/4] w-full max-h-[min(32dvh,16rem)] md:max-h-none bg-paper">

                    <img

                      src={source.imageUrl}

                      alt={isFiller ? (seedLabel ?? 'Suggested story') : `Preview image submitted by ${owner}`}

                      className="absolute inset-0 h-full w-full object-contain pointer-events-none"

                    />

                  </span>

                  <span className="block text-xs py-0.5 text-ink2 font-semibold">{imageHint}</span>

                </button>

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

                {/* Mobile-only inspect — desktop uses click-on-image. */}

                {coarsePointer && (

                  <button

                    type="button"

                    className="absolute bottom-8 right-1.5 z-20 inline-flex h-7 px-1.5 items-center justify-center rounded-[2px] border-2 border-ink bg-papercard text-[10px] font-bold uppercase tracking-wide text-ink hover:bg-paper2 focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/50"

                    onClick={(e) => {

                      e.stopPropagation();

                      setPreview(source);

                    }}

                    aria-label="Inspect full size"

                    title="Inspect"

                  >

                    View

                  </button>

                )}

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

              <div className="flex flex-col gap-1 px-0.5">

                <div className="min-w-0 text-sm font-bold flex items-baseline gap-x-1.5 overflow-hidden">

                  <span className="badge shrink-0">{isFiller ? 'Suggested' : 'Submitted'}</span>

                  <span className="truncate">{isFiller ? (seedLabel ?? 'Story') : owner}</span>

                  <span className="text-xs text-ink3 font-normal shrink-0 whitespace-nowrap">

                    · {source.wordCount ? `~${source.wordCount} words` : 'Image only'}

                  </span>

                </div>

                {room.isHost && (

                  <div className="flex flex-wrap items-center gap-1.5 min-h-9">

                    {showChoose ? (

                      <button

                        type="button"

                        className={`btn-secondary text-sm font-bold !px-3 !py-2 flex-1 min-w-[5.5rem] ${selected ? '!bg-grief !text-paper' : ''}`}

                        disabled={chooseLocked && selected}

                        onClick={() => chooseSource(source.id, selected)}

                        title={chooseLocked ? 'Most voted — locked in' : undefined}

                      >

                        {selected ? '✓ Chosen' : 'Choose'}

                      </button>

                    ) : (

                      <span className="invisible text-sm font-bold !px-3 !py-2 flex-1 min-w-[5.5rem]" aria-hidden>

                        Choose

                      </span>

                    )}

                    {isFiller ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm font-bold !px-3 !py-2 flex-1 min-w-[5.5rem]"
                        disabled={uniqueWinnerId === source.id}
                        onClick={() => room.clearSource(source.id)}
                        title={
                          uniqueWinnerId === source.id
                            ? 'Most voted — can’t reroll'
                            : 'Swap this suggested story for a different one'
                        }
                      >
                        Reroll
                      </button>
                    ) : (
                      <span className="invisible text-sm font-bold !px-3 !py-2 flex-1 min-w-[5.5rem]" aria-hidden>
                        Reroll
                      </span>
                    )}
                  </div>

                )}

              </div>

            </div>

          );

        })}

        </div>

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

