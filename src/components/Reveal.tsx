import { useState } from 'react';
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

  if (subs.length === 0) {
    return (
      <div className="card p-10 text-center animate-fade-up">
        <div className="stamp stamp-ink text-lg animate-stamp-in">No copy filed</div>
        <p className="text-ink2 mt-4">Nobody blacked anything out before the deadline.</p>
        {room.isHost && (
          <button className="btn-primary mt-5" onClick={room.showScoreboard}>Continue →</button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="kicker text-[11px]">Off the presses</div>
          <div className="font-display font-black text-xl">{owner?.nickname ?? 'Unknown'}’s edit</div>
        </div>
        <span className="pill">{idx + 1} / {subs.length}</span>
      </div>

      <div className="card p-4">
        <div className="relative mx-auto w-fit max-w-full rounded-[2px] overflow-hidden bg-paper2 border-2 border-ink">
          <img
            key={`${current.id}-${showOriginal}`}
            src={showOriginal ? source.imageUrl : current.editedImageUrl}
            alt={showOriginal ? 'Original source' : 'Redacted submission'}
            className="block w-auto max-w-full object-contain animate-pop"
            // Give small portrait screenshots a useful reading size. The image
            // itself determines the frame width; the viewport guards wide shots.
            style={{ height: 'min(58vh, 74vw)' }}
          />
          {showOriginal && <span className="absolute top-2 left-2 pill">uncensored proof</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            className="btn-secondary"
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
          >
            👁 Hold to see original
          </button>

        </div>
      </div>

      {/* Filmstrip — only meaningful with more than one submission. The vertical
          padding gives the active item's ring-offset room so it isn't clipped. */}
      {subs.length > 1 && (
        <div>
          <div className="kicker text-[11px] mb-1.5 px-0.5">The Late Edition — all filings</div>
          <div className="flex gap-3 overflow-x-auto px-1 py-2">
            {subs.map((s, i) => {
              const p = state.players.find((pl) => pl.id === s.playerId);
              const active = i === idx;
              return (
                <div key={s.id} className="shrink-0 w-24 flex flex-col items-center gap-1" title={p?.nickname}>
                  <div
                    className={`relative w-full rounded-[2px] overflow-hidden border-2 ring-offset-2 ring-offset-paper transition ${
                      active ? 'border-grief ring-2 ring-grief' : 'border-ink opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={s.editedImageUrl} alt="" className="w-full h-16 object-cover object-top" />
                  </div>
                  <span className={`text-[11px] truncate max-w-full ${active ? 'text-grief font-bold' : 'text-ink3'}`}>
                    {p?.nickname ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {room.isHost ? (
        <div className="flex items-center gap-2">
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
        <p className="text-center text-ink3 text-sm italic">The Host is running the reveal.</p>
      )}
    </div>
  );
}
