import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { Recap } from './Recap';
import { ExpandableImage } from './ExpandableImage';

export function Scoreboard({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound;
  const voting = state.votingEnabled;

  const results = round ? [...round.submissions].sort((a, b) => b.votesCount - a.votesCount) : [];
  const topVotes = results[0]?.votesCount ?? 0;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="card p-5">
          <div className="text-center mb-4">
            <div className="kicker text-[11px] flex items-center justify-center gap-2">
              <span className="hr-thin flex-1" /> The Verdict <span className="hr-thin flex-1" />
            </div>
            <div className="font-display font-black text-2xl mt-1">Story No. {state.roundNumber} — Final</div>
          </div>
          {!round || !state.currentSource ? (
            <div className="text-ink3 py-6 text-center italic">No copy filed this round.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-[3px] overflow-hidden bg-papercard border-2 border-dashed border-ink">
                <ExpandableImage
                  src={state.currentSource.imageUrl}
                  alt="Original source image"
                  className="w-full h-28 object-cover object-top"
                />
                <div className="px-2.5 py-1.5 border-t-2 border-dashed border-ink text-sm">
                  <span className="font-semibold">Original</span>
                </div>
              </div>
              {results.map((s) => {
                const p = state.players.find((pl) => pl.id === s.playerId);
                const isWinner = voting && s.votesCount > 0 && s.votesCount === topVotes;
                return (
                  <div
                    key={s.id}
                    className={`relative rounded-[3px] overflow-hidden bg-papercard border-2 ${isWinner ? 'border-grief shadow-clip' : 'border-ink'}`}
                  >
                    {isWinner && (
                      <span className="absolute top-1 left-1 z-10 stamp !px-2 !py-0.5 text-[11px] animate-stamp-in">
                        Extra!
                      </span>
                    )}
                    <ExpandableImage
                      src={s.editedImageUrl}
                      alt={`${p?.nickname ?? 'Player'}'s redaction`}
                      className="w-full h-28 object-cover object-top"
                    />
                    <div className="px-2.5 py-1.5 flex items-center justify-between text-sm border-t-2 border-ink">
                      <span className="truncate font-semibold">{p?.nickname ?? '—'}</span>
                      {voting && (
                        <span className="tabular-nums font-display font-black text-grief">♥{s.votesCount}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {room.isHost && (
            <div className="flex flex-wrap gap-2 mt-6">
              <button className="btn-primary" onClick={room.returnToLobby}>
                Play Again →
              </button>
            </div>
          )}
          {!room.isHost && <p className="text-ink3 text-sm mt-6 italic">Awaiting the Host’s next move…</p>}
        </div>

        <div className="card p-5 h-fit">
          <div className="kicker text-xs mb-3 pb-2 border-b border-ink/25">
            {voting ? 'Standings' : 'The Newsroom'}
          </div>
          <PlayerList players={state.players} meId={room.playerId} showScores={voting} canRemove={room.isHost} onRemove={room.removePlayer} />
          {!voting && (
            <p className="text-xs text-ink3 mt-3 italic">
              Scoring is off. Flip on voting in the newsroom to keep score.
            </p>
          )}
        </div>
      </div>

      <Recap room={room} />
    </div>
  );
}
