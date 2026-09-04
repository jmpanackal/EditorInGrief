/**
 * Seed-bank generator for "Editor in Grief".
 *
 *   npm run seed           → wave 1 (50 short / 50 mid / 50 long)
 *   npm run seed -- --full → 300 per bucket (900)
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pick } from './seed-data/pools.mjs';
import {
  firstNWords,
  wordCount,
  TRYHARD_CLOSERS,
} from './seed-data/content.mjs';
import { createGeneratePosts } from './seed-data/generate-posts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'seed');

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const REPORT_ONLY = args.includes('--report-only');

const BUCKETS = {
  short: { min: 20, max: 45, count: FULL ? 300 : 50 },
  mid: { min: 85, max: 115, count: FULL ? 300 : 50 },
  long: { min: 210, max: 300, count: FULL ? 300 : 50 },
};

const PLATFORM_MIX = [
  ['linkedin', 0.4],
  ['twitter', 0.25],
  ['facebook', 0.15],
  ['youtube', 0.1],
  ['news', 0.1],
];

const BANNED_NAME_RE =
  /\b(synergy|hustlecorp|hustle corp|grindify|vibes officer|growthmind|ladderclimb|moonboy|disrupt_everything|rawwater)\b/i;

const MAX_FIRST_NAME = FULL ? 4 : 2;

const THEMES = {
  linkedin: { bg: '#ffffff', header: '#f3f2ef', name: '#000000c9', handle: '#00000099', body: '#000000d9', accent: '#0a66c2', avatar: '#0a66c2' },
  twitter: { bg: '#ffffff', header: '#ffffff', name: '#0f1419', handle: '#536471', body: '#0f1419', accent: '#1d9bf0', avatar: '#1d9bf0' },
  youtube: { bg: '#0f0f0f', header: '#0f0f0f', name: '#f1f1f1', handle: '#aaaaaa', body: '#f1f1f1', accent: '#3ea6ff', avatar: '#ff0000' },
  news: { bg: '#fffdf7', header: '#111111', name: '#111111', handle: '#b91c1c', body: '#1a1a1a', accent: '#b91c1c', avatar: '#111111' },
  facebook: { bg: '#ffffff', header: '#f0f2f5', name: '#050505', handle: '#65676b', body: '#050505', accent: '#1877f2', avatar: '#1877f2' },
};

const WIDTH = 720;
const PAD = 36;
const AVATAR = 56;

function wrapParagraph(text, fontSize, maxWidth) {
  const charW = fontSize * 0.54;
  const maxChars = Math.max(8, Math.floor(maxWidth / charW));
  const lines = [];
  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '') {
      lines.push('');
      continue;
    }
    let cur = '';
    for (const word of rawLine.split(' ')) {
      const test = cur ? `${cur} ${word}` : word;
      if (test.length > maxChars && cur) {
        lines.push(cur);
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initials(name) {
  return (
    name
      .replace(/[^A-Za-z ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}

function displayNameForPlatform(platform, name, rng) {
  if (platform === 'youtube') return `@${name.split(' ')[0].replace(/[^A-Za-z]/g, '')}${Math.floor(rng() * 90 + 10)}`;
  if (platform === 'news') {
    return pick(rng, [
      'Regional Herald',
      'City Ledger',
      'Metro Daily',
      'County Record',
      'Harbor Tribune',
      'Prairie Dispatch',
    ]);
  }
  return name;
}

/** Shelf labels for Suggested fillers: platform · format only (never author names). */
function typeLabelForPost(post) {
  switch (post.platform) {
    case 'linkedin':
      return 'LinkedIn · post';
    case 'twitter':
      return 'X · post';
    case 'facebook':
      return 'Facebook · post';
    case 'youtube':
      return 'YouTube · comment';
    case 'news':
      return 'News · article';
    default:
      return 'Post';
  }
}

function firstNameOf(displayName, fallbackFullName) {
  if (displayName.startsWith('@')) {
    const m = displayName.slice(1).match(/^[A-Za-z]+/);
    return (m ? m[0] : fallbackFullName.split(' ')[0]).toLowerCase();
  }
  if (/Herald|Ledger|Daily|Record|Tribune|Dispatch/i.test(displayName)) {
    return fallbackFullName.split(' ')[0].toLowerCase();
  }
  return displayName.split(' ')[0].toLowerCase();
}

function renderYoutubeComment(post) {
  const t = THEMES.youtube;
  const av = 40;
  const bodyFont = 22;
  const pad = 28;
  const contentWidth = WIDTH - pad * 2 - av - 14;
  const bodyLines = wrapParagraph(post.body, bodyFont, contentWidth);
  const lineH = Math.round(bodyFont * 1.35);
  const nameRowY = 36;
  const bodyTop = 58;
  const bodyH = Math.max(lineH, bodyLines.length * lineH);
  const actionY = bodyTop + bodyH + 28;
  const height = actionY + 36;
  const avCx = pad + av / 2;
  const avCy = 40;
  const textX = pad + av + 14;
  const likes = 3 + (post.body.length % 240);
  const bodyTspans = bodyLines
    .map((ln, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : lineH}">${esc(ln) || ' '}</tspan>`)
    .join('');
  const handle = post.handle || '2 days ago';
  const nameWidth = Math.min(280, 12 + post.name.length * 8.2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Roboto, Segoe UI, Helvetica, Arial, sans-serif">
  <rect width="${WIDTH}" height="${height}" fill="${t.bg}"/>
  <circle cx="${avCx}" cy="${avCy}" r="${av / 2}" fill="#ff0000"/>
  <text x="${avCx}" y="${avCy}" fill="#ffffff" font-size="16" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(initials(post.name.replace('@', '')))}</text>
  <text x="${textX}" y="${nameRowY}" fill="${t.name}" font-size="15" font-weight="700">${esc(post.name)}</text>
  <text x="${textX + nameWidth}" y="${nameRowY}" fill="${t.handle}" font-size="13">${esc(handle)}</text>
  <text x="${textX}" y="${bodyTop + bodyFont}" fill="${t.body}" font-size="${bodyFont}">${bodyTspans}</text>
  <text x="${textX}" y="${actionY}" fill="${t.handle}" font-size="14">👍 ${likes}    👎     Reply</text>
</svg>`;
}

function renderSvg(post) {
  if (post.platform === 'youtube') return renderYoutubeComment(post);

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
  const avatarCx = PAD + AVATAR / 2;
  const avatarCy = 28 + AVATAR / 2;
  const textX = PAD + AVATAR + 16;
  const footerIcons =
    post.platform === 'twitter'
      ? `♥ ${1 + (post.body.length % 900)}   ↺ ${1 + (post.body.length % 120)}   💬 ${1 + (post.body.length % 60)}`
      : post.platform === 'facebook'
        ? 'Like · Comment · Share'
        : `♥ ${1 + (post.body.length % 900)}   💬 ${1 + (post.body.length % 60)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Segoe UI, Helvetica, Arial, sans-serif">
  <rect width="${WIDTH}" height="${height}" fill="${t.bg}"/>
  ${isNews ? `<rect x="0" y="0" width="${WIDTH}" height="${headerH}" fill="${t.header}"/>` : ''}
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${AVATAR / 2}" fill="${t.avatar}"/>
  <text x="${avatarCx}" y="${avatarCy}" fill="#ffffff" font-size="24" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(initials(post.name))}</text>
  <text x="${textX}" y="42" fill="${isNews ? '#ffffff' : t.name}" font-size="24" font-weight="700">${esc(post.name)}</text>
  <text x="${textX}" y="72" fill="${isNews ? '#ffd7d7' : t.handle}" font-size="18">${esc(post.handle)}</text>
  <text x="${PAD}" y="${bodyTop + bodyFont}" fill="${t.body}" font-size="${bodyFont}">${bodyTspans}</text>
  <line x1="${PAD}" y1="${height - footerH + 8}" x2="${WIDTH - PAD}" y2="${height - footerH + 8}" stroke="#00000014" stroke-width="1"/>
  <text x="${PAD}" y="${height - 22}" fill="${t.handle}" font-size="18">${footerIcons}</text>
  <text x="${WIDTH - PAD}" y="${height - 22}" fill="${t.accent}" font-size="16" font-weight="600" text-anchor="end">${post.platform.toUpperCase()}</text>
</svg>`;
}

function buildVarietyReport(posts) {
  const topics = new Set();
  const voices = new Set();
  const structures = new Set();
  const structureHist = {};
  const platforms = {};
  const buckets = {};
  const first8 = new Map();
  const firstNameCounts = new Map();
  let tryhardClosers = 0;
  const nameLens = [];
  let banned = 0;

  for (const p of posts) {
    topics.add(p.topic);
    voices.add(p.voice);
    structures.add(p.structure);
    structureHist[p.structure] = (structureHist[p.structure] || 0) + 1;
    platforms[p.platform] = (platforms[p.platform] || 0) + 1;
    buckets[p.bucket] = (buckets[p.bucket] || 0) + 1;
    const key = firstNWords(p.body, 8);
    first8.set(key, (first8.get(key) || 0) + 1);
    if (TRYHARD_CLOSERS.some((c) => p.body.trim().endsWith(c))) tryhardClosers += 1;
    nameLens.push(p.name.length);
    if (BANNED_NAME_RE.test(p.name) || BANNED_NAME_RE.test(p.handle) || BANNED_NAME_RE.test(p.company || '')) banned += 1;
    const fn = (p.firstName || firstNameOf(p.name, p.name)).toLowerCase();
    firstNameCounts.set(fn, (firstNameCounts.get(fn) || 0) + 1);
  }

  const uniqueFirst8 = [...first8.keys()].length;
  const uniqueRatio = posts.length ? uniqueFirst8 / posts.length : 0;
  const maxFirst8 = Math.max(0, ...first8.values());
  const shortNames = nameLens.filter((n) => n < 10).length;
  const longNames = nameLens.filter((n) => n > 18).length;
  const maxFirstNameCount = Math.max(0, ...firstNameCounts.values());
  const structureValues = Object.values(structureHist);
  const structureMax = Math.max(0, ...structureValues);
  const structureMin = Math.min(...structureValues);
  const expectedPerStructure = posts.length / Math.max(1, structures.size);
  const structureEven = structureMax <= Math.ceil(expectedPerStructure * (FULL ? 2.8 : 2.5));

  const gates = {
    topicsMin: FULL ? topics.size >= 24 : topics.size >= 18,
    voicesMin: FULL ? voices.size >= 10 : voices.size >= 8,
    structuresMin: FULL ? structures.size >= 12 : structures.size >= 10,
    uniqueFirst8: FULL ? uniqueRatio >= 0.92 : uniqueRatio >= 0.95,
    maxOpenerFreq: FULL ? maxFirst8 <= 4 : maxFirst8 <= 3,
    tryhardCloserShare: tryhardClosers / Math.max(1, posts.length) <= 0.25,
    bannedNames: banned === 0,
    nameLengthSpread: shortNames >= 1 && longNames >= 1,
    maxFirstNameFreq: maxFirstNameCount <= MAX_FIRST_NAME + 1,
    structureEvenness: structureMax <= Math.ceil(expectedPerStructure * (FULL ? 3.2 : 2.8)),
  };

  return {
    generatedAt: new Date().toISOString(),
    mode: FULL ? 'full' : 'wave1',
    total: posts.length,
    platforms,
    buckets,
    topicCount: topics.size,
    voiceCount: voices.size,
    structureCount: structures.size,
    structureHistogram: structureHist,
    structureSpread: structureMax - structureMin,
    uniqueFirst8Ratio: Number(uniqueRatio.toFixed(4)),
    maxFirst8Repeat: maxFirst8,
    maxFirstNameCount,
    tryhardCloserShare: Number((tryhardClosers / Math.max(1, posts.length)).toFixed(4)),
    bannedHits: banned,
    nameLength: {
      min: Math.min(...nameLens),
      max: Math.max(...nameLens),
      shortCount: shortNames,
      longCount: longNames,
    },
    gates,
    passed: Object.values(gates).every(Boolean),
  };
}

const generatePosts = createGeneratePosts({
  FULL,
  BUCKETS,
  PLATFORM_MIX,
  BANNED_NAME_RE,
  MAX_FIRST_NAME,
  displayNameForPlatform,
});

function loadCuratedEntries() {
  // Curated real screenshots live in public/seed/curated/ + manifest.curated.json.
  // Never delete that folder here — only wipe synthetic SVGs / variety report.
  const curatedPath = join(outDir, 'manifest.curated.json');
  if (!existsSync(curatedPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(curatedPath, 'utf8'));
    return Array.isArray(raw) ? raw.filter((e) => String(e?.id || '').startsWith('curated-')) : [];
  } catch {
    return [];
  }
}

function emit(posts) {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    // Preserve curated/ subdirectory and manifest.curated.json across regen.
    if (f.endsWith('.svg') || f === 'manifest.json' || f === 'variety-report.json') {
      unlinkSync(join(outDir, f));
    }
  }

  const manifest = [];
  posts.forEach((post, idx) => {
    const n = String(idx + 1).padStart(FULL ? 4 : 3, '0');
    const id = `seed-${n}`;
    const file = `${id}.svg`;
    writeFileSync(join(outDir, file), renderSvg(post), 'utf8');
    manifest.push({
      id,
      imageUrl: `/seed/${file}`,
      wordCount: post.wordCount ?? wordCount(post.body),
      label: typeLabelForPost(post),
      bucket: post.bucket,
      topic: post.topic,
      title: post.title || null,
    });
  });

  const curated = loadCuratedEntries();
  if (curated.length) manifest.push(...curated);

  const report = buildVarietyReport(posts);
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  writeFileSync(join(outDir, 'variety-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(
    `Generated ${manifest.length} seed sources (${posts.length} synthetic + ${curated.length} curated) -> ${outDir}`,
  );
  console.log(`Variety report passed: ${report.passed}`);
  console.log(JSON.stringify(report.gates, null, 2));
  console.log(
    `topics=${report.topicCount} voices=${report.voiceCount} structures=${report.structureCount} uniqueFirst8=${report.uniqueFirst8Ratio} maxFirstName=${report.maxFirstNameCount}`,
  );
  console.log('platforms', JSON.stringify(report.platforms));
  console.log('structureHistogram', JSON.stringify(report.structureHistogram));
  if (!report.passed) {
    console.warn('Variety gates failed — inspect public/seed/variety-report.json');
    process.exitCode = 1;
  }
}

if (REPORT_ONLY) {
  console.log('Re-run npm run seed to regenerate with metadata.');
  process.exit(0);
}

const posts = generatePosts();
emit(posts);
