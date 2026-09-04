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
        <li key={p.id} className="flex items-center gap-2 py-2.5">
          {/* Ink monogram plate */}
          <div className={`relative w-10 h-10 rounded-[3px] grid place-items-center font-display font-black text-base border-2 border-ink shrink-0 ${p.connected ? 'bg-ink text-paper' : 'bg-paper2 text-ink3'}`}>
            {p.nickname.slice(0, 1).toUpperCase()}
            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-ink ${p.connected ? 'bg-grief' : 'bg-paper2'}`} />
          </div>

          {/* Name + badges: name keeps content width first; badges wrap rather
              than forcing early ellipsis on short nicknames. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className={`min-w-0 font-semibold text-base [overflow-wrap:anywhere] ${p.connected ? 'text-ink' : 'text-ink3 line-through'}`}>
              {p.nickname}
            </span>
            {showScores && i === 0 && p.score > 0 && (
              <span className="shrink-0" title="Front-page lead">🏆</span>
            )}
            {p.isHost && <span className="badge shrink-0">Host</span>}
            {p.id === meId && <span className="badge shrink-0 border-grief text-grief">You</span>}
          </div>

          {/* Stable score column so counts line up across rows with/without Remove. */}
          {showScores && (
            <span className="w-8 shrink-0 text-right tabular-nums font-display font-black text-lg text-grief">
              {p.score}
            </span>
          )}

          {/* Reserve Remove's width whenever the host can kick — empty for the
              host row so the score column stays aligned. */}
          {canRemove && (
            <div className="w-[4.75rem] shrink-0 flex justify-end">
              {!p.isHost && (
                <button
                  type="button"
                  className="btn-ghost !px-2 !py-1.5 text-sm text-grief"
                  onClick={() => onRemove?.(p.id)}
                  aria-label={`Remove ${p.nickname} from the room`}
                >
                  Remove
                </button>
              )}
            </div>
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
