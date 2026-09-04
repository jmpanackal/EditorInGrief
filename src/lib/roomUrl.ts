/**
 * Invite / join URL helpers.
 *
 * The Newsroom invite control shows live `state.code` (e.g. "Y26N"). Share
 * links must use that same code. We also keep `window.location` in sync so
 * copying the address bar (or leaving a tab open on an old invite) cannot
 * advertise a different room than the one you're actually in.
 */

const CODE_PARAM_KEYS = ['code', 'room'] as const;

/** Absolute join URL for the given live room code. */
export function buildJoinUrl(code: string, origin: string = window.location.origin): string {
  const normalized = code.toUpperCase().trim();
  const url = new URL('/', origin);
  url.searchParams.set('code', normalized);
  return url.toString();
}

/** Read a room code from the current page URL (`?code=` or `?room=`). */
export function parseJoinCodeFromLocation(search: string = window.location.search): string | null {
  const params = new URLSearchParams(search);
  for (const key of CODE_PARAM_KEYS) {
    const raw = params.get(key);
    if (raw && raw.trim()) return raw.toUpperCase().trim();
  }
  return null;
}

/**
 * Keep the address bar aligned with the live room (or clear it when not in one).
 * Uses replaceState so we don't pollute history while hopping rooms.
 */
export function syncRoomUrl(code: string | null): void {
  try {
    const url = new URL(window.location.href);
    const current = parseJoinCodeFromLocation(url.search);
    const next = code ? code.toUpperCase().trim() : null;

    if (next) {
      if (current === next && !url.searchParams.has('room')) return;
      url.search = '';
      url.searchParams.set('code', next);
    } else {
      if (!current && !url.searchParams.has('room') && !url.searchParams.has('code')) return;
      url.search = '';
    }

    const href = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', href);
  } catch {
    /* ignore (non-browser / locked history) */
  }
}
