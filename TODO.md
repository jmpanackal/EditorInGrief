# Editor in Grief — TODO / backlog

Living list of ideas and known issues from ongoing UI/UX passes. Not roadmap-ordered — pick off whatever's next.

## Content pipeline

- [ ] **Ethical source-content pipeline** (real variety without real-person risk): an *offline* dev-time script — fetch text only via Reddit's official API (OAuth, not raw scraping), never store/display the original username/avatar/image, re-render the text through the existing `scripts/generate-seed.mjs` SVG template with a fake generated handle/avatar, human-reviews-before-commit (same as today's static seed bank, not a live in-app feed). Discussed and deferred — not started.
- [ ] Alternative/parallel: just hand-write a much bigger batch of fully-synthetic posts (more categories/formats) to expand `scripts/generate-seed.mjs` — zero external dependency, could do anytime.

## Gameplay loop

- [ ] Vote-to-shuffle a wire-photo filler card, instead of host-only. Shuffle is host-only for now (matches "Choose"); worth reconsidering once the always-≥2 shelf has been played with a bit.
- [ ] Live reactions during Reveal (emoji burst, ephemeral, no persisted state) — biggest lift of the original review list, explicitly dropped for later.
- [ ] Presentation-settings screen for Reveal: auto vs. manual advance, optional voice-over/TTS reading the sentence.
- [ ] Persistent player roster visible during Reveal/Voting (currently only in Lobby/Scoreboard).
- [ ] Optional round-count setting so the table knows how long a session is committed to.

## Accessibility & polish

- [ ] Focus-visible styling on custom buttons (`.btn-primary`, `.btn-secondary`, `.segmented-item`, editor tool buttons) — currently rely on browser default only.
- [ ] Contrast pass on `ink3` (`#6b655c` on `#f4f1e9`) — likely borderline WCAG AA at the small sizes it's used at (kickers, captions).
- [ ] More audio/haptic cues at key beats (submit, GO, winner reveal) — only the countdown danger-tick beep exists today.
- [ ] Error toast (`App.tsx`) has no manual dismiss, just a 3.5s auto-timeout.
- [ ] "Hold to see original" (`Reveal.tsx`) is mouse/touch-only, no keyboard equivalent.
- [ ] `Recap.tsx`'s "↗ Share (soon)" button is permanently disabled — either build it or remove it, a dead button reads as broken.
- [ ] Optional dark theme (deliberate light "newsprint" look today; a night-mode inversion could help low-light couch play).

## Done (for reference — most recent first)

- [x] **Host-transfer race** fixed: `server/index.ts` now tracks a `playerId -> current socket` map; a socket's `close` only calls `markDisconnected` if it's still the socket on record for that player. Previously a stale/duplicate socket for the same `playerId` (e.g. a page reload's old connection closing after the new one had already reconnected) could wrongly flip a still-connected host to disconnected and, after the grace window, hand the room to someone else — reported live as "the invited player becomes host."
- [x] Leave-confirm modal centered correctly and no longer visually collided with page content behind it: it was a descendant of the sticky header, whose `backdrop-blur-sm` (a `backdrop-filter`) makes it the containing block for `position: fixed` descendants in every major browser — so the modal's `fixed inset-0` was resolving against the header's small box instead of the true viewport. Fixed with a `Portal` component (`src/components/ui/Portal.tsx`) that renders straight to `document.body`.
- [x] Lobby polish pass: removed "Open seats show below" (redundant with the roster right below it) and the "Hold the press" waiting banner (the Start-bar area already says "Awaiting the Host…" for non-hosts; the banner was pure extra height, enough on its own to force a scroll for anyone who wasn't the host). Vote-count badge is now a red circular badge instead of a small black pill, so it reads at a glance instead of blending into the card's own black photo/byline chrome. Choose and Shuffle (both host-only actions on a filler card) now share the same button weight and sit next to each other; Remove (available to the uploader or host, not host-exclusive, and a one-way delete rather than "swap") stays the quieter link off on its own. The "Add a screenshot" tile lost its nested box-in-a-box (an inner bordered panel inside the outer dashed tile) and its separate "Drop · Click · Paste" line — one box, the affordance folded into the existing subtitle.
- [x] Fixed shuffle asymmetry: shuffling the left shelf card was visibly changing both cards (right survivor got reflowed back to index 0), while shuffling the right card correctly touched only itself. `gameStore.syncFillerSlots` now takes an `insertAt` index and splices any backfill into the exact vacated slot instead of rebuilding the array — every other card keeps its exact position. Also reversed the "upload replaces a filler" model per feedback: filing a screenshot now only ever *adds* a new tile (never auto-trims a filler once uploads reach the floor); people remove ones they don't want via the existing Shuffle/Remove buttons, and the floor is still maintained (backfills) only on explicit removal. The "Add a screenshot" dropzone moved from a slim strip below the shelf into the same `grid-cols-2` as an actual tile — sized to match a card (h-56 image area + info strip), spanning the full row when it would otherwise sit alone. Copy no longer mentions "replacing" anything.
- [x] Shelf always shows ≥2 candidates: real uploads first, wire-bank "filler" sources pad the rest (server-enforced via `gameStore.syncFillerSlots`, called on room creation, return-to-lobby, upload, and remove). Fillers are votable/choosable like any source; "Remove" becomes "🔀 Shuffle" on a filler card since it always gets backfilled. Retired the old single-hero "Today's story" preview in favor of this. Section renamed "Choose Today's Story". Fixed a latent bug found while in there: `clearSource` was deleting seed-bank entries from the *global* registry (shared across all rooms) instead of only real uploads; also scoped `pickSource`'s random fallback to the room's own shelf instead of every room's uploads ever seen.
- [x] Wire-photo preview always shows the real pick (auto-selected + shuffle via existing `selectSource`), not just an example.
- [x] Source Material tab: reordered so the result (wire photo / shelf) leads, upload zone is secondary; bigger/centered images instead of stretched-with-empty-gutters.
- [x] Lobby: players-left/settings-right layout, folder-style Source/Round-Settings tabs, capped+scrollable roster with capacity (`maxPlayers`) and empty-seat placeholders, "Next story" resolution summary, solo-start confirm, Leave confirm.
- [x] Header: centered title, Leave far left, removed "How to play" + online-count clutter.
- [x] Landing screen: invite-link vs. organic distinction, how-to-play carousel, sized to use more of the viewport.
- [x] Editor: trimmed toolbar (Box/Marker default, Tap-text/Eraser behind "More").
- [x] Hid vote counts until the ballot closes; "Next round" shortcut skips back to the Lobby.
