import { avatarUrl } from '@shared/avatars';

/**
 * Matches SVG plate radius (rx=18 on 128 viewBox). Catalog assets already draw
 * the ink stroke — wrappers must not add a second CSS border.
 */
export const AVATAR_PLATE_RADIUS = 'rounded-[14.0625%]';

/**
 * Player chip / monogram plate. Shows the catalog avatar when `avatarId` is
 * set; otherwise falls back to the letter-initial square (legacy seats).
 */
export function PlayerAvatar({
  nickname,
  avatarId,
  connected = true,
  size = 'md',
  className = '',
  title,
}: {
  nickname: string;
  avatarId?: string | null;
  connected?: boolean;
  /** sm=9, md=10, rail=11 (lobby strip), lg=14 */
  size?: 'sm' | 'md' | 'rail' | 'lg';
  className?: string;
  title?: string;
}) {
  const src = avatarUrl(avatarId);
  const initial = (nickname.trim().slice(0, 1) || '?').toUpperCase();
  const box =
    size === 'lg'
      ? 'w-14 h-14 text-xl'
      : size === 'rail'
        ? 'w-11 h-11 text-base'
        : size === 'sm'
          ? 'w-9 h-9 text-sm'
          : 'w-10 h-10 text-base';

  if (src) {
    return (
      <div
        className={`relative ${box} ${AVATAR_PLATE_RADIUS} overflow-hidden shrink-0 ${
          connected ? 'bg-papercard' : 'bg-paper2 opacity-70'
        } ${className}`}
        title={title ?? nickname}
      >
        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
    );
  }

  // Letter fallback has no SVG stroke — single CSS border with matching radius.
  return (
    <div
      className={`relative ${box} ${AVATAR_PLATE_RADIUS} grid place-items-center font-display font-black border-2 shrink-0 ${
        connected ? 'border-ink bg-ink text-paper' : 'border-ink bg-paper2 text-ink3'
      } ${className}`}
      title={title ?? nickname}
    >
      {initial}
    </div>
  );
}
