import type { Player } from '@shared/types';

export function PlayerList({ players, meId, showScores, canRemove = false, onRemove, maxPlayers }: {
  players: Player[];
  meId: string | null;
  showScores?: boolean;
  canRemove?: boolean;
  onRemove?: (playerId: string) => void;
  /** When given, empty seats are rendered up to this count (Gartic-style
   * "how many slots are open" affordance) — omit outside the lobby, where
   * capacity isn't relevant (scoreboard, etc.). */
  maxPlayers?: number;
}) {
  const sorted = showScores ? [...players].sort((a, b) => b.score - a.score) : players;
  const openSeats = maxPlayers != null ? Math.max(0, maxPlayers - players.length) : 0;
  // A wall of faded "Empty seat" rows makes an early, sparsely-filled room
  // look heavier than it is — show a handful, then fold the rest into a
  // single summary line so absence doesn't dominate the screen.
  const shownEmptySeats = Math.min(openSeats, 3);
  const foldedEmptySeats = openSeats - shownEmptySeats;
  return (
    <ul className="flex flex-col divide-y divide-ink/15">
      {sorted.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          {/* Ink monogram plate */}
          <div className={`relative w-10 h-10 rounded-[3px] grid place-items-center font-display font-black text-base border-2 border-ink shrink-0 ${p.connected ? 'bg-ink text-paper' : 'bg-paper2 text-ink3'}`}>
            {p.nickname.slice(0, 1).toUpperCase()}
            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-ink ${p.connected ? 'bg-grief' : 'bg-paper2'}`} />
          </div>
          <span className={`font-semibold truncate text-base ${p.connected ? 'text-ink' : 'text-ink3 line-through'}`}>{p.nickname}</span>
          {showScores && i === 0 && p.score > 0 && <span title="Front-page lead">🏆</span>}
          {p.isHost && <span className="badge">Host</span>}
          {p.id === meId && <span className="badge border-grief text-grief">You</span>}
          <span className="flex-1" />
          {showScores && <span className="tabular-nums font-display font-black text-lg text-grief">{p.score}</span>}
          {canRemove && !p.isHost && (
            <button type="button" className="btn-ghost !px-2 !py-1.5 text-sm text-grief" onClick={() => onRemove?.(p.id)} aria-label={`Remove ${p.nickname} from the room`}>
              Remove
            </button>
          )}
        </li>
      ))}
      {Array.from({ length: shownEmptySeats }).map((_, i) => (
        <li key={`empty-${i}`} className="flex items-center gap-3 py-2.5 opacity-50">
          <div className="w-10 h-10 rounded-[3px] grid place-items-center border-2 border-dashed border-ink/40 text-ink3 shrink-0">
            <span className="text-sm">?</span>
          </div>
          <span className="text-ink3 italic text-base">Empty seat</span>
        </li>
      ))}
      {foldedEmptySeats > 0 && (
        <li className="flex items-center gap-3 py-2 opacity-70">
          <div className="w-10 h-10 rounded-[3px] grid place-items-center border border-dashed border-ink/30 shrink-0">
            <span className="text-ink3 text-sm font-bold">+{foldedEmptySeats}</span>
          </div>
          <span className="text-ink3 italic text-sm">{foldedEmptySeats} more open seat{foldedEmptySeats === 1 ? '' : 's'}</span>
        </li>
      )}
    </ul>
  );
}
