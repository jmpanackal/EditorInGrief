/**
 * Client-side OCR (Tesseract.js), lazy-loaded.
 *
 * Two jobs in this game:
 *  1. Estimate a source's word_count so the round timer can scale (lobby, on upload).
 *  2. Produce word/letter bounding boxes so the editor can offer tap/drag-to-redact.
 *
 * The Tesseract worker + wasm + language data are several MB, so we import the
 * package dynamically (keeping it out of the initial bundle) and reuse a single
 * worker across calls. Recognition is slow (seconds) and CPU-heavy — callers
 * should show a loading indicator and treat results as best-effort (OCR on
 * arbitrary screenshots is imperfect; manual tools remain the reliable path).
 *
 * COORDINATE SPACE: boxes come back in the pixel space of the exact bitmap we
 * hand Tesseract. Callers pass a canvas/image at the source's NATURAL size, so
 * the returned boxes are already in editor image-space (see `ocrBitmapSize`).
 */
import type { Worker as TesseractWorker } from 'tesseract.js';

export interface OcrBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

export interface OcrWord extends OcrBox {
  /** Letter-level boxes when available (best-effort; may be empty). */
  symbols: OcrBox[];
}

export interface OcrResult {
  words: OcrWord[];
  text: string;
  wordCount: number;
  /** Size of the bitmap OCR actually ran on (image-space reference). */
  width: number;
  height: number;
}

export type OcrProgress = (fraction: number) => void;

let workerPromise: Promise<TesseractWorker> | null = null;

/**
 * Lazily create (once) and reuse a single Tesseract worker.
 *
 * PSM (page-segmentation mode) drives how Tesseract carves the image into
 * lines/words. AUTO ('3') runs full layout analysis, which gives the best word
 * segmentation for the block-of-text screenshots this game targets (social
 * posts, chat, articles). preserve_interword_spaces helps keep adjacent tokens
 * from being fused. Recognition quality is ultimately bounded by input
 * resolution + contrast (see preprocess()) — this is inherently imperfect on
 * arbitrary screenshots.
 */
async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    const creation = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      // 'eng', default LSTM engine. Worker/wasm/lang are fetched from the CDN and
      // cached by the browser after the first run.
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO, // layout analysis + word segmentation
        preserve_interword_spaces: '1',
      });
      return worker;
    })();
    workerPromise = creation;
    try {
      return await creation;
    } catch (error) {
      // A rejected promise used to stay cached forever, so one failed worker
      // startup could make Tap Text appear permanently jammed in that browser.
      if (workerPromise === creation) workerPromise = null;
      throw error;
    }
  }
  return workerPromise;
}

function boxFrom(
  b: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number },
  scale: number,
): OcrBox {
  // Boxes come back in the PREPROCESSED (upscaled) bitmap's space; divide by the
  // upscale factor to land back in the source image's natural pixel space.
  return {
    text: b.text,
    x0: b.bbox.x0 / scale,
    y0: b.bbox.y0 / scale,
    x1: b.bbox.x1 / scale,
    y1: b.bbox.y1 / scale,
    confidence: b.confidence,
  };
}

/** Normalize any accepted input to a natural-size canvas we can scale/read. */
function toCanvas(image: HTMLCanvasElement | HTMLImageElement | ImageData, w: number, h: number): HTMLCanvasElement {
  if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) return image;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  if (typeof ImageData !== 'undefined' && image instanceof ImageData) ctx.putImageData(image, 0, 0);
  else ctx.drawImage(image as HTMLImageElement, 0, 0, w, h);
  return c;
}

/** Pick an upscale factor so small text is rendered at a size Tesseract handles. */
function computeUpscale(w: number, h: number): number {
  const longest = Math.max(w, h);
  if (longest <= 0) return 1;
  if (longest < 1000) return 2;
  if (longest < 1600) return 1.5;
  return 1;
}

/**
 * Preprocess for OCR: upscale (for small text), convert to grayscale, and boost
 * contrast. Higher resolution + crisper edges markedly reduce fused/half-cut
 * glyphs versus feeding a small, low-contrast screenshot straight in.
 */
function preprocess(src: HTMLCanvasElement, w: number, h: number, scale: number): HTMLCanvasElement {
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cw, ch);
  try {
    const id = ctx.getImageData(0, 0, cw, ch);
    const d = id.data;
    const contrast = 1.55; // >1 stretches midtones toward black/white
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = gray * contrast + intercept;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
  } catch {
    /* tainted canvas — fall back to the un-thresholded upscale */
  }
  return canvas;
}

/**
 * Run OCR on a canvas/image sized to the source's natural pixels. Internally the
 * image is preprocessed (upscaled + grayscale + contrast); all returned word and
 * symbol boxes are mapped back to the source's natural pixel space (= editor
 * image space), so callers need no further scaling.
 */
export async function runOcr(
  image: HTMLCanvasElement | HTMLImageElement | ImageData,
  onProgress?: OcrProgress,
): Promise<OcrResult> {
  const worker = await getWorker();

  const width =
    'naturalWidth' in image ? image.naturalWidth || image.width : (image as HTMLCanvasElement | ImageData).width;
  const height =
    'naturalHeight' in image ? image.naturalHeight || image.height : (image as HTMLCanvasElement | ImageData).height;

  onProgress?.(0.05);
  const base = toCanvas(image, width, height);
  const scale = computeUpscale(width, height);
  const work = preprocess(base, width, height, scale);

  // Request the block hierarchy so per-word / per-symbol boxes are populated.
  const { data } = await worker.recognize(work, {}, { blocks: true, text: true });
  onProgress?.(0.95);

  const words: OcrWord[] = [];
  const blocks = data.blocks ?? [];
  for (const block of blocks) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const w of line.words ?? []) {
          const text = (w.text ?? '').trim();
          if (!text) continue;
          const symbols: OcrBox[] = (w.symbols ?? [])
            .filter((s) => (s.text ?? '').trim().length > 0)
            .map((s) => boxFrom(s, scale));
          words.push({ ...boxFrom(w, scale), symbols });
        }
      }
    }
  }

  const text = (data.text ?? '').trim();
  const wordCount = words.length || (text ? text.split(/\s+/).filter(Boolean).length : 0);
  onProgress?.(1);
  return { words, text, wordCount, width, height };
}

/** Terminate the shared worker (optional cleanup; safe to skip). */
export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      /* ignore */
    }
    workerPromise = null;
  }
}
