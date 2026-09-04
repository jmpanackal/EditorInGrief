import type { Player } from '@shared/types';

export function PlayerList({
  players,
  meId,
  showScores,
  canRemove = false,
  onRemove,
  maxPlayers,
  layout = 'list',
}: {
  players: Player[];
  meId: string | null;
  showScores?: boolean;
  canRemove?: boolean;
  onRemove?: (playerId: string) => void;
  /** When given, empty seats are rendered up to this count (Gartic-style
   * "how many slots are open" affordance) — omit outside the lobby, where
   * capacity isn't relevant (scoreboard, etc.). */
  maxPlayers?: number;
  /** `rail` = compact horizontal avatar strip (mobile lobby); `list` = stacked rows. */
  layout?: 'list' | 'rail';
}) {
  const sorted = showScores ? [...players].sort((a, b) => b.score - a.score) : players;
  const openSeats = maxPlayers != null ? Math.max(0, maxPlayers - players.length) : 0;
  // A wall of faded "Empty seat" rows makes an early, sparsely-filled room
  // look heavier than it is — show a handful, then fold the rest into a
  // single summary line so absence doesn't dominate the screen.
  const shownEmptySeats = Math.min(openSeats, 3);
  const foldedEmptySeats = openSeats - shownEmptySeats;

  if (layout === 'rail') {
    return (
      <ul
        // pt so You/host badges above the avatar aren't clipped by overflow-x
        // (setting overflow-x forces a non-visible overflow-y).
        className="flex flex-row items-stretch gap-2.5 overflow-x-auto themed-scroll pt-2.5 pb-0.5 -mb-0.5"
        aria-label="Players in the room"
      >
        {sorted.map((p, i) => (
          <li key={p.id} className="flex flex-col items-center gap-1 w-[3.75rem] shrink-0">
            <div className="relative">
              <div
                className={`w-11 h-11 rounded-[3px] grid place-items-center font-display font-black text-base border-2 border-ink ${
                  p.connected ? 'bg-ink text-paper' : 'bg-paper2 text-ink3'
                }`}
                title={p.nickname}
              >
                {p.nickname.slice(0, 1).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-ink ${
                  p.connected ? 'bg-grief' : 'bg-paper2'
                }`}
                aria-hidden
              />
              {p.isHost && (
                <span
                  className="absolute -top-1.5 -right-1.5 text-[11px] leading-none drop-shadow-sm"
                  title="Host"
                  aria-label="Host"
                >
                  👑
                </span>
              )}
              {p.id === meId && (
                <span
                  className="absolute -top-1 -left-1 badge !px-1 !py-0 text-[8px] leading-tight border-grief text-grief bg-papercard"
                  title="You"
                >
                  You
                </span>
              )}
              {showScores && i === 0 && p.score > 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px]" title="Front-page lead">
                  🏆
                </span>
              )}
              {canRemove && !p.isHost && (
                <button
                  type="button"
                  className="absolute -bottom-1.5 -left-1.5 w-5 h-5 rounded-full bg-papercard border border-ink text-grief text-xs font-bold leading-none grid place-items-center z-10"
                  onClick={() => onRemove?.(p.id)}
                  aria-label={`Remove ${p.nickname} from the room`}
                >
                  ×
                </button>
              )}
            </div>
            <span
              className={`w-full text-center text-[11px] font-semibold leading-tight truncate ${
                p.connected ? 'text-ink' : 'text-ink3 line-through'
              }`}
            >
              {p.nickname}
            </span>
            {showScores && (
              <span className="tabular-nums font-display font-black text-xs text-grief leading-none">
                {p.score}
              </span>
            )}
          </li>
        ))}
        {Array.from({ length: shownEmptySeats }).map((_, i) => (
          <li key={`empty-${i}`} className="flex flex-col items-center gap-1 w-[3.75rem] shrink-0 opacity-45">
            <div className="w-11 h-11 rounded-[3px] grid place-items-center border-2 border-dashed border-ink/40 text-ink3">
              <span className="text-sm">?</span>
            </div>
            <span className="w-full text-center text-[10px] italic text-ink3 leading-tight uppercase tracking-wide">
              Empty
            </span>
          </li>
        ))}
        {foldedEmptySeats > 0 && (
          <li className="flex flex-col items-center gap-1 w-[3.75rem] shrink-0 opacity-60">
            <div className="w-11 h-11 rounded-[3px] grid place-items-center border border-dashed border-ink/30">
              <span className="text-ink3 text-sm font-bold">+{foldedEmptySeats}</span>
            </div>
            <span className="w-full text-center text-[10px] italic text-ink3 leading-tight">
              more
            </span>
          </li>
        )}
      </ul>
    );
  }

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
