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
  const myVote = room.playerId ? round.votes[room.playerId] : undefined;
  const canVote = round.votingEnabled && current && current.playerId !== room.playerId;

  if (subs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-xl font-bold">No submissions this round 😶</div>
        <p className="text-white/60 mt-2">Nobody blacked anything out in time.</p>
        {room.isHost && (
          <button className="btn-primary mt-4" onClick={room.showScoreboard}>Continue →</button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wide">Reveal</div>
          <div className="text-lg font-bold">{owner?.nickname ?? 'Unknown'}’s redaction</div>
        </div>
        <span className="pill">{idx + 1} / {subs.length}</span>
      </div>

      <div className="card p-4">
        <div className="relative w-full flex justify-center rounded-xl overflow-hidden bg-panel2 ring-1 ring-white/10">
          <img
            src={showOriginal ? source.imageUrl : current.editedImageUrl}
            alt={showOriginal ? 'Original source' : 'Redacted submission'}
            className="max-w-full h-auto"
            style={{ maxHeight: '58vh' }}
          />
          {showOriginal && (
            <span className="absolute top-2 left-2 pill bg-black/70">original</span>
          )}
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
            👁 Hold to compare original
          </button>

          {round.votingEnabled && (
            <>
              <span className="pill">♥ {current.votesCount} vote{current.votesCount === 1 ? '' : 's'}</span>
              {canVote && (
                <button
                  className={myVote === current.id ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => room.castVote(current.id)}
                >
                  {myVote === current.id ? '✓ Your pick' : 'Vote for this'}
                </button>
              )}
              {!canVote && current.playerId === room.playerId && (
                <span className="text-xs text-white/40">(you can’t vote for your own)</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Filmstrip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {subs.map((s, i) => {
          const p = state.players.find((pl) => pl.id === s.playerId);
          return (
            <div
              key={s.id}
              className={`relative shrink-0 w-20 rounded-lg overflow-hidden ring-2 ${i === idx ? 'ring-grief' : 'ring-white/10'}`}
              title={p?.nickname}
            >
              <img src={s.editedImageUrl} alt="" className="w-full h-16 object-cover object-top" />
              {round.votingEnabled && s.votesCount > 0 && (
                <span className="absolute bottom-0 right-0 text-[10px] px-1 bg-black/70 rounded-tl">♥{s.votesCount}</span>
              )}
            </div>
          );
        })}
      </div>

      {room.isHost && (
        <div className="flex items-center gap-2">
          <button className="btn-secondary" disabled={idx === 0} onClick={() => room.advanceReveal(-1)}>← Prev</button>
          {isLast ? (
            <button className="btn-primary flex-1" onClick={room.showScoreboard}>
              {round.votingEnabled ? 'Tally votes → Scoreboard' : 'Finish round →'}
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={() => room.advanceReveal(1)}>Next →</button>
          )}
        </div>
      )}
      {!room.isHost && (
        <p className="text-center text-white/50 text-sm">The host is driving the reveal.</p>
      )}
    </div>
  );
}
