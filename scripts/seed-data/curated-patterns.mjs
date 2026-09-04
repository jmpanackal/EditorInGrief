/**
 * Structural lessons from curated real LinkedIn / YouTube screenshots
 * (`public/seed/curated/`). Used as light guidance for the synthetic composer —
 * not a full rewrite of generation.
 *
 * Observed patterns worth preserving in SVG seeds over time:
 *
 * LinkedIn broetry
 * - Short single-sentence (or 1–2 sentence) paragraphs with heavy blank lines
 * - Often NO numbered lists; when lists appear, hyphen bullets (`- item`) show up
 * - Common arcs: hook (money / hot take) → anecdote → moral / CTA
 * - Occasional dense run-on block (anti-broetry) still happens
 *
 * LinkedIn · post + reply
 * - Parent is airy broetry; reply is denser prose or a one-line clapback
 * - High-friction threads: hot take → skeptical / snarky rebuttal
 * - Worth a future SVG render (two stacked author blocks) — not shipped yet
 *
 * News / article crops
 * - Headline + byline + lead graf; dense prose, not broetry whitespace
 * - Good for long-bucket timer pacing
 *
 * X / Twitter long posts
 * - Dense job-post / manifesto style; numbered requirements; controversial CTAs
 *
 * YouTube · comment thread
 * - Parent can be earnest / longer; replies are short, informal, typo-prone
 * - Nested replies under a thread line; grammar degrades down the chain
 *
 * Batch 2 themes worth mirroring in synthetics (tone sincere-cringe, not parody-flag):
 * - Anti-WFH / office-mandate lists; vacation Slack check-ins
 * - Hire / pregnancy / legal-optics panic posts
 * - AI encyclopedia / “10x underage engineer” hype
 * - Compound-interest coffee lectures; phone-greeting coaching
 * - Satire that still reads earnest (bedframe VC, Amazon leadership principle)
 */

/** Prefer hyphen bullets over `1. 2. 3.` most of the time (real LI vibe). */
export function formatListItems(items, rng) {
  const useHyphen = !rng || rng() < 0.72;
  if (useHyphen) return items.map((x) => `- ${x}`).join('\n');
  return items.map((x, i) => `${i + 1}. ${x}`).join('\n');
}

/** Extra informal YouTube reply beats (parent stays cleaner; replies get punchy). */
export const YT_REPLY_BEATS = [
  'but could be worse if u give in',
  'wrong you can always dig deeper',
  'this should be pinned',
  'nah that take ages badly',
  'lmao the comments under this',
  'bro really said that with his chest',
  'underrated reply tbh',
  'came here for this exact comment',
];
