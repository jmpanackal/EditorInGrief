/**
 * Realistic post composition:
 * - short paragraphs (1–3 sentences), blank lines between
 * - at most ONE numbered list per post (and only for list/howto structures)
 * - long posts = multiple paragraphs, not stacked lists
 * - avoid colon-label templates and stock closers
 */
import { pick, CITIES } from './pools.mjs';
import { BEATS } from './content.mjs';
import { formatListItems } from './curated-patterns.mjs';

const SOFT_CLOSERS = [
  'That is the update for now.',
  'Writing it down so I do not forget.',
  'Sharing in case it helps someone else.',
  'Leaving it here.',
  'Noticing this more lately.',
  'Working on it.',
  'One step at a time.',
  'Appreciate the people who made this easier.',
  'Happy to compare notes.',
  'That is all I have tonight.',
  'Quiet week, useful lesson.',
  'Filing this under things I want to remember.',
  'Maybe obvious. Still true for me.',
  'I needed the reminder myself.',
  '',
  '',
  '', // empty = often no closer (more realistic)
];

const RARE_CLOSERS = ['Still learning.', 'Back to it.', 'Onward.'];

const TRYHARD_CLOSERS = [
  'Curious how others handle this.',
  'What would you have done?',
  'Open to other approaches.',
];

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function trimToMax(text, max) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;
  return words.slice(0, max).join(' ');
}

function ensureUsed(used) {
  if (!used) return { sentences: new Set(), hooks: new Set(), fillers: new Set() };
  if (!used.sentences) used.sentences = new Set();
  if (!used.hooks) used.hooks = new Set();
  if (!used.fillers) used.fillers = new Set();
  return used;
}

function pickUnused(rng, pool, usedSet) {
  const unused = pool.filter((x) => !usedSet.has(x));
  const choice = pick(rng, unused.length ? unused : pool);
  usedSet.add(choice);
  return choice;
}

function joinParagraphs(parts) {
  return parts.filter(Boolean).join('\n\n');
}

function listBlock(rng, topic, count = 4) {
  const generic = [
    'Say the constraint out loud early.',
    'Write the decision where others can find it.',
    'Follow up once, clearly.',
    'Leave room for a real question.',
    'Protect one block of uninterrupted time.',
    'Check who is missing before you decide.',
    'Close the loop when it is done.',
    'Trade perfect for finished when the clock is real.',
  ];
  const topicExtra = {
    parenting: ['Put phones away for one stretch.', 'Name the feeling before fixing it.', 'Keep one routine boring on purpose.'],
    pets: ['Keep the walk even when weather is annoying.', 'Budget for the unexpected vet bill.', 'Celebrate tiny training wins.'],
    fitness: ['Schedule it like a meeting.', 'Sleep counts as training.', 'Progressive overload beats hero days.'],
    personal_finance: ['Automate the boring transfers.', 'Review subscriptions quarterly.', 'Talk numbers without blame.'],
    healthcare: ['Take the break you are owed.', 'Document for the next person.', 'Thank the quiet teammates.'],
    teaching: ['Ask clearer questions.', 'Cut slides that do not earn their place.', 'Protect grading time boundaries.'],
  };
  const pool = [...(topicExtra[topic] || []), ...generic];
  const items = [];
  const shuffled = pool.slice().sort(() => rng() - 0.5);
  for (const x of shuffled) {
    if (items.includes(x)) continue;
    items.push(x);
    if (items.length >= count) break;
  }
  return formatListItems(items, rng);
}

/**
 * Build a coherent multi-paragraph body from the same topic pack.
 */
export function composeBody({ topic, voice, structure, rng, minW, maxW, tryhard, company, name, used: usedIn }) {
  const used = ensureUsed(usedIn);
  const pack = BEATS[topic] || BEATS.workplace;
  const first = (name || 'Friend').split(' ')[0];

  const hook = pickUnused(rng, pack.hooks, used.hooks);
  const d1 = pickUnused(rng, pack.details, used.sentences).replace(/\bthe team\b/i, () =>
    rng() < 0.25 ? `the team at ${company}` : 'the team',
  );
  const d2 = pickUnused(rng, pack.details, used.sentences);
  const d3 = pickUnused(rng, pack.details, used.sentences);
  const lesson = pickUnused(rng, pack.lessons, used.sentences);
  const lesson2 = pickUnused(rng, pack.lessons, used.sentences);

  let closer = '';
  if (tryhard && rng() < 0.55) closer = pick(rng, TRYHARD_CLOSERS);
  else if (rng() < 0.72) closer = pick(rng, SOFT_CLOSERS.filter(Boolean));
  else if (rng() < 0.03) closer = pick(rng, RARE_CLOSERS);
  // else no closer — common in real posts
  else closer = '';

  const city = pick(rng, CITIES);

  /** Structures — prefer prose; lists only when structure asks, once. */
  let parts = [];
  let usedList = false;

  switch (structure) {
    case 'short_update':
      parts = [hook, d1, closer];
      break;

    case 'story_lesson':
      parts = [hook, d1, d2, lesson, closer];
      break;

    case 'short_list':
      parts = [hook, d1, listBlock(rng, topic, 4), lesson, closer];
      usedList = true;
      break;

    case 'howto_steps':
      parts = [`${hook} Here is what helped.`, listBlock(rng, topic, 5), lesson, closer];
      usedList = true;
      break;

    case 'quote_reply': {
      const quotes = [
        'Can we move the deadline?',
        'I thought someone else owned this.',
        'Is this urgent or just loud?',
        'What does good look like by Friday?',
      ];
      parts = [
        hook,
        `Someone wrote, "${pick(rng, quotes)}"`,
        `I answered with the messy truth. ${d1}`,
        lesson,
        closer,
      ];
      break;
    }

    case 'opinion_support':
      parts = [hook, lesson, d1, d2, closer];
      break;

    case 'news_lede':
      parts = [hook, `In ${city}, ${d1.charAt(0).toLowerCase()}${d1.slice(1)}`, lesson, closer];
      break;

    case 'before_after':
      parts = [
        `I used to handle this badly. ${d1}`,
        `What changed is simpler than it sounds. ${d2}`,
        lesson,
        closer,
      ];
      break;

    case 'two_voices':
      parts = [
        `There is the version I tell other people. ${hook}`,
        `Then there is what actually happened. ${d1}`,
        lesson,
        closer,
      ];
      break;

    case 'open_letter':
      parts = [
        `For anyone juggling more than they admit.`,
        hook,
        d1,
        lesson,
        `— ${first}`,
        closer,
      ];
      break;

    case 'qa_self_interview':
      // Avoid "Q:" / "A:" colon spam — use prose beats instead
      parts = [
        hook,
        `What actually happened is less dramatic than it felt. ${d1}`,
        `What I am taking from it is practical. ${lesson}`,
        d2,
        closer,
      ];
      break;

    case 'timeline_week':
      // Soft day markers without colon stacks
      parts = [
        `Monday started with a mess. ${d1}`,
        `By Wednesday the pattern was obvious. ${d2}`,
        `Friday I finally named it out loud. ${lesson}`,
        closer,
      ];
      break;

    case 'myth_vs_reality':
      parts = [
        `I kept telling myself a tidy story. ${hook}`,
        `The real version was quieter and harder. ${d1}`,
        `So I changed one habit. ${lesson}`,
        closer,
      ];
      break;

    case 'email_forward':
      parts = [
        `I keep a short thread on this. ${hook}`,
        d1,
        `My note back to the group was basically this. ${lesson}`,
        closer,
      ];
      break;

    case 'metrics_then_human':
      parts = [
        d1,
        `The part dashboards miss is the human friction. ${d2}`,
        lesson,
        closer,
      ];
      break;

    case 'thread_beats':
      // Twitter-ish short beats without "1/" labels that feel templated
      parts = [hook, d1, d2, lesson, closer];
      break;

    default:
      parts = [hook, d1, lesson, closer];
  }

  // Long posts: add paragraphs from same topic (never a second list)
  let body = joinParagraphs(parts);
  let guard = 0;
  while (wordCount(body) < minW && guard++ < 20) {
    if (!usedList && structure === 'short_list' && guard === 1) {
      // already have list; expand with paragraphs only
    }
    const extra = pickUnused(rng, pack.details, used.sentences);
    const extraL = pickUnused(rng, pack.lessons, used.sentences);
    if (guard % 2 === 0) body = joinParagraphs([body, extra]);
    else body = joinParagraphs([body, extraL]);
  }

  if (wordCount(body) > maxW) body = trimToMax(body, maxW);
  guard = 0;
  while (wordCount(body) < minW && guard++ < 10) {
    body = `${body} ${pickUnused(rng, pack.lessons, used.sentences)}`;
  }
  if (wordCount(body) > maxW) body = trimToMax(body, maxW);

  // Light voice adjust
  if (voice === 'casual_online') {
    body = body.replace(/\bI am\b/g, () => (rng() < 0.45 ? "I'm" : 'I am'));
  }

  // Strip accidental double list blocks if any slipped in
  const listMatches = body.match(/^\d+\.\s/gm) || [];
  if (listMatches.length > 6) {
    // too list-heavy — rebuild as paragraphs
    body = joinParagraphs([hook, d1, d2, d3, lesson, lesson2, closer].filter(Boolean));
    while (wordCount(body) < minW) body = joinParagraphs([body, pickUnused(rng, pack.details, used.sentences)]);
    if (wordCount(body) > maxW) body = trimToMax(body, maxW);
  }

  return body.trim();
}

export { TRYHARD_CLOSERS };
