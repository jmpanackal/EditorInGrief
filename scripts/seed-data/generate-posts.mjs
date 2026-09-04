/** Post batch generation (imported by generate-seed.mjs). */
import {
  buildNamePool,
  buildCompanyPool,
  buildHandle,
  linkedinHeadline,
  twitterHandleLine,
  pick,
  shuffle,
  mulberry32,
} from './pools.mjs';
import {
  TOPICS,
  VOICES,
  firstNWords,
  wordCount,
  sharesNgram,
  extractNgrams,
} from './content.mjs';
import { composeBody } from './compose-realistic.mjs';
import { composeYoutubeComment } from './youtube.mjs';
import { pickTitleForTopic, structuresForPlatform } from './roles.mjs';

export function createGeneratePosts({
  FULL,
  BUCKETS,
  PLATFORM_MIX,
  BANNED_NAME_RE,
  MAX_FIRST_NAME,
  displayNameForPlatform,
}) {
  function platformQuota(total) {
    const counts = {};
    let assigned = 0;
    for (let i = 0; i < PLATFORM_MIX.length; i++) {
      const [p, frac] = PLATFORM_MIX[i];
      if (i === PLATFORM_MIX.length - 1) counts[p] = total - assigned;
      else {
        counts[p] = Math.round(total * frac);
        assigned += counts[p];
      }
    }
    return counts;
  }

  function handleForPlatform(platform, name, handleRaw, company, rng, title) {
    if (platform === 'linkedin') return linkedinHeadline(rng, company, title);
    if (platform === 'twitter') return twitterHandleLine(handleRaw);
    if (platform === 'facebook') {
      const when = pick(rng, ['Just now', '2 hrs', '3 hrs', 'Yesterday', '1 d']);
      return `${when} · 🌎 Public`;
    }
    if (platform === 'youtube') {
      return pick(rng, ['2 hours ago', '1 day ago', '3 days ago', '1 week ago', '2 weeks ago']);
    }
    if (platform === 'news') {
      return pick(rng, ['LOCAL', 'BUSINESS', 'COMMUNITY', 'HEALTH', 'EDUCATION', 'TECHNOLOGY']);
    }
    return handleRaw;
  }

  function nextStructure(bucket, platform, topic, structureCursor, structureCounts, globalCounts) {
    const pool = structuresForPlatform(platform, topic, bucket);
    const key = `${bucket}|${platform}`;
    if (!structureCursor[key]) structureCursor[key] = 0;
    if (!structureCounts[key]) structureCounts[key] = {};
    // Prefer globally underused structures so story_lesson doesn't dominate the bank
    let best = pool[0];
    let bestScore = Infinity;
    for (const s of pool) {
      const g = globalCounts[s] || 0;
      const local = structureCounts[key][s] || 0;
      const score = g * 3 + local;
      if (score < bestScore) {
        best = s;
        bestScore = score;
      }
    }
    structureCursor[key] += 1;
    structureCounts[key][best] = (structureCounts[key][best] || 0) + 1;
    globalCounts[best] = (globalCounts[best] || 0) + 1;
    return best;
  }

  return function generatePosts() {
    const rng = mulberry32(FULL ? 20260304 : 20260904);
    const names = shuffle(rng, buildNamePool(11));
    const companies = shuffle(rng, buildCompanyPool(22));
    const usedHandles = new Set();
    const usedFullNames = new Set();
    const firstNameCounts = new Map();
    const usedFirst8 = new Map();
    const usedCombo = new Map();
    const usedBodies = new Set();
    const usedNgrams = new Set();
    const usedBeats = { sentences: new Set(), hooks: new Set(), fillers: new Set() };
    const structureCursor = {};
    const structureCounts = {};
    const globalStructureCounts = {};
    const posts = [];
    let nameIdx = 0;
    let companyIdx = 0;

    function takeName(platform) {
      for (let k = 0; k < names.length * 2; k++) {
        const full = names[nameIdx % names.length];
        nameIdx += 1;
        const fn = full.split(' ')[0].toLowerCase();
        if ((firstNameCounts.get(fn) || 0) >= MAX_FIRST_NAME) continue;
        let display = full;
        if (platform === 'news') display = displayNameForPlatform('news', full, rng);
        else if (platform === 'youtube') display = displayNameForPlatform('youtube', full, rng);
        if (platform !== 'news' && usedFullNames.has(display)) continue;
        if (BANNED_NAME_RE.test(display) || BANNED_NAME_RE.test(full)) continue;
        return { full, display, firstName: fn };
      }
      const full = names[nameIdx++ % names.length];
      return {
        full,
        display: platform === 'news' || platform === 'youtube' ? displayNameForPlatform(platform, full, rng) : full,
        firstName: full.split(' ')[0].toLowerCase(),
      };
    }

    for (const [bucket, spec] of Object.entries(BUCKETS)) {
      const quota = platformQuota(spec.count);
      for (let i = 0; i < spec.count; i++) {
        let built = null;
        const entries = Object.entries(quota).filter(([, n]) => n > 0);
        entries.sort((a, b) => b[1] - a[1]);
        const platform = entries[0]?.[0] || 'linkedin';
        quota[platform] -= 1;

        for (let attempt = 0; attempt < 28; attempt++) {
          const topic = pick(rng, TOPICS);
          const voice = platform === 'youtube' ? 'casual_online' : pick(rng, VOICES);
          let structure = nextStructure(bucket, platform, topic, structureCursor, structureCounts, globalStructureCounts);
          if (attempt > 0 && attempt % 3 === 0) {
            structure = pick(rng, structuresForPlatform(platform, topic, bucket));
          }
          const combo = `${platform}|${topic}|${voice}|${structure}`;
          const comboCount = usedCombo.get(combo) || 0;
          if (!FULL && comboCount >= 1 && attempt < 18) continue;
          if (FULL && comboCount >= 3 && attempt < 18) continue;

          const { full, display, firstName } = takeName(platform);
          const company = companies[companyIdx++ % companies.length];
          const handleRaw = buildHandle(names[(nameIdx + 7) % names.length], usedHandles, rng);
          const title = pickTitleForTopic(rng, topic);
          const tryhard = platform !== 'youtube' && rng() < 0.18;
          const provisional = {
            sentences: new Set(usedBeats.sentences),
            hooks: new Set(usedBeats.hooks),
            fillers: new Set(usedBeats.fillers),
          };
          const body =
            platform === 'youtube'
              ? composeYoutubeComment({ structure, rng, minW: spec.min, maxW: spec.max, topic, used: provisional })
              : composeBody({
                  topic,
                  voice,
                  structure,
                  rng,
                  minW: spec.min,
                  maxW: spec.max,
                  tryhard,
                  company,
                  name: full,
                  used: provisional,
                });
          const wc = wordCount(body);
          if (wc < spec.min - 2 || wc > spec.max + 5) continue;
          if (usedBodies.has(body)) continue;
          if (sharesNgram(body, usedNgrams, 4) && attempt < 22) continue;
          const f8 = firstNWords(body, 8);
          const f8c = usedFirst8.get(f8) || 0;
          if (!FULL && f8c >= 1) continue;
          if (FULL && f8c >= 3) continue;

          const handle = handleForPlatform(platform, display, handleRaw, company, rng, title);
          if (BANNED_NAME_RE.test(handle) || BANNED_NAME_RE.test(company)) continue;

          built = {
            platform,
            name: display,
            handle,
            body,
            topic,
            voice,
            structure,
            bucket,
            company,
            title,
            wordCount: wc,
            tryhard,
            firstName,
          };
          usedBeats.sentences = provisional.sentences;
          usedBeats.hooks = provisional.hooks;
          usedBeats.fillers = provisional.fillers;
          usedFullNames.add(display);
          firstNameCounts.set(firstName, (firstNameCounts.get(firstName) || 0) + 1);
          usedBodies.add(body);
          for (const g of extractNgrams(body, 4)) usedNgrams.add(g);
          usedFirst8.set(f8, f8c + 1);
          usedCombo.set(combo, comboCount + 1);
          break;
        }

        if (!built) {
          const topic = TOPICS[(i + posts.length) % TOPICS.length];
          const structure = nextStructure(bucket, platform, topic, structureCursor, structureCounts, globalStructureCounts);
          const voice = platform === 'youtube' ? 'casual_online' : VOICES[(i + posts.length) % VOICES.length];
          const { full, display, firstName } = takeName(platform);
          const company = companies[companyIdx++ % companies.length];
          const title = pickTitleForTopic(rng, topic);
          let body =
            platform === 'youtube'
              ? composeYoutubeComment({ structure, rng, minW: spec.min, maxW: spec.max, topic, used: usedBeats })
              : composeBody({
                  topic,
                  voice,
                  structure,
                  rng,
                  minW: spec.min,
                  maxW: spec.max,
                  tryhard: false,
                  company,
                  name: full,
                  used: usedBeats,
                });
          if (sharesNgram(body, usedNgrams, 4)) body = `${body}\n\n(still figuring this out in public.)`;
          built = {
            platform,
            name: display,
            handle: handleForPlatform(platform, display, buildHandle(full, usedHandles, rng), company, rng, title),
            body,
            topic,
            voice,
            structure,
            bucket,
            company,
            title,
            wordCount: wordCount(body),
            tryhard: false,
            firstName,
          };
          usedFullNames.add(display);
          firstNameCounts.set(firstName, (firstNameCounts.get(firstName) || 0) + 1);
          usedBodies.add(body);
          for (const g of extractNgrams(body, 4)) usedNgrams.add(g);
          usedFirst8.set(firstNWords(body, 8), (usedFirst8.get(firstNWords(body, 8)) || 0) + 1);
        }
        posts.push(built);
      }
    }
    return posts;
  };
}
