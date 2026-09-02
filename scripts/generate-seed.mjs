/**
 * Seed-bank generator for "Editor in Grief".
 *
 * We can't source real screenshots, so we render mock social-media / news posts
 * as self-contained SVG "screenshots" into public/seed/, plus a manifest.json.
 *
 * Why SVG (not PNG)? It's dependency-free and cross-platform (no native `canvas`
 * build on Windows). Browsers render same-origin SVG in <img>, and drawing that
 * <img> onto a canvas does NOT taint it, so the redaction editor can still
 * flatten to a real PNG on submit. Good enough to be fully testable.
 *
 * Run: `npm run seed`  (outputs to /public/seed)
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'seed');

// ---------------------------------------------------------------------------
// Mock post data (deliberately cringy/ridiculous — that's the joke)
// ---------------------------------------------------------------------------
const POSTS = [
  {
    platform: 'linkedin', name: 'Chad Synergy', handle: 'Chief Vibes Officer @ HustleCorp',
    body: `I fired my highest performer today.\n\nWhy? He asked for a raise.\n\nAt HustleCorp we don't reward people who "want more money." We reward passion. We reward grit. We reward showing up at 4:45 AM to grind before the grind.\n\nRemember: your salary is a mindset. Agree?`,
  },
  {
    platform: 'linkedin', name: 'Brenda Ladderclimb', handle: 'Thought Leader | Ex-Google | Girlboss',
    body: `A homeless man asked me for change today.\n\nInstead of money, I handed him my business card and told him about the power of personal branding.\n\nHe didn't say thank you. Some people just aren't ready to scale.`,
  },
  {
    platform: 'linkedin', name: 'Tyler Growthmind', handle: 'Founder, CEO, Visionary, Dad, Athlete',
    body: `Rejection email from a candidate today:\n\n"I noticed the role pays $32k for a Senior Engineer with 9 years experience."\n\nEntitlement is a disease. We offer something money can't buy: exposure. I will die on this hill.`,
  },
  {
    platform: 'twitter', name: 'nightowl', handle: '@doomscroller3am',
    body: `just microwaved my phone instead of my burrito and honestly? both of us are cooked now`,
  },
  {
    platform: 'twitter', name: 'Kevin', handle: '@kevin_takes_L',
    body: `unpopular opinion but i think cereal is a soup and the milk is the broth and if you disagree you are simply not thinking about it hard enough. blocked.`,
  },
  {
    platform: 'twitter', name: 'crypto king 🚀', handle: '@moonboy_capital',
    body: `sold my car to buy the dip. sold the dip to buy a smaller dip. i now live inside the dip. this is financial freedom and you are all still slaves to your "jobs"`,
  },
  {
    platform: 'twitter', name: 'wellness coach', handle: '@rawwater_randy',
    body: `Day 14 of only drinking sunlight. I have never felt more energy. My doctor is "concerned" but he also eats bread so who's really the sick one here.`,
  },
  {
    platform: 'youtube', name: '@GamerLord9000', handle: '2.3K subscribers • 4 hours ago',
    body: `first!!! also nobody gonna talk about how the guy in the back at 3:47 is CLEARLY a time traveler?? wake up sheeple this whole video is staged by the government to sell more toasters`,
  },
  {
    platform: 'youtube', name: '@ProudParent55', handle: 'reply • 1 day ago',
    body: `back in MY day we didn't have "tutorials" we just figured it out or we DIED. this generation can't even change a tire without watching a 40 minute video with 6 sponsor segments. sad!!`,
  },
  {
    platform: 'youtube', name: '@RecipeHater', handle: 'reply • 2 weeks ago',
    body: `i made this recipe but i replaced the flour with sand, removed the sugar, used no oven, and it came out terrible. 0 stars. would not recommend. the author clearly doesn't know how to cook.`,
  },
  {
    platform: 'news', name: 'The Daily Overstate', handle: 'BREAKING NEWS',
    body: `Local Man Who Read One Article Now Smartest Person At Dinner Table, Family Confirms\n\n"He mentioned 'the algorithm' four times," said his exhausted wife. "We just wanted to eat lasagna."`,
  },
  {
    platform: 'news', name: 'Regional Herald', handle: 'TECHNOLOGY',
    body: `Study Finds 100% Of People Surveyed Were Asked A Question\n\nResearchers spent $2.4 million to determine that participants who were given a survey did, in fact, receive a survey. "Groundbreaking," said no one.`,
  },
  {
    platform: 'news', name: 'City Times', handle: 'LIFESTYLE',
    body: `Man Announces He's "Basically A Chef" After Successfully Boiling Water Without Setting Off Smoke Alarm\n\nHe is now accepting reservations for a dinner party he will inevitably cancel.`,
  },
  {
    platform: 'facebook', name: 'Sharon Pattersen', handle: 'Just now • 🌎 Public',
    body: `PLEASE READ AND SHARE!!! I heard from my sister's coworker's dentist that if you microwave a grape it opens a portal. The GOVERNMENT doesn't want you to know this. Do your own research!!! 🍇🔥`,
  },
  {
    platform: 'facebook', name: 'Uncle Dave', handle: '3 hrs • 😡',
    body: `so let me get this straight. i have to press "1" for english IN MY OWN COUNTRY? unbelievable. anyway happy birthday to my beautiful granddaughter i love you sweetie ❤️ (how do i post just to her)`,
  },
  {
    platform: 'twitter', name: 'startup guy', handle: '@disrupt_everything',
    body: `we're not a "lemonade stand." we're a hyper-local, direct-to-consumer, citrus-based beverage platform leveraging synergistic sidewalk infrastructure. seeking $4M seed round. no lemons yet.`,
  },
  {
    platform: 'linkedin', name: 'Karen Optimize', handle: 'People-First Leader (I laid off 400 people)',
    body: `Grateful and humbled to announce I've made the difficult decision to let go of 30% of my team so I could afford a second boat.\n\nThis was the hardest thing I've ever posted from my yacht. #Blessed #Leadership`,
  },
  {
    platform: 'youtube', name: '@FactChecker42', handle: 'reply • 3 days ago',
    body: `ackshually the earth isn't round OR flat. it's shaped like a burrito. i have a 9 hour video explaining this with no evidence but a lot of confidence. link in my bio (i don't have a bio)`,
  },
];

// ---------------------------------------------------------------------------
// Theme per platform
// ---------------------------------------------------------------------------
const THEMES = {
  linkedin: { bg: '#ffffff', header: '#f3f2ef', name: '#000000c9', handle: '#00000099', body: '#000000d9', accent: '#0a66c2', avatar: '#0a66c2' },
  twitter:  { bg: '#ffffff', header: '#ffffff', name: '#0f1419', handle: '#536471', body: '#0f1419', accent: '#1d9bf0', avatar: '#1d9bf0' },
  youtube:  { bg: '#ffffff', header: '#ffffff', name: '#0f0f0f', handle: '#606060', body: '#0f0f0f', accent: '#065fd4', avatar: '#ff0000' },
  news:     { bg: '#fffdf7', header: '#111111', name: '#111111', handle: '#b91c1c', body: '#1a1a1a', accent: '#b91c1c', avatar: '#111111' },
  facebook: { bg: '#ffffff', header: '#f0f2f5', name: '#050505', handle: '#65676b', body: '#050505', accent: '#1877f2', avatar: '#1877f2' },
};

const WIDTH = 720;
const PAD = 36;
const AVATAR = 56;

// naive word-wrap: approx char width for the given font size
function wrapParagraph(text, fontSize, maxWidth) {
  const charW = fontSize * 0.54; // rough average glyph width
  const maxChars = Math.max(8, Math.floor(maxWidth / charW));
  const lines = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '') { lines.push(''); continue; }
    let cur = '';
    for (const word of rawLine.split(' ')) {
      const test = cur ? cur + ' ' + word : word;
      if (test.length > maxChars && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initials(name) {
  return name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function renderSvg(post) {
  const t = THEMES[post.platform] ?? THEMES.twitter;
  const bodyFont = 26;
  const contentWidth = WIDTH - PAD * 2;
  const bodyLines = wrapParagraph(post.body, bodyFont, contentWidth);
  const lineH = Math.round(bodyFont * 1.4);

  const headerH = 40 + AVATAR;
  const bodyTop = headerH + 24;
  const bodyH = bodyLines.length * lineH;
  const footerH = 64;
  const height = bodyTop + bodyH + footerH;

  const isNews = post.platform === 'news';

  const bodyTspans = bodyLines
    .map((ln, i) => `<tspan x="${PAD}" dy="${i === 0 ? 0 : lineH}">${esc(ln) || ' '}</tspan>`)
    .join('');

  // header
  const avatarCx = PAD + AVATAR / 2;
  const avatarCy = 28 + AVATAR / 2;
  const textX = PAD + AVATAR + 16;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Segoe UI, Helvetica, Arial, sans-serif">
  <rect width="${WIDTH}" height="${height}" fill="${t.bg}"/>
  ${isNews ? `<rect x="0" y="0" width="${WIDTH}" height="${headerH}" fill="${t.header}"/>` : ''}
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${AVATAR / 2}" fill="${t.avatar}"/>
  <text x="${avatarCx}" y="${avatarCy}" fill="#ffffff" font-size="24" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(initials(post.name))}</text>
  <text x="${textX}" y="42" fill="${isNews ? '#ffffff' : t.name}" font-size="24" font-weight="700">${esc(post.name)}</text>
  <text x="${textX}" y="72" fill="${isNews ? '#ffd7d7' : t.handle}" font-size="18">${esc(post.handle)}</text>
  <text x="${PAD}" y="${bodyTop + bodyFont}" fill="${t.body}" font-size="${bodyFont}" style="white-space:pre">${bodyTspans}</text>
  <line x1="${PAD}" y1="${height - footerH + 8}" x2="${WIDTH - PAD}" y2="${height - footerH + 8}" stroke="#00000014" stroke-width="1"/>
  <text x="${PAD}" y="${height - 22}" fill="${t.handle}" font-size="18">♥ ${1 + (post.body.length % 900)}   ↺ ${1 + (post.body.length % 120)}   💬 ${1 + (post.body.length % 60)}</text>
  <text x="${WIDTH - PAD}" y="${height - 22}" fill="${t.accent}" font-size="16" font-weight="600" text-anchor="end">${post.platform.toUpperCase()}</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Emit files
// ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });

// clean previously generated seed files
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.svg') || f === 'manifest.json') unlinkSync(join(outDir, f));
}

const manifest = [];
POSTS.forEach((post, idx) => {
  const n = String(idx + 1).padStart(2, '0');
  const id = `seed-${n}`;
  const file = `${id}.svg`;
  writeFileSync(join(outDir, file), renderSvg(post), 'utf8');
  manifest.push({
    id,
    imageUrl: `/seed/${file}`,
    wordCount: wordCount(post.body),
    label: `${post.name} (${post.platform})`,
  });
});

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Generated ${manifest.length} seed sources -> ${outDir}`);
