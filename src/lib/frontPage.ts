/**
 * Client-side "newspaper front page" composer + share/download helpers.
 *
 * Pass one or more {@link RoundRecap}s — the scoreboard downloads a single
 * round (the Verdict just finished). Layout is a tall PNG styled like the
 * front page of THE REDACTIONIST'S GAZETTE, entirely in canvas — no backend.
 * Images are already client-side (seed URLs / data URLs), so the canvas never
 * taints and `toBlob` succeeds.
 *
 * PHASE 4 TODO: permanent shareable *links* via object storage.
 */
import type { RoundRecap } from '@shared/types';

export interface FrontPageMeta {
  code: string;
  date: string; // human dateline, e.g. "WEDNESDAY, SEPTEMBER 2, 2026"
}

// Palette mirrors the newspaper Tailwind theme.
const PAPER = '#faf8f1';
const PAPER2 = '#efe9db';
const INK = '#1a1a1a';
const INK3 = '#6b655c';
const RED = '#c0362c';

const PAGE_W = 1160; // logical px; device px = PAGE_W * SCALE
const MARGIN = 48;
const SCALE = 2; // retina crispness
const CONTENT_W = PAGE_W - MARGIN * 2;

const CELL_GAP = 18;
const IMG_H = 156;
const CAPTION_H = 34;
const CELL_H = IMG_H + CAPTION_H;
const ROW_GAP = 22;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // tolerate a missing image; draw a placeholder
    img.src = src;
  });
}

async function ensureFonts(): Promise<void> {
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  try {
    await Promise.all([
      fonts.load('900 46px "Playfair Display"'),
      fonts.load('700 22px "Playfair Display"'),
      fonts.load('700 15px "Zilla Slab"'),
      fonts.load('600 13px "Zilla Slab"'),
    ]);
    await fonts.ready;
  } catch {
    /* fall back to system serifs */
  }
}

const DISPLAY = '"Playfair Display", Georgia, "Times New Roman", serif';
const SLAB = '"Zilla Slab", Georgia, serif';

/** One drawable tile: an image + a caption + optional highlight. */
interface Tile {
  img: HTMLImageElement | null;
  caption: string;
  sub: string; // small label under caption (role / votes)
  winner: boolean;
}

interface RoundBlock {
  heading: string;
  cols: number;
  cellW: number;
  rows: number;
  tiles: Tile[];
  height: number; // total block height incl. heading + grid
}

const HEADING_H = 42;
const BLOCK_BOTTOM_GAP = 30;

function columnsFor(count: number): number {
  // 1 original + submissions. Keep tiles a comfortable size; cap at 4 across.
  const target = Math.min(4, Math.max(2, count));
  return Math.min(4, target);
}

function layoutRound(recap: RoundRecap, images: Map<string, HTMLImageElement | null>): RoundBlock {
  const nameOf = (pid: string) => recap.players.find((p) => p.id === pid)?.nickname ?? 'Anon';
  const topVotes = recap.submissions.reduce((m, s) => Math.max(m, s.votesCount), 0);

  const tiles: Tile[] = [
    { img: images.get(recap.source.id) ?? null, caption: 'Original', sub: 'the wire photo', winner: false },
    ...recap.submissions.map((s) => ({
      img: images.get(s.id) ?? null,
      caption: nameOf(s.playerId),
      sub: recap.votingEnabled ? `${s.votesCount} vote${s.votesCount === 1 ? '' : 's'}` : 'redaction',
      winner: recap.votingEnabled && s.votesCount > 0 && s.votesCount === topVotes,
    })),
  ];

  const cols = columnsFor(tiles.length);
  const cellW = Math.floor((CONTENT_W - (cols - 1) * CELL_GAP) / cols);
  const rows = Math.ceil(tiles.length / cols);
  const gridH = rows * CELL_H + (rows - 1) * ROW_GAP;
  return {
    heading: `Story No. ${recap.roundNumber}`,
    cols,
    cellW,
    rows,
    tiles,
    height: HEADING_H + gridH + BLOCK_BOTTOM_GAP,
  };
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const r = Math.min(w / img.width, h / img.height);
  const dw = img.width * r;
  const dh = img.height * r;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Compose round(s) into one tall canvas. Pass a single-element array for the
 * usual per-round Verdict download. Extra rounds stack vertically if needed.
 */
export async function composeFrontPage(
  rounds: RoundRecap[],
  meta: FrontPageMeta,
): Promise<HTMLCanvasElement> {
  await ensureFonts();

  // Preload every image up front (source + all submissions), keyed by id.
  const images = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    rounds.flatMap((r) => [
      loadImage(r.source.imageUrl).then((im) => void images.set(r.source.id, im)),
      ...r.submissions.map((s) => loadImage(s.editedImageUrl).then((im) => void images.set(s.id, im))),
    ]),
  );

  const blocks = rounds.map((r) => layoutRound(r, images));

  const MASTHEAD_H = 172;
  const FOOTER_H = 70;
  const totalH =
    MARGIN + MASTHEAD_H + blocks.reduce((sum, b) => sum + b.height, 0) + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PAGE_W * SCALE);
  canvas.height = Math.round(totalH * SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // Paper
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, totalH);

  const totalPlayers = new Set(rounds.flatMap((r) => r.submissions.map((s) => s.playerId))).size;
  const totalEdits = rounds.reduce((n, r) => n + r.submissions.length, 0);

  // ---- Masthead --------------------------------------------------------
  let y = MARGIN;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';

  // small top kicker
  ctx.font = `600 12px ${SLAB}`;
  ctx.fillStyle = INK3;
  ctx.fillText('VOL. I  ·  LATE EDITION  ·  ONE THIN DIME', PAGE_W / 2, y + 6);

  // double rule
  const ruleY = y + 16;
  drawRule(ctx, MARGIN, ruleY, CONTENT_W, 2);
  drawRule(ctx, MARGIN, ruleY + 4, CONTENT_W, 1);

  // title
  ctx.fillStyle = INK;
  ctx.font = `900 46px ${DISPLAY}`;
  ctx.fillText('The Redactionist’s Gazette', PAGE_W / 2, ruleY + 52);

  // sub rule + dateline
  drawRule(ctx, MARGIN, ruleY + 66, CONTENT_W, 2);
  drawRule(ctx, MARGIN, ruleY + 70, CONTENT_W, 1);
  ctx.font = `600 13px ${SLAB}`;
  ctx.fillStyle = INK3;
  ctx.fillText(
    `${meta.date}  ·  EDITION No. ${meta.code}  ·  ${rounds.length} STOR${rounds.length === 1 ? 'Y' : 'IES'}  ·  ${totalPlayers} REDACTOR${totalPlayers === 1 ? '' : 'S'}  ·  ${totalEdits} EDITS`,
    PAGE_W / 2,
    ruleY + 90,
  );

  y = MARGIN + MASTHEAD_H;

  // ---- Round blocks ----------------------------------------------------
  for (const b of blocks) {
    // heading: kicker + hairline
    ctx.textAlign = 'left';
    ctx.font = `700 20px ${DISPLAY}`;
    ctx.fillStyle = INK;
    ctx.fillText(b.heading, MARGIN, y + 22);
    drawRule(ctx, MARGIN, y + HEADING_H - 8, CONTENT_W, 1);

    let gy = y + HEADING_H;
    b.tiles.forEach((tile, i) => {
      const col = i % b.cols;
      const row = Math.floor(i / b.cols);
      const x = MARGIN + col * (b.cellW + CELL_GAP);
      const cy = gy + row * (CELL_H + ROW_GAP);
      drawTile(ctx, tile, x, cy, b.cellW);
    });

    y += b.height;
  }

  // ---- Footer ----------------------------------------------------------
  drawRule(ctx, MARGIN, y + 6, CONTENT_W, 2);
  ctx.textAlign = 'center';
  ctx.font = `italic 600 13px ${SLAB}`;
  ctx.fillStyle = INK3;
  ctx.fillText('Printed by Editor in Grief — redact, reveal, repeat.', PAGE_W / 2, y + 30);
  ctx.font = `600 11px ${SLAB}`;
  ctx.fillText('Assembled on your device · no story leaves this newsroom', PAGE_W / 2, y + 48);

  return canvas;
}

function drawRule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, thickness: number): void {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, thickness);
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, w: number): void {
  // image well
  ctx.fillStyle = PAPER2;
  ctx.fillRect(x, y, w, IMG_H);
  if (tile.img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, IMG_H);
    ctx.clip();
    drawContain(ctx, tile.img, x + 4, y + 4, w - 8, IMG_H - 8);
    ctx.restore();
  } else {
    ctx.fillStyle = INK3;
    ctx.font = `600 12px ${SLAB}`;
    ctx.textAlign = 'center';
    ctx.fillText('(image unavailable)', x + w / 2, y + IMG_H / 2);
  }

  // caption band
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y + IMG_H, w, CAPTION_H);

  // border (winner = red, thicker)
  ctx.strokeStyle = tile.winner ? RED : INK;
  ctx.lineWidth = tile.winner ? 3 : 2;
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, CELL_H - ctx.lineWidth);

  // byline
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `700 14px ${SLAB}`;
  const pad = 8;
  ctx.fillText(ellipsize(ctx, tile.caption, w - pad * 2 - (tile.winner ? 24 : 0)), x + pad, y + IMG_H + 16);
  ctx.fillStyle = tile.winner ? RED : INK3;
  ctx.font = `600 11px ${SLAB}`;
  ctx.fillText(ellipsize(ctx, tile.sub.toUpperCase(), w - pad * 2), x + pad, y + IMG_H + 28);

  // winner tag
  if (tile.winner) {
    ctx.fillStyle = RED;
    ctx.textAlign = 'right';
    ctx.font = `900 12px ${DISPLAY}`;
    ctx.fillText('★', x + w - pad, y + IMG_H + 22);
  }
}

// ---------------------------------------------------------------------------
// Blob / share / download helpers
// ---------------------------------------------------------------------------
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type ShareResult = 'shared' | 'downloaded';

/**
 * Prefer the Web Share API with a file (mobile), where available; otherwise fall
 * back to a direct PNG download. Returns which path was taken.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  meta: { title: string; text: string },
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: meta.title, text: meta.text });
      return 'shared';
    } catch (err) {
      // User cancelled the share sheet — treat as handled, don't force a download.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      // Otherwise fall through to download.
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
