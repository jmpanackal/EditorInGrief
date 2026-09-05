import { useEffect, useRef, useState } from 'react';
import { VERDICT_REACTION_EMOJIS } from '../../shared/types';
import type { RoomApi } from '../state/useRoom';
import { ImageLightbox } from './ExpandableImage';
import { PlayerList } from './PlayerList';
import { RoomInvite } from './RoomInvite';

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

export function Reveal({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound!;
  const source = state.currentSource!;
  const [showOriginal, setShowOriginal] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const resultsBtnRef = useRef<HTMLButtonElement | null>(null);

  const subs = round.submissions;
  const idx = Math.min(round.revealIndex, Math.max(0, subs.length - 1));
  const current = subs[idx];
  const owner = current ? state.players.find((p) => p.id === current.playerId) : null;
  const isLast = idx >= subs.length - 1;
  const reactionMap = current ? (round.reactions ?? {})[current.id] : undefined;

  const openLightbox = () => {
    if (!current) return;
    setLightbox({
      src: showOriginal ? source.imageUrl : current.editedImageUrl,
      alt: showOriginal
        ? 'Original source'
        : `${owner?.nickname ?? 'Unknown'}'s edit`,
    });
  };

  // Close expand when the host advances to another filing.
  useEffect(() => {
    setLightbox(null);
  }, [current?.id]);

  // Keep the source image warm so "Hold to see original" never waits on a load
  // (and never flashes the paper background while a swapped src decodes).
  useEffect(() => {
    const preload = new Image();
    preload.src = source.imageUrl;
  }, [source.imageUrl]);

  // Prefer See Results / Open ballot so native Enter confirms when it appears.
  useEffect(() => {
    if (!room.isHost || !isLast || subs.length === 0) return;
    requestAnimationFrame(() => resultsBtnRef.current?.focus());
  }, [room.isHost, isLast, subs.length]);

  // Enter opens results/ballot when the host isn't typing in a field.
  // Skip when a button already has focus — native Enter activates it.
  useEffect(() => {
    if (!room.isHost || !isLast || subs.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (lightbox) return;
      const t = e.target;
      if (
        isTypingTarget(t) ||
        t instanceof HTMLButtonElement ||
        (t instanceof HTMLElement && t.closest('button'))
      ) {
        return;
      }
      e.preventDefault();
      if (round.votingEnabled) room.beginVoting();
      else room.showScoreboard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [room, isLast, round.votingEnabled, subs.length, lightbox]);

  // ← / → / Space navigate the queue (host); hold O to peek at the original.
  useEffect(() => {
    if (subs.length === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'o' || e.key === 'O') {
        if (e.repeat) return;
        e.preventDefault();
        setShowOriginal(true);
        return;
      }

      if (!room.isHost) return;
      // Don't advance the queue while the full-size lightbox is open.
      if (lightbox) return;

      if (e.key === 'ArrowLeft') {
        if (idx <= 0) return;
        e.preventDefault();
        room.advanceReveal(-1);
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (isLast || e.repeat) return;
        // Don't steal Space from a focused button (native activation).
        if (
          e.key === ' ' &&
          (e.target instanceof HTMLButtonElement ||
            (e.target instanceof HTMLElement && e.target.closest('button')))
        ) {
          return;
        }
        e.preventDefault();
        room.advanceReveal(1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'o' || e.key === 'O') {
        setShowOriginal(false);
      }
    };

    const onBlur = () => setShowOriginal(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [room, idx, isLast, subs.length, lightbox]);

  if (subs.length === 0) {
    return (
      <div className="card p-10 text-center animate-fade-up">
        <div className="stamp stamp-ink text-lg animate-stamp-in">No copy filed</div>
        <p className="text-ink2 mt-4">Nobody filed a redaction before the deadline.</p>
        {room.isHost && (
          <button className="btn-primary mt-5" onClick={room.showScoreboard}>Continue →</button>
        )}
      </div>
    );
  }

  // Viewport-locked shell (see App): flex-1 + min-h-0 chain lets the image
  // yield height so the filmstrip + Prev/Next stay visible without page scroll.
  // Mobile (<md): top presence rail; desktop (md+): left Players column like Lobby,
  // but self-start + narrower so 1–2 filled seats don't leave a tall empty shaft.
  return (
    <div className="flex flex-col md:grid md:grid-cols-[260px_1fr] gap-2 sm:gap-2.5 md:gap-3 animate-fade-up min-w-0 flex-1 min-h-0 h-full">
      {/* —— Mobile top: compact presence rail (heavy name = editor on stage) —— */}
      <div className="md:hidden shrink-0 grow-0 card px-2 py-1 flex flex-col gap-0.5 min-w-0 max-h-[45%]">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="kicker text-[9px] leading-none">On stage</span>
            <span className="font-display font-black text-sm leading-none tracking-tight">Players</span>
          </div>
        </div>
        <div className="min-h-0">
          <PlayerList
            layout="rail"
            players={state.players}
            meId={room.playerId}
            maxPlayers={state.maxPlayers}
            highlightId={current?.playerId ?? null}
            showEmptySeats={false}
          />
        </div>
      </div>

      {/* —— Desktop left: content-height roster + quiet Invite (no full-column stretch).
          Grid items stretch by default — self-start keeps this a card stack, not a cream gutter. */}
      <aside className="hidden md:flex flex-col gap-2 min-w-0 self-start w-full">
        <div className="card p-3 flex flex-col gap-2 shrink-0 grow-0 min-h-0 overflow-hidden max-h-[min(42dvh,22rem)]">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-ink/25 shrink-0">
            <div className="min-w-0">
              <div className="kicker text-[10px]">On stage</div>
              <h2 className="font-display font-black text-xl leading-none tracking-tight mt-0.5">Players</h2>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto themed-scroll pr-0.5 -mr-0.5">
            <PlayerList
              players={state.players}
              meId={room.playerId}
              maxPlayers={state.maxPlayers}
              highlightId={current?.playerId ?? null}
              showEmptySeats={false}
            />
          </div>
        </div>
        <div className="shrink-0">
          <RoomInvite code={state.code} quiet />
        </div>
      </aside>

      {/* —— Walkthrough column: title + image + filmstrip (stretches; left does not) —— */}
      <div className="flex flex-col gap-2 sm:gap-2.5 min-w-0 flex-1 min-h-0 md:h-full md:self-stretch">
        <div className="card shrink-0 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-3 min-w-0">
          <div className="font-display font-black text-base sm:text-xl truncate leading-tight min-w-0">
            {owner?.nickname ?? 'Unknown'}’s edit
          </div>
          <span className="pill shrink-0 !px-1.5 !py-0.5 text-[10px] sm:text-xs tabular-nums">
            {idx + 1} of {subs.length}
          </span>
        </div>

        <div className="card flex-1 min-h-0 p-1.5 sm:p-2 flex flex-col gap-2">
          <div
            role="button"
            tabIndex={0}
            className="group relative flex-1 min-h-0 w-full rounded-[2px] overflow-hidden bg-paper2 border-2 border-ink cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/60"
            aria-label={`Expand ${showOriginal ? 'original' : 'edit'} — click to view full size`}
            title="Click to expand"
            onClick={openLightbox}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              openLightbox();
            }}
          >
            {/* Edited drives layout; original is stacked on top and only toggles opacity.
                Never swap src / remount — that flashed bg-paper2 while the other image loaded.
                Fill the stage box (object-contain keeps aspect ratio). */}
            <img
              key={current.id}
              src={current.editedImageUrl}
              alt="Redacted submission"
              className="absolute inset-0 w-full h-full object-contain animate-pop pointer-events-none"
            />
            <img
              src={source.imageUrl}
              alt="Original source"
              aria-hidden={!showOriginal}
              className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
                showOriginal ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {showOriginal && <span className="absolute top-2 left-2 pill pointer-events-none">uncensored proof</span>}
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 pill !py-0.5 !px-2 text-[10px] sm:text-[11px] pointer-events-none opacity-0 transition-opacity [@media(hover:hover)]:group-hover:opacity-100">
              Click to expand
            </span>
          </div>

          {lightbox && (
            <ImageLightbox
              src={lightbox.src}
              alt={lightbox.alt}
              onClose={() => setLightbox(null)}
            />
          )}

          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary !py-2 text-sm"
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              title="Hold O on keyboard"
            >
              👁 Hold to see original
            </button>
            {current && (
              <div className="flex items-center gap-1 ml-auto shrink-0">
                {VERDICT_REACTION_EMOJIS.map((emoji) => {
                  const reactors = reactionMap?.[emoji] ?? [];
                  const count = reactors.length;
                  const mine = !!room.playerId && reactors.includes(room.playerId);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => room.react(current.id, emoji)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 leading-none transition-colors ${
                        mine
                          ? 'border-grief bg-grief/10'
                          : 'border-ink/20 bg-papercard hover:border-ink/50'
                      }`}
                      aria-label={`React ${emoji}`}
                      aria-pressed={mine}
                      title={emoji}
                    >
                      <span aria-hidden className="text-lg">
                        {emoji}
                      </span>
                      {count > 0 && (
                        <span className="tabular-nums text-xs font-bold text-ink2">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom chrome: filmstrip + host controls stay shrink-0 so they never
            leave the fold. On sm+ the strip sits beside the nav buttons. */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-end gap-2">
          {subs.length > 1 && (
            <div className="min-w-0 sm:flex-1">
              <div className="kicker text-[10px] mb-1 px-0.5">Queue</div>
              <div className="flex gap-2 overflow-x-auto themed-scroll px-0.5 py-1">
                {subs.map((s, i) => {
                  const p = state.players.find((pl) => pl.id === s.playerId);
                  const active = i === idx;
                  return (
                    <div key={s.id} className="shrink-0 w-14 sm:w-16 flex flex-col items-center gap-0.5" title={p?.nickname}>
                      <div
                        className={`relative w-full rounded-[2px] overflow-hidden border-2 ring-offset-1 ring-offset-paper transition ${
                          active ? 'border-grief ring-1 ring-grief' : 'border-ink opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img src={s.editedImageUrl} alt="" className="w-full h-10 sm:h-11 object-cover object-top" />
                        <span
                          className={`absolute top-0.5 left-0.5 rounded-[2px] px-1 text-[8px] font-display font-black leading-none border border-ink ${
                            active ? 'bg-grief text-paper' : 'bg-papercard/90 text-ink2'
                          }`}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <span className={`text-[10px] truncate max-w-full ${active ? 'text-grief font-bold' : 'text-ink3'}`}>
                        {p?.nickname ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {room.isHost ? (
            <div className={`flex items-center gap-2 shrink-0 ${subs.length > 1 ? 'sm:w-[min(100%,22rem)]' : 'w-full'}`}>
              <button className="btn-secondary" disabled={idx === 0} onClick={() => room.advanceReveal(-1)}>← Previous</button>
              {isLast ? (
                <button
                  ref={resultsBtnRef}
                  className="btn-primary flex-1"
                  onClick={round.votingEnabled ? room.beginVoting : room.showScoreboard}
                >
                  {round.votingEnabled ? 'Open ballot →' : 'See Results →'}
                </button>
              ) : (
                <button className="btn-primary flex-1" onClick={() => room.advanceReveal(1)}>Next →</button>
              )}
            </div>
          ) : (
            <p className="text-center sm:text-right text-ink3 text-sm italic shrink-0 sm:ml-auto sm:pb-1">
              The Host is running the reveal.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
