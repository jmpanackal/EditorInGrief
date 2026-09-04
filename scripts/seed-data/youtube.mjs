/**
 * Varied YouTube comment voices — react to a video, not LinkedIn essays.
 * Many templates; avoid repeating thanks+react+timestamp every time.
 */
import { pick } from './pools.mjs';
import { YT_REPLY_BEATS } from './curated-patterns.mjs';

const TS = ['0:41', '1:12', '2:03', '3:17', '4:44', '5:28', '7:01', '8:19', '9:50', '11:06', '12:33', '14:02'];

const OPENERS = [
  'wait',
  'okay but',
  'lmao',
  'bro',
  'genuinely',
  'not gonna lie',
  'I lowkey',
  'as someone who',
  'came for the title stayed for',
  'why is this only getting recommended now',
  'algorithm finally did something useful',
  'watching this at work like',
  'my headphones in so deep',
  'paused to try it and',
  'rewound three times because',
  'commenting so I can find this later',
  'telling on myself but',
  'if you skip around',
];

const MID = [
  'this is the cleanest explanation I have seen',
  'I have been doing the wrong order for months',
  'the demo is what sold me',
  'I thought I understood until the example',
  'my notes app is crying',
  'this should be required watching for juniors',
  'the comments are unhinged but the video is solid',
  'I failed once then it clicked',
  'way better than the 40 minute version I watched last week',
  'no weird flex just useful',
  'the pacing is respectful of my time',
  'I sent this to my group chat immediately',
  'hard disagree with one bit but overall fire',
  'this fixed a bug in my brain',
];

const ENDS = [
  'thanks',
  'subscribed',
  'saving this',
  'instant like',
  'needed that',
  'more please',
  'whew',
  'okay back to work',
  'going to try tomorrow',
  'legit helpful',
  ...YT_REPLY_BEATS,
  '',
  '',
  '',
];

const QUESTIONS = [
  'does this still work without the paid plan',
  'what about on mobile',
  'any chance of a follow up for edge cases',
  'timestamp for the troubleshooting bit',
  'is there a shorter cut for beginners',
  'how do you handle it when the UI changed',
];

const DISAGREE = [
  'I get the approach but it falls apart with messy real data',
  'solid teaching still think that shortcut is risky',
  'works in the video not sure about production',
  'respectfully the older method is more reliable for me',
];

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function trimToMax(text, max) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;
  return words.slice(0, max).join(' ');
}

function maybeLower(s, rng) {
  if (rng() < 0.4) return s.charAt(0).toLowerCase() + s.slice(1);
  return s;
}

const TEMPLATES = [
  (rng) => `${pick(rng, OPENERS)} ${pick(rng, TS)} ${pick(rng, MID)}. ${pick(rng, ENDS)}`.trim(),
  (rng) => `${pick(rng, MID)}. start around ${pick(rng, TS)}. ${pick(rng, ENDS)}`.trim(),
  (rng) => `${pick(rng, QUESTIONS)}? I got lost near ${pick(rng, TS)}.`,
  (rng) => `${pick(rng, DISAGREE)}. still glad I watched.`,
  (rng) => `who else tried this mid-video and broke something before ${pick(rng, TS)}`,
  (rng) => `underrated tip buried at ${pick(rng, TS)}. ${pick(rng, MID)}.`,
  (rng) => `${pick(rng, OPENERS)} I have watched this twice. first pass confused. second pass ${pick(rng, MID)}.`,
  (rng) => `not the comments fighting again. the actual content at ${pick(rng, TS)} is the point.`,
  (rng) => `me explaining it to my coworker tomorrow using only ${pick(rng, TS)} onward`,
  (rng) => `rare W from the recommendation engine. ${pick(rng, MID)}.`,
  (rng) => `I dislike how calm this is while destroying my old workflow. ${pick(rng, ENDS)}`.trim(),
  (rng) => `bookmarking because I will forget in 12 hours. ${pick(rng, TS)} is the money part.`,
  (rng) => `can we normalize tutorials that do not waste the first minute. this one does not. ${pick(rng, ENDS)}`.trim(),
  (rng) => `${pick(rng, OPENERS)} ${pick(rng, DISAGREE)}. ${pick(rng, QUESTIONS)}?`,
  (rng) => `watched on mute with captions and still followed. that is a flex on the editing.`,
  (rng) => `I came in skeptical. left taking notes. ${pick(rng, TS)} changed my mind.`,
  (rng) => `please make a part 2 for when everything goes wrong. ${pick(rng, ENDS)}`.trim(),
  (rng) => `this is the opposite of those fake productivity videos. ${pick(rng, MID)}.`,
  (rng) => `yelling at my past self for not finding this earlier`,
  (rng) => `short version. ${pick(rng, MID)}. long version. I rewound a lot.`,
];

export function composeYoutubeComment({ structure, rng, minW, maxW, topic, used }) {
  // structure hint nudges template family but we mostly pick for variety
  let body;
  if (structure === 'yt_question') {
    body = `${pick(rng, QUESTIONS)}? stuck around ${pick(rng, TS)}.`;
  } else if (structure === 'yt_disagree') {
    body = `${pick(rng, DISAGREE)}. ${pick(rng, MID)}.`;
  } else if (structure === 'yt_story') {
    body = joinLongStory(rng, minW);
  } else {
    body = pick(rng, TEMPLATES)(rng);
  }

  body = maybeLower(body, rng);
  body = body.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();

  // Expand long comments with extra beats (still comment-like, no lists)
  const extras = [
    'also the editing is clean',
    'no weird sponsor detour thank you',
    'watching at 1.25x and keeping up',
    'sharing with one person who asked this exact thing yesterday',
    'I tried it once messed up tried again it worked',
    'the pinned comment is actually useful for once',
    'ignore half the replies under this',
    'this aged better than the older tutorial I had bookmarked',
  ];
  const usedExtra = used?.sentences || new Set();
  let guard = 0;
  while (wordCount(body) < minW && guard++ < 16) {
    const line = pick(rng, extras.filter((x) => !usedExtra.has(x)).concat(extras));
    usedExtra.add(line);
    if (rng() < 0.5) body = `${body} ${line}.`;
    else body = `${body}\n\n${line}`;
  }
  if (wordCount(body) > maxW) body = trimToMax(body, maxW);
  return body.trim();
}

function joinLongStory(rng, minW) {
  const chunks = [
    `okay. watched this all the way through.`,
    `first half I was nodding. around ${pick(rng, TS)} I actually paused and tried it.`,
    pick(rng, MID) + '.',
    `then I came back and finished because I was annoyed I almost scrolled away.`,
    pick(rng, ENDS) || 'that is the review.',
  ];
  let body = chunks.join('\n\n');
  while (wordCount(body) < minW) {
    body = `${body}\n\n${pick(rng, MID)}.`;
  }
  return body;
}
