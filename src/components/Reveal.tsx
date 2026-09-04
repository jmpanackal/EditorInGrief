import { useEffect, useState } from 'react';
import { VERDICT_REACTION_EMOJIS } from '../../shared/types';
import type { RoomApi } from '../state/useRoom';

export function Reveal({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound!;
  const source = state.currentSource!;
  const [showOriginal, setShowOriginal] = useState(false);

  const subs = round.submissions;
  const idx = Math.min(round.revealIndex, Math.max(0, subs.length - 1));
  const current = subs[idx];
  const owner = current ? state.players.find((p) => p.id === current.playerId) : null;
  const isLast = idx >= subs.length - 1;
  const reactionMap = current ? (round.reactions ?? {})[current.id] : undefined;

  // Keep the source image warm so "Hold to see original" never waits on a load
  // (and never flashes the paper background while a swapped src decodes).
  useEffect(() => {
    const preload = new Image();
    preload.src = source.imageUrl;
  }, [source.imageUrl]);

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
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 sm:gap-2.5 animate-fade-up">
      <div className="card shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="kicker text-[10px] sm:text-[11px]">Off the presses</div>
          <div className="font-display font-black text-lg sm:text-xl truncate">
            {owner?.nickname ?? 'Unknown'}’s edit
          </div>
        </div>
        <span className="pill shrink-0">{idx + 1} / {subs.length}</span>
      </div>

      <div className="card flex-1 min-h-0 p-2.5 sm:p-3 flex flex-col gap-2">
        <div className="relative flex-1 min-h-0 mx-auto w-full flex items-center justify-center rounded-[2px] overflow-hidden bg-paper2 border-2 border-ink">
          {/* Edited drives layout; original is stacked on top and only toggles opacity.
              Never swap src / remount — that flashed bg-paper2 while the other image loaded. */}
          <img
            key={current.id}
            src={current.editedImageUrl}
            alt="Redacted submission"
            className="block max-h-full max-w-full w-auto h-auto object-contain animate-pop"
          />
          <img
            src={source.imageUrl}
            alt="Original source"
            aria-hidden={!showOriginal}
            className={`absolute inset-0 m-auto max-h-full max-w-full w-auto h-auto object-contain pointer-events-none ${
              showOriginal ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {showOriginal && <span className="absolute top-2 left-2 pill">uncensored proof</span>}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <button
            className="btn-secondary !py-2 text-sm"
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
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
            <div className="kicker text-[10px] mb-1 px-0.5">The Late Edition — all filings</div>
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
              <button className="btn-primary flex-1" onClick={round.votingEnabled ? room.beginVoting : room.showScoreboard}>
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
  );
}
