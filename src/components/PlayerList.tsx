import type { Player } from '@shared/types';

/** Deterministic avatar tint from a player id so faces feel distinct. */
const AVATAR_TINTS = [
  'bg-grief/25 text-grieflite',
  'bg-blurple/25 text-blurple',
  'bg-accent/25 text-accent',
  'bg-mint/25 text-mint',
  'bg-gold/25 text-gold',
];
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

export function PlayerList({ players, meId, showScores }: { players: Player[]; meId: string | null; showScores?: boolean }) {
  const sorted = showScores ? [...players].sort((a, b) => b.score - a.score) : players;
  return (
    <ul className="flex flex-col gap-1.5">
      {sorted.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
            p.connected ? 'bg-panel2/60 hover:bg-panel2' : 'bg-panel2/30'
          }`}
        >
          <div className={`relative w-8 h-8 rounded-lg grid place-items-center font-display font-bold text-sm ${tintFor(p.id)} ${p.connected ? '' : 'opacity-50 grayscale'}`}>
            {p.nickname.slice(0, 1).toUpperCase()}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-panel ${p.connected ? 'bg-mint' : 'bg-white/25'}`}
            />
          </div>
          <span className={`font-medium truncate ${p.connected ? '' : 'text-white/40'}`}>{p.nickname}</span>
          {showScores && i === 0 && p.score > 0 && <span>👑</span>}
          {p.isHost && <span className="badge">host</span>}
          {p.id === meId && <span className="badge border-grief/40 text-grieflite">you</span>}
          <span className="flex-1" />
          {showScores && <span className="tabular-nums font-display font-bold text-accent">{p.score}</span>}
        </li>
      ))}
    </ul>
  );
}
