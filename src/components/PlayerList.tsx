import type { Player } from '@shared/types';

export function PlayerList({ players, meId, showScores }: { players: Player[]; meId: string | null; showScores?: boolean }) {
  const sorted = showScores ? [...players].sort((a, b) => b.score - a.score) : players;
  return (
    <ul className="flex flex-col divide-y divide-ink/15">
      {sorted.map((p, i) => (
        <li key={p.id} className="flex items-center gap-2.5 py-2">
          {/* Ink monogram plate */}
          <div className={`relative w-8 h-8 rounded-[3px] grid place-items-center font-display font-black text-sm border-2 border-ink ${p.connected ? 'bg-ink text-paper' : 'bg-paper2 text-ink3'}`}>
            {p.nickname.slice(0, 1).toUpperCase()}
            <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-ink ${p.connected ? 'bg-grief' : 'bg-paper2'}`} />
          </div>
          <span className={`font-semibold truncate ${p.connected ? 'text-ink' : 'text-ink3 line-through'}`}>{p.nickname}</span>
          {showScores && i === 0 && p.score > 0 && <span title="Front-page lead">🏆</span>}
          {p.isHost && <span className="badge">Editor</span>}
          {p.id === meId && <span className="badge border-grief text-grief">You</span>}
          <span className="flex-1" />
          {showScores && <span className="tabular-nums font-display font-black text-lg text-grief">{p.score}</span>}
        </li>
      ))}
    </ul>
  );
}
