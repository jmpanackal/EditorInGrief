/**
 * Catalog of join-screen / player-chip avatar IDs.
 * Assets live at `/avatars/{id}.svg` (see `public/avatars/`).
 */
export const AVATAR_IDS = [
  'raccoon',
  'owl',
  'fox',
  'cat',
  'bear',
  'crow',
  'penguin',
  'rabbit',
  'pug',
  'frog',
  'sheep',
  'duck',
  'moose',
  'hedgehog',
  'octopus',
  'presscat',
  'typewriter',
  'reporter',
  'stampdog',
  'inkblot',
  'parrot',
  'skeleton',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

const AVATAR_SET: ReadonlySet<string> = new Set(AVATAR_IDS);

export function isAvatarId(value: string | null | undefined): value is AvatarId {
  return typeof value === 'string' && AVATAR_SET.has(value);
}

/** Public URL for an avatar asset (or null if unknown / missing). */
export function avatarUrl(avatarId: string | null | undefined): string | null {
  if (!isAvatarId(avatarId)) return null;
  return `/avatars/${avatarId}.svg`;
}

/** Pick a random catalog id (used as the join-screen default). */
export function randomAvatarId(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
}

/** Cycle forward/backward through the catalog (wraps). */
export function cycleAvatarId(current: string | null | undefined, delta: 1 | -1): AvatarId {
  const idx = isAvatarId(current) ? AVATAR_IDS.indexOf(current) : -1;
  const base = idx >= 0 ? idx : 0;
  const next = (base + delta + AVATAR_IDS.length) % AVATAR_IDS.length;
  return AVATAR_IDS[next]!;
}

/** Normalize a client-supplied id; fall back to a random valid one. */
export function resolveAvatarId(value: string | null | undefined): AvatarId {
  return isAvatarId(value) ? value : randomAvatarId();
}
