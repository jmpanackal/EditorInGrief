import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';

export function Scoreboard({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound;
  const voting = state.votingEnabled;

  const results = round ? [...round.submissions].sort((a, b) => b.votesCount - a.votesCount) : [];
  const topVotes = results[0]?.votesCount ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div className="card p-5">
        <div className="text-sm text-white/50 mb-3">Round {state.roundNumber} results</div>
        {results.length === 0 ? (
          <div className="text-white/60">No submissions.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((s) => {
              const p = state.players.find((pl) => pl.id === s.playerId);
              const isWinner = voting && s.votesCount > 0 && s.votesCount === topVotes;
              return (
                <div key={s.id} className={`rounded-xl overflow-hidden bg-panel2 ring-2 ${isWinner ? 'ring-grief' : 'ring-white/10'}`}>
                  <img src={s.editedImageUrl} alt="" className="w-full h-28 object-cover object-top" />
                  <div className="px-2 py-1.5 flex items-center justify-between text-sm">
                    <span className="truncate">{p?.nickname ?? '—'}</span>
                    {voting && <span className="tabular-nums text-accent">♥{s.votesCount}</span>}
                    {isWinner && <span className="pill">🏆</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {room.isHost && (
          <div className="flex flex-wrap gap-2 mt-5">
            <button className="btn-primary" onClick={() => room.startRound()}>Play another round →</button>
            <button className="btn-secondary" onClick={room.returnToLobby}>Back to lobby</button>
          </div>
        )}
        {!room.isHost && <p className="text-white/50 text-sm mt-5">Waiting for the host…</p>}
      </div>

      <div className="card p-5">
        <div className="text-sm text-white/50 mb-3">{voting ? 'Standings' : 'Players'}</div>
        <PlayerList players={state.players} meId={room.playerId} showScores={voting} />
        {!voting && (
          <p className="text-xs text-white/40 mt-3">Scoring is off. Turn on voting in the lobby to keep score.</p>
        )}
      </div>
    </div>
  );
}
