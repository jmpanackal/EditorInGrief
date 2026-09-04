/**
 * One-shot generator for public/avatars/*.svg — editorial cartoon faces
 * that read at chip size and as a large join preview.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'public', 'avatars');
mkdirSync(dir, { recursive: true });

const ink = '#1a1a1a';
const paper = '#faf8f1';
const kraft = '#e8e2d3';
const grief = '#c81e1e';
const gold = '#a9791f';
const muted = '#4a4640';

function wrap(bg, content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img">
  <rect width="128" height="128" rx="18" fill="${bg}"/>
  <rect x="4" y="4" width="120" height="120" rx="15" fill="none" stroke="${ink}" stroke-width="4"/>
  ${content}
</svg>
`;
}

const avatars = {
  raccoon: wrap(
    kraft,
    `
    <ellipse cx="64" cy="78" rx="36" ry="28" fill="#6b655c" stroke="${ink}" stroke-width="3"/>
    <circle cx="64" cy="54" r="30" fill="#6b655c" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="42" cy="52" rx="14" ry="12" fill="${ink}"/>
    <ellipse cx="86" cy="52" rx="14" ry="12" fill="${ink}"/>
    <circle cx="42" cy="52" r="5" fill="${paper}"/>
    <circle cx="86" cy="52" r="5" fill="${paper}"/>
    <ellipse cx="64" cy="62" rx="10" ry="7" fill="#c4bbb0" stroke="${ink}" stroke-width="2"/>
    <path d="M54 72 Q64 80 74 72" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M38 34 L48 44 M90 34 L80 44" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
  `,
  ),
  owl: wrap(
    '#ddd5c2',
    `
    <ellipse cx="64" cy="72" rx="34" ry="32" fill="#c4a574" stroke="${ink}" stroke-width="3"/>
    <circle cx="48" cy="58" r="16" fill="${paper}" stroke="${ink}" stroke-width="3"/>
    <circle cx="80" cy="58" r="16" fill="${paper}" stroke="${ink}" stroke-width="3"/>
    <circle cx="48" cy="58" r="7" fill="${ink}"/>
    <circle cx="80" cy="58" r="7" fill="${ink}"/>
    <path d="M58 72 L64 82 L70 72 Z" fill="${grief}" stroke="${ink}" stroke-width="2"/>
    <path d="M40 38 L48 46 M88 38 L80 46" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M44 92 Q64 102 84 92" fill="none" stroke="${ink}" stroke-width="2.5"/>
  `,
  ),
  fox: wrap(
    '#f4e4d0',
    `
    <path d="M30 88 Q64 108 98 88 L92 48 L64 28 L36 48 Z" fill="#d9773a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M36 48 L28 22 L52 42 Z" fill="#d9773a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M92 48 L100 22 L76 42 Z" fill="#d9773a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="64" cy="70" rx="14" ry="10" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="50" cy="58" r="5" fill="${ink}"/>
    <circle cx="78" cy="58" r="5" fill="${ink}"/>
    <ellipse cx="64" cy="68" rx="5" ry="4" fill="${ink}"/>
    <path d="M58 78 Q64 84 70 78" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
  `,
  ),
  cat: wrap(
    paper,
    `
    <ellipse cx="64" cy="78" rx="34" ry="26" fill="#c8b89a" stroke="${ink}" stroke-width="3"/>
    <circle cx="64" cy="56" r="28" fill="#c8b89a" stroke="${ink}" stroke-width="3"/>
    <path d="M40 40 L36 18 L54 36 Z" fill="#c8b89a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M88 40 L92 18 L74 36 Z" fill="#c8b89a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="52" cy="54" rx="4" ry="6" fill="${grief}"/>
    <ellipse cx="76" cy="54" rx="4" ry="6" fill="${grief}"/>
    <path d="M60 64 L68 64 L64 70 Z" fill="#e89a6a" stroke="${ink}" stroke-width="1.5"/>
    <path d="M44 66 H54 M74 66 H84" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M56 76 Q64 82 72 76" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
  `,
  ),
  bear: wrap(
    '#e8dcc8',
    `
    <circle cx="38" cy="38" r="14" fill="#8b6914" stroke="${ink}" stroke-width="3"/>
    <circle cx="90" cy="38" r="14" fill="#8b6914" stroke="${ink}" stroke-width="3"/>
    <circle cx="38" cy="38" r="6" fill="#c4a574"/>
    <circle cx="90" cy="38" r="6" fill="#c4a574"/>
    <circle cx="64" cy="64" r="34" fill="#8b6914" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="64" cy="74" rx="16" ry="12" fill="#c4a574" stroke="${ink}" stroke-width="2"/>
    <circle cx="50" cy="58" r="5" fill="${ink}"/>
    <circle cx="78" cy="58" r="5" fill="${ink}"/>
    <ellipse cx="64" cy="70" rx="6" ry="5" fill="${ink}"/>
    <path d="M56 82 Q64 88 72 82" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
  `,
  ),
  crow: wrap(
    '#d4cdc0',
    `
    <ellipse cx="64" cy="70" rx="32" ry="28" fill="${ink}"/>
    <circle cx="64" cy="52" r="26" fill="${ink}"/>
    <circle cx="52" cy="48" r="6" fill="${paper}"/>
    <circle cx="76" cy="48" r="6" fill="${paper}"/>
    <circle cx="52" cy="48" r="3" fill="${ink}"/>
    <circle cx="76" cy="48" r="3" fill="${ink}"/>
    <path d="M64 58 L92 64 L64 70 Z" fill="${gold}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 36 Q52 28 58 40" fill="none" stroke="${muted}" stroke-width="3" stroke-linecap="round"/>
    <path d="M88 36 Q76 28 70 40" fill="none" stroke="${muted}" stroke-width="3" stroke-linecap="round"/>
  `,
  ),
  penguin: wrap(
    '#eef2f4',
    `
    <ellipse cx="64" cy="70" rx="30" ry="36" fill="${ink}"/>
    <ellipse cx="64" cy="74" rx="18" ry="24" fill="${paper}"/>
    <circle cx="64" cy="46" r="22" fill="${ink}"/>
    <circle cx="54" cy="44" r="5" fill="${paper}"/>
    <circle cx="74" cy="44" r="5" fill="${paper}"/>
    <circle cx="54" cy="44" r="2.5" fill="${ink}"/>
    <circle cx="74" cy="44" r="2.5" fill="${ink}"/>
    <path d="M56 54 L64 62 L72 54 Z" fill="${gold}" stroke="${ink}" stroke-width="2"/>
    <ellipse cx="34" cy="72" rx="8" ry="14" fill="${ink}" transform="rotate(-20 34 72)"/>
    <ellipse cx="94" cy="72" rx="8" ry="14" fill="${ink}" transform="rotate(20 94 72)"/>
  `,
  ),
  rabbit: wrap(
    '#f0e8dc',
    `
    <ellipse cx="48" cy="28" rx="10" ry="26" fill="#d4c4b0" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="80" cy="28" rx="10" ry="26" fill="#d4c4b0" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="48" cy="30" rx="5" ry="16" fill="#e8a0a0"/>
    <ellipse cx="80" cy="30" rx="5" ry="16" fill="#e8a0a0"/>
    <circle cx="64" cy="68" r="32" fill="#d4c4b0" stroke="${ink}" stroke-width="3"/>
    <circle cx="52" cy="64" r="5" fill="${ink}"/>
    <circle cx="76" cy="64" r="5" fill="${ink}"/>
    <ellipse cx="64" cy="76" rx="6" ry="5" fill="#e89a9a" stroke="${ink}" stroke-width="1.5"/>
    <path d="M56 86 Q64 92 72 86" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="42" cy="74" r="5" fill="#e8a0a0" opacity="0.7"/>
    <circle cx="86" cy="74" r="5" fill="#e8a0a0" opacity="0.7"/>
  `,
  ),
  pug: wrap(
    '#ebe4d6',
    `
    <circle cx="64" cy="66" r="36" fill="#c4a882" stroke="${ink}" stroke-width="3"/>
    <circle cx="40" cy="42" r="12" fill="#8b6914" stroke="${ink}" stroke-width="3"/>
    <circle cx="88" cy="42" r="12" fill="#8b6914" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="64" cy="74" rx="18" ry="14" fill="#5c4a3a" stroke="${ink}" stroke-width="2"/>
    <circle cx="50" cy="58" r="6" fill="${ink}"/>
    <circle cx="78" cy="58" r="6" fill="${ink}"/>
    <circle cx="52" cy="56" r="2" fill="${paper}"/>
    <circle cx="80" cy="56" r="2" fill="${paper}"/>
    <ellipse cx="64" cy="72" rx="7" ry="5" fill="${ink}"/>
    <path d="M52 84 Q64 94 76 84" fill="none" stroke="${paper}" stroke-width="2.5" stroke-linecap="round"/>
  `,
  ),
  frog: wrap(
    '#dce8d4',
    `
    <ellipse cx="64" cy="78" rx="36" ry="28" fill="#5a9e4a" stroke="${ink}" stroke-width="3"/>
    <circle cx="44" cy="48" r="16" fill="#5a9e4a" stroke="${ink}" stroke-width="3"/>
    <circle cx="84" cy="48" r="16" fill="#5a9e4a" stroke="${ink}" stroke-width="3"/>
    <circle cx="44" cy="48" r="8" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="84" cy="48" r="8" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="44" cy="48" r="4" fill="${ink}"/>
    <circle cx="84" cy="48" r="4" fill="${ink}"/>
    <ellipse cx="64" cy="72" rx="10" ry="6" fill="#3d7a32" stroke="${ink}" stroke-width="2"/>
    <path d="M50 88 Q64 96 78 88" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
  `,
  ),
  sheep: wrap(
    '#f2efe6',
    `
    <circle cx="40" cy="48" r="14" fill="${paper}" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="88" cy="48" r="14" fill="${paper}" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="50" cy="36" r="12" fill="${paper}" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="78" cy="36" r="12" fill="${paper}" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="64" cy="70" r="30" fill="${paper}" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="64" cy="74" rx="18" ry="16" fill="#e8dcc8" stroke="${ink}" stroke-width="2"/>
    <circle cx="54" cy="70" r="4" fill="${ink}"/>
    <circle cx="74" cy="70" r="4" fill="${ink}"/>
    <ellipse cx="64" cy="80" rx="5" ry="4" fill="#c4a882" stroke="${ink}" stroke-width="1.5"/>
    <path d="M56 88 Q64 92 72 88" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
  `,
  ),
  duck: wrap(
    '#fff6d6',
    `
    <ellipse cx="64" cy="78" rx="34" ry="26" fill="#f0d060" stroke="${ink}" stroke-width="3"/>
    <circle cx="64" cy="54" r="28" fill="#f0d060" stroke="${ink}" stroke-width="3"/>
    <circle cx="52" cy="50" r="5" fill="${ink}"/>
    <circle cx="72" cy="50" r="5" fill="${ink}"/>
    <ellipse cx="78" cy="62" rx="16" ry="8" fill="${grief}" stroke="${ink}" stroke-width="2.5"/>
    <path d="M62 62 L78 58 L78 66 Z" fill="${grief}"/>
    <path d="M48 72 Q64 80 70 72" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="36" cy="40" rx="8" ry="6" fill="#e8c840" stroke="${ink}" stroke-width="2" transform="rotate(-30 36 40)"/>
  `,
  ),
  moose: wrap(
    '#e6dcc8',
    `
    <path d="M22 36 L34 48 L28 58 L18 50 Z" fill="#8b6914" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M106 36 L94 48 L100 58 L110 50 Z" fill="#8b6914" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M28 28 L34 40 M22 44 L34 48" stroke="#8b6914" stroke-width="4" stroke-linecap="round"/>
    <path d="M100 28 L94 40 M106 44 L94 48" stroke="#8b6914" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="64" cy="72" rx="32" ry="30" fill="#a67c52" stroke="${ink}" stroke-width="3"/>
    <circle cx="50" cy="66" r="5" fill="${ink}"/>
    <circle cx="78" cy="66" r="5" fill="${ink}"/>
    <ellipse cx="64" cy="78" rx="8" ry="6" fill="#6b4a32" stroke="${ink}" stroke-width="2"/>
    <path d="M54 90 Q64 96 74 90" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
  `,
  ),
  hedgehog: wrap(
    '#ebe0d0',
    `
    <path d="M30 70 L38 40 L50 52 L58 28 L64 48 L74 26 L80 50 L94 36 L98 70 Z" fill="#6b655c" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="64" cy="78" rx="34" ry="24" fill="#c4a882" stroke="${ink}" stroke-width="3"/>
    <circle cx="50" cy="74" r="4.5" fill="${ink}"/>
    <circle cx="72" cy="74" r="4.5" fill="${ink}"/>
    <ellipse cx="62" cy="84" rx="5" ry="4" fill="#8b6914" stroke="${ink}" stroke-width="1.5"/>
    <path d="M52 92 Q64 98 76 92" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
  `,
  ),
  octopus: wrap(
    '#e4ddd4',
    `
    <circle cx="64" cy="52" r="28" fill="#5c6b6b" stroke="${ink}" stroke-width="3"/>
    <circle cx="52" cy="48" r="6" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="76" cy="48" r="6" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="52" cy="48" r="3" fill="${ink}"/>
    <circle cx="76" cy="48" r="3" fill="${ink}"/>
    <path d="M56 62 Q64 68 72 62" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M40 74 Q36 100 44 108" fill="none" stroke="#5c6b6b" stroke-width="8" stroke-linecap="round"/>
    <path d="M52 78 Q50 104 56 110" fill="none" stroke="#5c6b6b" stroke-width="8" stroke-linecap="round"/>
    <path d="M76 78 Q78 104 72 110" fill="none" stroke="#5c6b6b" stroke-width="8" stroke-linecap="round"/>
    <path d="M88 74 Q92 100 84 108" fill="none" stroke="#5c6b6b" stroke-width="8" stroke-linecap="round"/>
    <circle cx="44" cy="108" r="5" fill="#7a8a8a" stroke="${ink}" stroke-width="2"/>
    <circle cx="56" cy="110" r="5" fill="#7a8a8a" stroke="${ink}" stroke-width="2"/>
    <circle cx="72" cy="110" r="5" fill="#7a8a8a" stroke="${ink}" stroke-width="2"/>
    <circle cx="84" cy="108" r="5" fill="#7a8a8a" stroke="${ink}" stroke-width="2"/>
  `,
  ),
  presscat: wrap(
    kraft,
    `
    <circle cx="64" cy="58" r="30" fill="${ink}"/>
    <path d="M40 40 L34 20 L52 36 Z" fill="${ink}"/>
    <path d="M88 40 L94 20 L76 36 Z" fill="${ink}"/>
    <ellipse cx="52" cy="54" rx="5" ry="7" fill="${grief}"/>
    <ellipse cx="76" cy="54" rx="5" ry="7" fill="${grief}"/>
    <path d="M60 64 L68 64 L64 70 Z" fill="#e89a6a"/>
    <path d="M52 78 Q64 86 76 78" fill="none" stroke="${paper}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="44" y="88" width="40" height="14" rx="2" fill="${grief}" stroke="${ink}" stroke-width="2"/>
    <text x="64" y="99" text-anchor="middle" font-family="Georgia, serif" font-size="9" font-weight="700" fill="${paper}">EXTRA</text>
  `,
  ),
  typewriter: wrap(
    '#e4ddd0',
    `
    <rect x="28" y="48" width="72" height="44" rx="4" fill="#4a4640" stroke="${ink}" stroke-width="3"/>
    <rect x="36" y="36" width="56" height="20" rx="3" fill="#6b655c" stroke="${ink}" stroke-width="2.5"/>
    <rect x="44" y="28" width="40" height="12" rx="2" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="48" cy="64" r="4" fill="${paper}"/>
    <circle cx="64" cy="64" r="4" fill="${paper}"/>
    <circle cx="80" cy="64" r="4" fill="${paper}"/>
    <circle cx="48" cy="78" r="4" fill="${grief}"/>
    <circle cx="64" cy="78" r="4" fill="${paper}"/>
    <circle cx="80" cy="78" r="4" fill="${gold}"/>
    <rect x="40" y="30" width="28" height="3" fill="${ink}" opacity="0.3"/>
  `,
  ),
  reporter: wrap(
    '#f0ebe0',
    `
    <circle cx="64" cy="48" r="24" fill="#e8c4a0" stroke="${ink}" stroke-width="3"/>
    <circle cx="54" cy="46" r="3.5" fill="${ink}"/>
    <circle cx="74" cy="46" r="3.5" fill="${ink}"/>
    <path d="M56 56 Q64 62 72 56" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M40 38 Q64 22 88 38" fill="#1a1a1a"/>
    <rect x="38" y="36" width="52" height="8" rx="1" fill="${ink}"/>
    <path d="M36 72 L44 68 L84 68 L92 72 L88 108 L40 108 Z" fill="#2a3a5a" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="56" y="76" width="16" height="20" rx="1" fill="${paper}" stroke="${ink}" stroke-width="2"/>
    <circle cx="64" cy="84" r="3" fill="${gold}"/>
  `,
  ),
  stampdog: wrap(
    '#f5efe4',
    `
    <circle cx="64" cy="60" r="32" fill="#c4956a" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="34" cy="58" rx="10" ry="14" fill="#c4956a" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="94" cy="58" rx="10" ry="14" fill="#c4956a" stroke="${ink}" stroke-width="3"/>
    <circle cx="52" cy="56" r="5" fill="${ink}"/>
    <circle cx="76" cy="56" r="5" fill="${ink}"/>
    <ellipse cx="64" cy="68" rx="8" ry="6" fill="#8b5a3a" stroke="${ink}" stroke-width="2"/>
    <path d="M54 80 Q64 88 74 80" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="40" cy="70" r="6" fill="#e8a090" opacity="0.8"/>
    <circle cx="88" cy="70" r="6" fill="#e8a090" opacity="0.8"/>
    <path d="M48 100 Q64 110 80 100" fill="none" stroke="${grief}" stroke-width="3" stroke-linecap="round"/>
  `,
  ),
  inkblot: wrap(
    paper,
    `
    <path d="M64 24 C40 28 28 48 32 68 C24 72 30 92 48 96 C52 108 76 108 80 96 C98 92 104 72 96 68 C100 48 88 28 64 24 Z" fill="${ink}"/>
    <circle cx="50" cy="58" r="8" fill="${paper}"/>
    <circle cx="78" cy="58" r="8" fill="${paper}"/>
    <circle cx="50" cy="58" r="4" fill="${grief}"/>
    <circle cx="78" cy="58" r="4" fill="${grief}"/>
    <path d="M54 78 Q64 86 74 78" fill="none" stroke="${paper}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="28" cy="40" r="6" fill="${ink}"/>
    <circle cx="100" cy="44" r="5" fill="${ink}"/>
    <circle cx="36" cy="96" r="4" fill="${ink}"/>
  `,
  ),
  parrot: wrap(
    '#e8f0e4',
    `
    <ellipse cx="64" cy="72" rx="30" ry="32" fill="#3d8b6e" stroke="${ink}" stroke-width="3"/>
    <circle cx="64" cy="48" r="24" fill="#3d8b6e" stroke="${ink}" stroke-width="3"/>
    <circle cx="54" cy="46" r="5" fill="${ink}"/>
    <circle cx="72" cy="46" r="5" fill="${ink}"/>
    <path d="M64 54 L92 60 L64 66 Z" fill="${grief}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M42 34 Q52 22 58 38" fill="none" stroke="${gold}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="40" cy="80" rx="10" ry="18" fill="#c81e1e" stroke="${ink}" stroke-width="2" transform="rotate(-15 40 80)"/>
  `,
  ),
  skeleton: wrap(
    '#e8e4dc',
    `
    <circle cx="64" cy="48" r="26" fill="${paper}" stroke="${ink}" stroke-width="3"/>
    <ellipse cx="52" cy="48" rx="6" ry="8" fill="${ink}"/>
    <ellipse cx="76" cy="48" rx="6" ry="8" fill="${ink}"/>
    <path d="M56 62 Q64 70 72 62" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="48" y="76" width="32" height="28" rx="4" fill="${paper}" stroke="${ink}" stroke-width="3"/>
    <path d="M56 84 H72 M56 92 H72 M56 100 H72" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
  `,
  ),
};

for (const [id, svg] of Object.entries(avatars)) {
  writeFileSync(join(dir, `${id}.svg`), svg);
}

console.log(`Wrote ${Object.keys(avatars).length} avatars: ${Object.keys(avatars).join(', ')}`);
