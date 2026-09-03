/**
 * Client-side image helpers for the pre-round upload flow.
 *
 * Since persistence is still in-memory only, uploaded screenshots travel to the
 * server as a data URL over the same WebSocket channel. To keep those payloads
 * reasonable we downscale very large images and re-encode them (JPEG/WebP) before
 * sending. All work happens on a throwaway canvas — nothing here mutates the DOM.
 */

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // reject original files bigger than this
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export interface PreparedImage {
  /** Downscaled, re-encoded data URL ready to transmit. */
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate encoded size in bytes (for UX / logging). */
  bytes: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** Rough byte size of a base64 data URL (4 base64 chars ≈ 3 bytes). */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Read a File, downscale so the longest edge is <= maxEdge, and re-encode.
 * PNGs with transparency are kept as PNG; everything else becomes JPEG for size.
 */
export async function prepareUpload(
  file: File,
  { maxEdge = 1600, quality = 0.85 }: { maxEdge?: number; quality?: number } = {},
): Promise<PreparedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Please choose a PNG, JPEG, WebP, or GIF image.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That image is over 12 MB — pick a smaller screenshot.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const scale = Math.min(1, maxEdge / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable in this browser.');
    ctx.drawImage(img, 0, 0, w, h);

    // Keep PNG (lossless) only for genuinely small images; otherwise JPEG for payload size.
    const preferPng = file.type === 'image/png' && w * h <= 900 * 900;
    const mime = preferPng ? 'image/png' : 'image/jpeg';
    let dataUrl = canvas.toDataURL(mime, quality);

    // Safety net: if JPEG is still huge, step the longest edge down and retry once.
    if (dataUrlBytes(dataUrl) > 5 * 1024 * 1024 && Math.max(w, h) > 1200) {
      const s2 = 1200 / Math.max(w, h);
      const w2 = Math.round(w * s2);
      const h2 = Math.round(h * s2);
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(img, 0, 0, w2, h2);
      dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return { dataUrl, width: w2, height: h2, bytes: dataUrlBytes(dataUrl) };
    }

    return { dataUrl, width: w, height: h, bytes: dataUrlBytes(dataUrl) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
