import { avatarUrl, cycleAvatarId, type AvatarId } from '@shared/avatars';
import { AVATAR_PLATE_RADIUS } from './PlayerAvatar';

/**
 * Avatar preview: single square plate (SVG provides fill + border + corners)
 * + Gartic-style shuffle control docked to the bottom-right corner.
 */
export function AvatarPicker({
  avatarId,
  onChange,
}: {
  avatarId: AvatarId;
  onChange: (id: AvatarId) => void;
}) {
  const src = avatarUrl(avatarId)!;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[7.5rem] h-[7.5rem] sm:w-36 sm:h-36">
        <div
          className={`w-full h-full ${AVATAR_PLATE_RADIUS} overflow-hidden bg-papercard`}
          aria-hidden
        >
          <img
            key={avatarId}
            src={src}
            alt=""
            className="w-full h-full object-cover animate-pop"
            draggable={false}
          />
        </div>

        {/* Shuffle only — no prev/next; cycles forward through the catalog */}
        <button
          type="button"
          className={`absolute -bottom-0.5 -right-0.5 w-11 h-11 ${AVATAR_PLATE_RADIUS} bg-papercard border-2 border-ink text-grief
                     grid place-items-center hover:bg-paper2 active:bg-paper2
                     transition focus:outline-none focus-visible:ring-2 focus-visible:ring-grief/50`}
          onClick={() => onChange(cycleAvatarId(avatarId, 1))}
          aria-label="Shuffle character"
          title="Shuffle character"
        >
          <ShuffleIcon />
        </button>
      </div>
      <p className="kicker text-[10px] text-ink3">Pick a face for the desk</p>
    </div>
  );
}

function ShuffleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12a8 8 0 0 1 13.66-5.66M20 4v6h-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12a8 8 0 0 1-13.66 5.66M4 20v-6h6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
