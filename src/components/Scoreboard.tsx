import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';

export function Scoreboard({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound;
  const voting = state.votingEnabled;

  const results = round ? [...round.submissions].sort((a, b) => b.votesCount - a.votesCount) : [];
  const topVotes = results[0]?.votesCount ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px] animate-fade-up">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏁</span>
          <div className="font-display text-lg font-bold">Round {state.roundNumber} results</div>
        </div>
        {results.length === 0 ? (
          <div className="text-white/60 py-6 text-center">No submissions this round.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((s) => {
              const p = state.players.find((pl) => pl.id === s.playerId);
              const isWinner = voting && s.votesCount > 0 && s.votesCount === topVotes;
              return (
                <div key={s.id} className={`relative rounded-2xl overflow-hidden bg-panel2 ring-2 transition ${isWinner ? 'ring-gold shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)]' : 'ring-white/10'}`}>
                  {isWinner && <span className="absolute top-1.5 left-1.5 z-10 text-lg drop-shadow">🏆</span>}
                  <img src={s.editedImageUrl} alt="" className="w-full h-28 object-cover object-top" />
                  <div className="px-2.5 py-2 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{p?.nickname ?? '—'}</span>
                    {voting && <span className="tabular-nums font-display font-bold text-gold">♥{s.votesCount}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {room.isHost && (
          <div className="flex flex-wrap gap-2 mt-6">
            <button className="btn-primary" onClick={() => room.startRound()}>Play another round →</button>
            <button className="btn-secondary" onClick={room.returnToLobby}>Back to lobby</button>
          </div>
        )}
        {!room.isHost && <p className="text-white/50 text-sm mt-6">Waiting for the host to continue…</p>}
      </div>

      <div className="card p-5 h-fit">
        <div className="text-sm font-display font-semibold text-white/80 mb-3">{voting ? '🏆 Standings' : 'Players'}</div>
        <PlayerList players={state.players} meId={room.playerId} showScores={voting} />
        {!voting && (
          <p className="text-xs text-white/40 mt-3">Scoring is off. Turn on voting in the lobby to keep score.</p>
        )}
      </div>
    </div>
  );
}
