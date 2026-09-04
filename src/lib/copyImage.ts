/**
 * Copy an image (data URL or same-origin URL) to the clipboard when possible.
 * Prefers ClipboardItem image/png; falls back to downloading bytes, then URL text.
 * Optional `label` composites a letterpress-style byline onto the PNG.
 */

import { downloadBlob } from './frontPage';

export type CopyImageResult = 'copied' | 'downloaded' | 'url-copied';

const PAPER = '#faf8f1';
const INK = '#1a1a1a';
const DISPLAY = '"Playfair Display", Georgia, "Times New Roman", serif';

async function loadImageBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not load image.');
  return res.blob();
}

async function ensureFonts(): Promise<void> {
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  try {
    await fonts.load(`900 24px ${DISPLAY}`);
    await fonts.ready;
  } catch {
    /* fall back to system serifs */
  }
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Encode as PNG. When `label` is set, append a paper caption bar with the name
 * (Playfair Display, ink on papercard) so clipboard/download match the byline.
 */
function blobToPng(blob: Blob, label?: string): Promise<Blob> {
  const caption = label?.trim();
  if (!caption && blob.type === 'image/png') return Promise.resolve(blob);

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      void (async () => {
        try {
          if (caption) await ensureFonts();

          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const barH = caption ? Math.max(40, Math.round(w * 0.07)) : 0;
          const rule = caption ? Math.max(2, Math.round(w * 0.003)) : 0;
          const fontSize = caption ? Math.max(18, Math.round(w * 0.038)) : 0;
          const pad = caption ? Math.max(12, Math.round(w * 0.025)) : 0;

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h + barH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas is unavailable.'));
            return;
          }

          ctx.drawImage(img, 0, 0);

          if (caption) {
            ctx.fillStyle = PAPER;
            ctx.fillRect(0, h, w, barH);
            ctx.fillStyle = INK;
            ctx.fillRect(0, h, w, rule);

            ctx.font = `900 ${fontSize}px ${DISPLAY}`;
            ctx.fillStyle = INK;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const text = ellipsize(ctx, caption, w - pad * 2);
            ctx.fillText(text, pad, h + rule + (barH - rule) / 2);
          }

          canvas.toBlob(
            (png) => (png ? resolve(png) : reject(new Error('Could not encode PNG.'))),
            'image/png',
          );
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not compose image.'));
        } finally {
          URL.revokeObjectURL(url);
        }
      })();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image.'));
    };
    img.src = url;
  });
}

function canWriteClipboardImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

/**
 * Copy image bytes to the clipboard as PNG when the browser allows it.
 * Otherwise download the PNG (preferred over URL text). Last resort: copy the src string.
 * Pass `label` to burn the submitter name (or "Original") into the PNG caption bar.
 */
export async function copyImageFromUrl(
  src: string,
  filename = 'image.png',
  label?: string,
): Promise<CopyImageResult> {
  let blob: Blob | null = null;
  try {
    blob = await loadImageBlob(src);
  } catch {
    blob = null;
  }

  if (blob) {
    let png: Blob;
    try {
      png = await blobToPng(blob, label);
    } catch {
      png = blob;
    }

    const pngBlob = png.type === 'image/png' ? png : null;

    if (pngBlob && canWriteClipboardImage()) {
      try {
        // Safari expects Promise<Blob>; Chrome accepts Blob — Promise works in both.
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': Promise.resolve(pngBlob),
          } as Record<string, Promise<Blob>>),
        ]);
        return 'copied';
      } catch {
        // Unsupported / permission denied — fall through to download.
      }
    }

    const out = pngBlob ?? blob;
    const name = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
    downloadBlob(out, name);
    return 'downloaded';
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(src);
    return 'url-copied';
  }

  throw new Error('Could not copy image.');
}
