/**
 * Build / refresh the curated seed manifest from PNGs in public/seed/curated/.
 *
 *   npm run seed:curated
 *
 * Scans curated-*.png, OCRs word counts (tesseract.js), guesses labels, and writes
 * public/seed/manifest.curated.json. Also patches curated entries into
 * public/seed/manifest.json so the Suggested shelf picks them up without a full
 * `npm run seed`.
 *
 * Tomorrow's batch: drop new PNGs as curated-032.png … then re-run this script.
 * Optional label overrides: edit LABEL_OVERRIDES below (or rely on heuristics).
 */
import { createWorker } from 'tesseract.js';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'public', 'seed');
const curatedDir = join(seedDir, 'curated');
const curatedManifestPath = join(seedDir, 'manifest.curated.json');
const mainManifestPath = join(seedDir, 'manifest.json');

const args = process.argv.slice(2);
const SKIP_OCR = args.includes('--skip-ocr');

/**
 * Manual labels for known curated IDs (heuristics fill the rest).
 * Suggested shelf only — use platform · format (post / post + reply / …), never author names.
 */
const LABEL_OVERRIDES = {
  'curated-001': 'LinkedIn · post',
  'curated-010': 'LinkedIn · post',
  'curated-012': 'LinkedIn · post + reply',
  'curated-013': 'LinkedIn · post + reply',
  'curated-016': 'LinkedIn · post',
  'curated-017': 'LinkedIn · post + reply',
  'curated-018': 'LinkedIn · post',
  'curated-019': 'LinkedIn · post',
  'curated-020': 'LinkedIn · post + reply',
  'curated-021': 'LinkedIn · post',
  'curated-022': 'LinkedIn · post',
  'curated-023': 'LinkedIn · post',
  'curated-024': 'LinkedIn · post + replies',
  'curated-025': 'LinkedIn · post',
  'curated-026': 'LinkedIn · post',
  'curated-027': 'LinkedIn · post + reply',
  'curated-028': 'LinkedIn · post',
  'curated-029': 'YouTube · comment thread',
  'curated-030': 'YouTube · comment + reply',
  'curated-031': 'YouTube · comment + reply',
  // Batch 2 (2026-09-04) — format labels only; OCR fills unlabeled IDs
  'curated-043': 'LinkedIn · post',
  'curated-044': 'News · article',
  'curated-045': 'LinkedIn · post',
  'curated-046': 'LinkedIn · post',
  'curated-047': 'LinkedIn · post',
  'curated-048': 'LinkedIn · post',
  'curated-049': 'LinkedIn · post',
  'curated-050': 'LinkedIn · profile',
  'curated-051': 'LinkedIn · post',
  'curated-052': 'LinkedIn · post',
  'curated-053': 'LinkedIn · post',
  'curated-054': 'LinkedIn · post',
  'curated-055': 'LinkedIn · post',
  'curated-056': 'LinkedIn · post',
  'curated-057': 'X · post',
  'curated-058': 'LinkedIn · post + reply',
};

/** Allowed Suggested formats after the · — author/topic leftovers fall back via coerceTypeLabel. */
const TYPE_FORMATS = new Set([
  'post',
  'post + reply',
  'post + replies',
  'comment',
  'comment + reply',
  'comment thread',
  'article',
  'profile',
]);

function coerceTypeLabel(label) {
  const raw = String(label || '');
  const m = raw.match(/^(LinkedIn|YouTube|News|X|Twitter|Facebook)\s*·\s*(.+)$/i);
  if (!m) {
    // Legacy synthetic style: "Yusuf Lee (linkedin)" — should not appear in curated, but be safe.
    const paren = raw.match(/\((linkedin|twitter|facebook|youtube|news)\)\s*$/i);
    if (paren) {
      const p = paren[1].toLowerCase();
      if (p === 'linkedin') return 'LinkedIn · post';
      if (p === 'twitter') return 'X · post';
      if (p === 'facebook') return 'Facebook · post';
      if (p === 'youtube') return 'YouTube · comment';
      if (p === 'news') return 'News · article';
    }
    return raw || 'LinkedIn · post';
  }
  const platformNorm =
    /^linkedin$/i.test(m[1]) ? 'LinkedIn'
      : /^youtube$/i.test(m[1]) ? 'YouTube'
        : /^news$/i.test(m[1]) ? 'News'
          : /^(x|twitter)$/i.test(m[1]) ? 'X'
            : /^facebook$/i.test(m[1]) ? 'Facebook'
              : m[1];
  const format = m[2].trim().toLowerCase();
  if (TYPE_FORMATS.has(format)) return `${platformNorm} · ${format}`;
  // Author or topic after · → plain platform format
  if (platformNorm === 'YouTube') return 'YouTube · comment';
  if (platformNorm === 'News') return 'News · article';
  if (platformNorm === 'X' || platformNorm === 'Facebook') return `${platformNorm} · post`;
  return 'LinkedIn · post';
}

const UI_STOP = new Set(
  [
    'like',
    'comment',
    'comments',
    'repost',
    'reposts',
    'send',
    'follow',
    'following',
    'reply',
    'replies',
    'ago',
    'edited',
    'connect',
    'views',
    'most',
    'relevant',
    'visit',
    'my',
    'website',
    'view',
    'services',
    '1st',
    '2nd',
    '3rd',
    '3rd+',
  ].map((s) => s.toLowerCase()),
);

function bucketFor(wordCount) {
  if (wordCount < 50) return 'short';
  if (wordCount < 150) return 'mid';
  return 'long';
}

function guessLabel(id, text) {
  if (LABEL_OVERRIDES[id]) return LABEL_OVERRIDES[id];
  const lower = text.toLowerCase();
  const yt =
    /@\w+/.test(text) &&
    /\b(\d+\s*(year|month|week|day|hour|minute)s?\s+ago|edited)\b/i.test(text) &&
    !/\b(follow|repost|3rd\+|2nd)\b/i.test(lower);
  if (yt || (/@\w+/.test(text) && /\byear ago|days ago|day ago\b/i.test(lower))) {
    const stamps = (text.match(/\b\d+\s*(year|month|week|day|hour|minute)s?\s+ago\b/gi) || []).length;
    return stamps >= 2 ? 'YouTube · comment thread' : 'YouTube · comment';
  }
  const stamps = (text.match(/\b\d+[hdwm]\b/gi) || []).length;
  const replyUi = /add a comment|most relevant|\breply\b/i.test(lower);
  if (stamps >= 2 && replyUi) return 'LinkedIn · post + reply';
  if ((text.match(/\bLike\b/g) || []).length >= 2 && replyUi && stamps >= 1) {
    return 'LinkedIn · post + reply';
  }
  return 'LinkedIn · post';
}

function countWords(text, label) {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9$€£@]+|[^A-Za-z0-9%]+$/g, ''))
    .filter(Boolean)
    .filter((w) => !UI_STOP.has(w.toLowerCase()))
    .filter((w) => !/^\d+[hdwm]$/i.test(w));
  // OCR includes chrome; shave a little so timers track body density better.
  const chromePad = label.startsWith('YouTube') ? 10 : 22;
  return Math.max(18, words.length - chromePad);
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listCuratedPngs() {
  if (!existsSync(curatedDir)) return [];
  return readdirSync(curatedDir)
    .filter((f) => /^curated-\d+\.png$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function patchMainManifest(curatedEntries) {
  const main = readJson(mainManifestPath);
  if (!Array.isArray(main)) {
    console.warn('No main manifest.json yet — curated-only file written. Run npm run seed to merge.');
    return;
  }
  const synthetic = main.filter((s) => !String(s.id || '').startsWith('curated-'));
  const merged = [...synthetic, ...curatedEntries];
  writeFileSync(mainManifestPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`Patched main manifest: ${synthetic.length} synthetic + ${curatedEntries.length} curated`);
}

async function ocrAll(files) {
  const worker = await createWorker('eng');
  const byId = new Map();
  try {
    for (const file of files) {
      const id = file.replace(/\.png$/i, '');
      const { data } = await worker.recognize(join(curatedDir, file));
      const text = data.text || '';
      const label = coerceTypeLabel(guessLabel(id, text));
      const wordCount = countWords(text, label);
      byId.set(id, { label, wordCount, preview: text.replace(/\s+/g, ' ').trim().slice(0, 120) });
      console.log(`${file}  ~${wordCount}w  [${label}]`);
    }
  } finally {
    await worker.terminate();
  }
  return byId;
}

function fromPrevious(files) {
  const prev = readJson(curatedManifestPath);
  const map = new Map((prev || []).map((e) => [e.id, e]));
  const byId = new Map();
  for (const file of files) {
    const id = file.replace(/\.png$/i, '');
    const old = map.get(id);
    const label = coerceTypeLabel(LABEL_OVERRIDES[id] || old?.label || 'LinkedIn · post');
    const wordCount = old?.wordCount ?? 80;
    byId.set(id, { label, wordCount, preview: '(skip-ocr)' });
    console.log(`${file}  ~${wordCount}w  [${label}] (cached)`);
  }
  return byId;
}

async function main() {
  mkdirSync(curatedDir, { recursive: true });
  const files = listCuratedPngs();
  if (!files.length) {
    console.error(`No curated-*.png found in ${curatedDir}`);
    process.exitCode = 1;
    return;
  }

  const meta = SKIP_OCR ? fromPrevious(files) : await ocrAll(files);
  const entries = files.map((file) => {
    const id = file.replace(/\.png$/i, '');
    const m = meta.get(id);
    const wordCount = m.wordCount;
    return {
      id,
      imageUrl: `/seed/curated/${file}`,
      wordCount,
      label: m.label,
      bucket: bucketFor(wordCount),
    };
  });

  writeFileSync(curatedManifestPath, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`Wrote ${entries.length} curated entries -> ${curatedManifestPath}`);
  patchMainManifest(entries);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
