import type { RoomApi } from '../state/useRoom';
import { ExpandableImage } from './ExpandableImage';

/** A separate, equal-weight ballot after the Host has finished the presentation. */
export function Voting({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound!;
  const myVote = room.playerId ? round.votes[room.playerId] : undefined;
  const count = round.submissions.length;

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="card p-5 text-center">
        <div className="kicker text-[11px]">The ballot is open</div>
        <h2 className="font-display font-black text-2xl mt-1">Choose the edition that got you.</h2>
        <p className="text-sm text-ink2 mt-1">Every filing gets the same space. You may change your vote; you cannot vote for your own edit.</p>
        <p className="text-xs text-ink3 mt-1 italic">Tallies stay sealed until the ballot closes — no peeking at the count.</p>
      </div>

      <div className="card p-4 sm:p-5">
        <div
          className={`flex flex-wrap justify-center gap-4 ${
            count === 1 ? 'max-w-xl mx-auto' : count === 2 ? 'max-w-4xl mx-auto' : ''
          }`}
        >
          {round.submissions.map((submission) => {
            const player = state.players.find((p) => p.id === submission.playerId);
            const isMine = submission.playerId === room.playerId;
            const isPicked = myVote === submission.id;
            return (
              <article
                key={submission.id}
                className={`relative flex w-full flex-col rounded-[3px] overflow-hidden border-2 bg-papercard ${
                  count >= 3
                    ? 'sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]'
                    : count === 2
                      ? 'sm:w-[calc(50%-0.5rem)]'
                      : ''
                } ${isPicked ? 'border-grief shadow-clip' : 'border-ink'}`}
              >
                <ExpandableImage
                  src={submission.editedImageUrl}
                  alt={`${player?.nickname ?? 'Player'}'s redaction`}
                  className="w-full h-52 object-contain bg-paper2"
                />
                <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-ink px-3 py-2.5">
                  <span className="font-semibold truncate">{player?.nickname ?? '—'}</span>
                  {isMine ? (
                    <span className="text-xs text-ink3 italic whitespace-nowrap">Your edit</span>
                  ) : (
                    <button
                      className={
                        isPicked
                          ? 'btn-primary !px-3 !py-1.5 text-sm whitespace-nowrap'
                          : 'btn-secondary !px-3 !py-1.5 text-sm whitespace-nowrap'
                      }
                      title={isPicked ? 'Click again to clear your vote' : undefined}
                      onClick={() => room.castVote(isPicked ? null : submission.id)}
                    >
                      {isPicked ? '✓ Your pick' : '♥ Vote for this'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {room.isHost ? (
        <button className="btn-primary self-end" onClick={room.showScoreboard}>Close ballot & tally →</button>
      ) : (
        <p className="text-center text-ink3 text-sm italic">Vote when you are ready. The Host will close the ballot.</p>
      )}
    </div>
  );
}
