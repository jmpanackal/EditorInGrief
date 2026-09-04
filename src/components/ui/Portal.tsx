import { createPortal } from 'react-dom';

/**
 * Renders children directly under `document.body`, escaping whatever DOM
 * position called it. Modals/dialogs use `fixed inset-0`, which is supposed
 * to cover the true viewport — but that breaks if any ancestor establishes a
 * CSS containing block for fixed-position descendants (a `transform`,
 * `filter`, or `backdrop-filter` — e.g. the sticky header's `backdrop-blur`).
 * When that happens the "fixed" overlay silently resolves against the
 * ancestor's own box instead of the viewport, so a modal can render squashed
 * into a corner instead of centered on the page. A portal sidesteps the
 * whole class of bug by never being a descendant of that ancestor to begin
 * with, regardless of what styling the call site happens to sit inside.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
