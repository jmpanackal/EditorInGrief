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

/** Lazily create (once) and reuse a single Tesseract worker. */
async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // 'eng', default LSTM engine. Worker/wasm/lang are fetched from the CDN and
      // cached by the browser after the first run.
      return createWorker('eng');
    })();
  }
  return workerPromise;
}

function boxFrom(b: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }): OcrBox {
  return { text: b.text, x0: b.bbox.x0, y0: b.bbox.y0, x1: b.bbox.x1, y1: b.bbox.y1, confidence: b.confidence };
}

/**
 * Run OCR on a canvas/image already sized to the source's natural pixels.
 * Returns word (and letter) boxes in that same pixel space.
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
  // Request the block hierarchy so per-word / per-symbol boxes are populated.
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
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
            .map(boxFrom);
          words.push({ ...boxFrom(w), symbols });
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
