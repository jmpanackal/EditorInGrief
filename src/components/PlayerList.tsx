import type { Player } from '@shared/types';

export function PlayerList({ players, meId, showScores }: { players: Player[]; meId: string | null; showScores?: boolean }) {
  const sorted = showScores ? [...players].sort((a, b) => b.score - a.score) : players;
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((p) => (
        <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel2 border border-white/10">
          <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-white/25'}`} />
          <span className="font-medium">{p.nickname}</span>
          {p.isHost && <span className="pill">host</span>}
          {p.id === meId && <span className="pill">you</span>}
          <span className="flex-1" />
          {showScores && <span className="tabular-nums font-bold text-accent">{p.score}</span>}
        </li>
      ))}
    </ul>
  );
}
