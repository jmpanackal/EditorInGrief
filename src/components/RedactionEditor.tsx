import { useCallback, useEffect, useRef, useState } from 'react';
import { runOcr, type OcrBox, type OcrWord } from '../lib/ocr';

/**
 * RedactionEditor — the core mechanic.
 *
 * Real document-redaction: you can only PAINT over the original image's pixels,
 * never add. Each shape is ALWAYS filled with the auto-sampled LOCAL BACKGROUND
 * color of the original image around it (the "blend") so the covered text just
 * disappears into a matching background. The output IS the original image with
 * parts covered. (If pixel sampling is impossible — e.g. a tainted canvas — we
 * fall back to a neutral gray fill; there is no user-facing black/blend toggle.)
 *
 * Design notes:
 * - Coordinates are kept in ORIGINAL IMAGE space (the source's natural pixels).
 *   ALL redaction drawing, shape storage, hit-testing, background sampling and
 *   the flattened PNG export operate in image space. A separate VIEW TRANSFORM
 *   (scale + offset) maps image space onto the on-screen display canvas so the
 *   user can pinch/wheel-zoom and pan without ever changing stored geometry.
 * - Undo removes the LAST SHAPE; the Eraser tool removes a SPECIFIC shape the
 *   user taps (leaving later shapes intact); Reset clears all.
 * - Performance: committed shapes are baked onto an offscreen "base" canvas at
 *   natural resolution. During a drag we only blit that cache (through the view
 *   transform) + draw the single in-progress shape, so it stays fast.
 */

type Point = { x: number; y: number };
/**
 * Each shape carries the CSS color string it should be filled with. Instead of
 * always painting black, we auto-sample the local background of the ORIGINAL
 * image around/under the shape at commit time (see sampleRectFill /
 * sampleBrushFill) so the redaction blends in and the covered text just
 * "disappears". Storing the color on the shape keeps undo/redo and the
 * offscreen bake deterministic — we never re-sample on re-render.
 */
type Shape =
  | { type: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { type: 'brush'; points: Point[]; thickness: number; fill: string };

type Tool = 'rect' | 'brush' | 'eraser' | 'words';
/** Redact whole words (default) or individual letters in the tap/drag tool. */
type WordGranularity = 'word' | 'letter';
type RGB = [number, number, number];

/**
 * Neutral fallback fill, used ONLY when local-background sampling is impossible
 * (e.g. a cross-origin/tainted canvas where getImageData throws). In the normal
 * same-origin path every redaction blends with the sampled background instead.
 */
const FALLBACK_FILL = 'rgb(128, 128, 128)';

/** Median of each RGB channel independently — robust to text/outlier pixels. */
function medianColor(samples: RGB[]): string {
  if (samples.length === 0) return FALLBACK_FILL;
  const mid = samples.length >> 1;
  const pick = (i: 0 | 1 | 2) => {
    const chan = samples.map((s) => s[i]).sort((a, b) => a - b);
    return chan[mid];
  };
  return `rgb(${pick(0)}, ${pick(1)}, ${pick(2)})`;
}

/**
 * Sample a ring of pixels just OUTSIDE a rectangle's border (a small band on
 * all four sides) from the original image and return their median color. The
 * ring approximates the surrounding background rather than the (text) content
 * being covered. All reads are clamped to image bounds.
 */
function sampleRectFill(img: ImageData, rx: number, ry: number, rw: number, rh: number): string {
  const { width: W, height: H, data } = img;
  const nx = Math.round(Math.min(rx, rx + rw));
  const ny = Math.round(Math.min(ry, ry + rh));
  const nw = Math.round(Math.abs(rw));
  const nh = Math.round(Math.abs(rh));
  const band = 8; // px band sampled just outside each edge
  const x0 = Math.max(0, nx - band);
  const y0 = Math.max(0, ny - band);
  const x1 = Math.min(W - 1, nx + nw + band);
  const y1 = Math.min(H - 1, ny + nh + band);
  // subsample so cost stays flat regardless of rectangle size (~<1k reads)
  const step = Math.max(1, Math.floor(Math.max(x1 - x0, y1 - y0) / 48));
  const samples: RGB[] = [];
  const push = (px: number, py: number) => {
    const i = (py * W + px) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let px = x0; px <= x1; px += step) {
    for (let py = y0; py <= y1; py += step) {
      // keep only the outer ring: skip pixels strictly inside the rectangle
      if (px >= nx && px < nx + nw && py >= ny && py < ny + nh) continue;
      push(px, py);
    }
  }
  return samples.length ? medianColor(samples) : FALLBACK_FILL;
}

/**
 * Sample the local background near a freehand stroke: read small neighborhoods
 * around a handful of points along the path (subsampled for speed) from the
 * original image and take the median. Text strokes are thin relative to the
 * neighborhood, so the median lands on the surrounding background.
 */
function sampleBrushFill(img: ImageData, points: Point[], thickness: number): string {
  const { width: W, height: H, data } = img;
  if (points.length === 0) return FALLBACK_FILL;
  const radius = Math.max(6, Math.round(thickness)); // look a bit beyond the stroke
  const nStep = Math.max(1, Math.floor(points.length / 12)); // <=~12 anchor points
  const samples: RGB[] = [];
  const push = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const i = (py * W + px) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let k = 0; k < points.length; k += nStep) {
    const { x, y } = points[k];
    const cx = Math.round(x);
    const cy = Math.round(y);
    // ring of samples at ~radius around the point (8 compass directions)
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      push(cx + Math.round(Math.cos(ang) * radius), cy + Math.round(Math.sin(ang) * radius));
    }
  }
  return samples.length ? medianColor(samples) : FALLBACK_FILL;
}

/** Shortest distance from point p to the segment a→b (image space). */
function distToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = a.x + t * vx - p.x;
  const dy = a.y + t * vy - p.y;
  return Math.hypot(dx, dy);
}

/** Hit-test a shape against an image-space point (used by the eraser). */
function shapeHit(s: Shape, p: Point): boolean {
  if (s.type === 'rect') {
    const nx = Math.min(s.x, s.x + s.w);
    const ny = Math.min(s.y, s.y + s.h);
    const nw = Math.abs(s.w);
    const nh = Math.abs(s.h);
    const pad = 2;
    return p.x >= nx - pad && p.x <= nx + nw + pad && p.y >= ny - pad && p.y <= ny + nh + pad;
  }
  const tol = s.thickness / 2 + ERASE_TOLERANCE;
  const pts = s.points;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= tol;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(p, pts[i - 1], pts[i]) <= tol) return true;
  }
  return false;
}

/** Area of an OCR box (image px²) — used to pick the tightest box under a tap. */
function boxArea(b: OcrBox): number {
  return Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
}

/** Is an image-space point inside a box (with a small padding tolerance)? */
function pointInBox(p: Point, b: OcrBox, pad: number): boolean {
  return p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad;
}

/** Does a box overlap a normalized selection rect? */
function boxIntersectsRect(b: OcrBox, r: { x0: number; y0: number; x1: number; y1: number }): boolean {
  return b.x0 <= r.x1 && b.x1 >= r.x0 && b.y0 <= r.y1 && b.y1 >= r.y0;
}

/** Stroke a polyline (or a single-point dot outline) in image space. */
function strokePath(ctx: CanvasRenderingContext2D, points: Point[], dotRadius: number): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    const p = points[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

/**
 * Draw a DRAWING-TIME-ONLY outline around the in-progress shape so the user can
 * see exactly where the (often near-invisible) blend fill will land. Rendered in
 * image space through the active view transform; `scale` converts desired
 * on-screen pixel widths into image units. Committed shapes never get this.
 */
function drawActiveOutline(ctx: CanvasRenderingContext2D, s: Shape, scale: number): void {
  ctx.save();
  const dash = [6 / scale, 4 / scale];
  if (s.type === 'rect') {
    const x = Math.min(s.x, s.x + s.w);
    const y = Math.min(s.y, s.y + s.h);
    const w = Math.abs(s.w);
    const h = Math.abs(s.h);
    // Dark base stroke for contrast on light backgrounds…
    ctx.setLineDash([]);
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeRect(x, y, w, h);
    // …then white marching dashes on top.
    ctx.setLineDash(dash);
    ctx.lineWidth = 1.4 / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeRect(x, y, w, h);
  } else {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Translucent band showing the covered area (the actual stroke width)…
    ctx.setLineDash([]);
    ctx.lineWidth = s.thickness;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    strokePath(ctx, s.points, s.thickness / 2);
    // …plus a dashed centerline (dark under, white over) so location is obvious.
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    strokePath(ctx, s.points, s.thickness / 2);
    ctx.setLineDash(dash);
    ctx.lineWidth = 1.4 / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    strokePath(ctx, s.points, s.thickness / 2);
  }
  ctx.restore();
}

/** Faint outlines of detected OCR boxes so the user knows what's tappable. */
function drawDetectedBoxes(ctx: CanvasRenderingContext2D, boxes: OcrBox[], scale: number): void {
  ctx.save();
  ctx.lineWidth = 1 / scale;
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.55)';
  ctx.fillStyle = 'rgba(129, 140, 248, 0.08)';
  for (const b of boxes) {
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    ctx.fillRect(b.x0, b.y0, w, h);
    ctx.strokeRect(b.x0, b.y0, w, h);
  }
  ctx.restore();
}

/** Highlight the boxes currently under a tap/drag selection (pre-commit). */
function drawSelectionBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: OcrBox[],
  rect: { x: number; y: number; w: number; h: number } | null,
  scale: number,
): void {
  ctx.save();
  if (rect && (Math.abs(rect.w) > 2 || Math.abs(rect.h) > 2)) {
    ctx.setLineDash([5 / scale, 4 / scale]);
    ctx.lineWidth = 1.2 / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(244, 63, 94, 0.30)';
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
  ctx.lineWidth = 1.4 / scale;
  for (const b of boxes) {
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    ctx.fillRect(b.x0, b.y0, w, h);
    ctx.strokeRect(b.x0, b.y0, w, h);
  }
  ctx.restore();
}

interface Props {
  imageUrl: string;
  disabled?: boolean;
  onSubmit: (pngDataUrl: string) => void;
  submitted?: boolean;
  /** Incrementing this triggers an automatic flatten+submit (used by the timer
   * auto-submit). Change the value (e.g. Date.now()) to fire once. */
  flushToken?: number;
  /** Max redactions allowed this round (Batch 2). null/undefined = unlimited. */
  maxRedactions?: number | null;
  /** localStorage key for autosaving in-progress work (Batch 3). When present,
   * shapes persist here on every change and restore on mount. */
  storageKey?: string;
}

const MIN_THICKNESS = 6;
const MAX_THICKNESS = 90;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ERASE_TOLERANCE = 6; // extra image px around a brush stroke for hit-testing
const DRAFT_PREFIX = 'eig.draft.';
const AUTOSAVE_MS = 3000;
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // prune stale autosaves older than 2h

type GestureMode = 'none' | 'draw' | 'pan' | 'pinch' | 'words';
interface Gesture {
  mode: GestureMode;
  panLast?: Point;
  pinch?: { startDist: number; imgMid: Point; startZoom: number };
}

export function RedactionEditor({ imageUrl, disabled, onSubmit, submitted, flushToken, maxRedactions, storageKey }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null); // on-screen (viewport res)
  const baseRef = useRef<HTMLCanvasElement | null>(null); // offscreen committed scene (natural res)
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Untouched pixels of the ORIGINAL image. We always sample fill colors from
  // here (never from already-redacted output) so overlapping shapes don't
  // compound sampling errors.
  const origDataRef = useRef<ImageData | null>(null);

  const shapesRef = useRef<Shape[]>([]);
  const draftRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);

  // View transform: on-screen pixel = imageCoord * (fit*zoom) + offset.
  const viewRef = useRef({ fit: 1, zoom: 1, ox: 0, oy: 0 });
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<Gesture>({ mode: 'none' });

  const [tool, setTool] = useState<Tool>('rect');
  const toolRef = useRef<Tool>('rect');
  const [thickness, setThickness] = useState(28);
  const thicknessRef = useRef(28);
  const [shapeCount, setShapeCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);

  // ---- OCR tap/drag-to-redact (assist on top of manual tools) -----------
  const ocrWordsRef = useRef<OcrWord[]>([]);
  const [ocrState, setOcrState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'empty'>('idle');
  const ocrStartedRef = useRef(false); // guards a single OCR run per source image
  const [granularity, setGranularity] = useState<WordGranularity>('word');
  const granularityRef = useRef<WordGranularity>('word');
  // Live tap/drag selection preview (image-space boxes highlighted before commit).
  const wordSelStartRef = useRef<Point | null>(null);
  const wordSelBoxesRef = useRef<OcrBox[]>([]);
  const wordSelRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Straight-line / square constrain: Shift on desktop OR this toggle for touch.
  const [constrain, setConstrain] = useState(false);
  const constrainRef = useRef(false);
  const shiftRef = useRef(false);
  const spaceRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { granularityRef.current = granularity; }, [granularity]);
  useEffect(() => { constrainRef.current = constrain; }, [constrain]);

  const max = maxRedactions ?? null;
  const atLimit = max != null && shapeCount >= max;
  const atLimitRef = useRef(atLimit);
  useEffect(() => { atLimitRef.current = atLimit; }, [atLimit]);

  const constrainActive = useCallback(() => shiftRef.current || constrainRef.current, []);

  // ---- autosave (localStorage) ------------------------------------------
  const persist = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), shapes: shapesRef.current }));
    } catch {
      /* quota / disabled storage — best effort */
    }
  }, [storageKey]);

  const clearSaved = useCallback(() => {
    if (!storageKey) return;
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  // Compute the fill color for a shape: ALWAYS the sampled local background of
  // the original image (the "blend"). Neutral fallback only if sampling failed.
  const computeFill = useCallback((s: Shape): string => {
    const orig = origDataRef.current;
    if (!orig) return FALLBACK_FILL;
    if (s.type === 'rect') return sampleRectFill(orig, s.x, s.y, s.w, s.h);
    return sampleBrushFill(orig, s.points, s.thickness);
  }, []);

  // ---- drawing primitives ------------------------------------------------
  const drawShape = useCallback((ctx: CanvasRenderingContext2D, s: Shape) => {
    const color = s.fill || FALLBACK_FILL;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (s.type === 'rect') {
      const x = Math.min(s.x, s.x + s.w);
      const y = Math.min(s.y, s.y + s.h);
      ctx.fillRect(x, y, Math.abs(s.w), Math.abs(s.h));
    } else {
      ctx.lineWidth = s.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.points.length === 1) {
        const p = s.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, s.thickness / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  }, []);

  const rebuildBase = useCallback(() => {
    const base = baseRef.current;
    const img = imgRef.current;
    if (!base) return;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, base.width, base.height);
    if (img) ctx.drawImage(img, 0, 0, base.width, base.height);
    for (const s of shapesRef.current) drawShape(ctx, s);
  }, [drawShape]);

  // ---- view transform helpers -------------------------------------------
  const computeFit = useCallback(() => {
    const img = imgRef.current;
    const c = displayRef.current;
    if (!img || !c) return;
    const fit = Math.min(c.width / (img.naturalWidth || 1), c.height / (img.naturalHeight || 1)) || 1;
    viewRef.current.fit = fit;
  }, []);

  const clampView = useCallback(() => {
    const c = displayRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const v = viewRef.current;
    const scale = v.fit * v.zoom;
    const sw = (img.naturalWidth || 1) * scale;
    const sh = (img.naturalHeight || 1) * scale;
    v.ox = sw <= c.width ? (c.width - sw) / 2 : Math.min(0, Math.max(c.width - sw, v.ox));
    v.oy = sh <= c.height ? (c.height - sh) / 2 : Math.min(0, Math.max(c.height - sh, v.oy));
  }, []);

  const renderDisplay = useCallback(() => {
    const c = displayRef.current;
    const base = baseRef.current;
    if (!c || !base) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const v = viewRef.current;
    const scale = v.fit * v.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, v.ox, v.oy);
    ctx.drawImage(base, 0, 0);
    // Detected-word hints (faint) whenever the Tap-words tool is active.
    if (toolRef.current === 'words' && ocrWordsRef.current.length) {
      drawDetectedBoxes(ctx, ocrWordsRef.current, scale);
    }
    // In-progress manual shape + its drawing-time outline affordance.
    if (draftRef.current) {
      drawShape(ctx, draftRef.current);
      if (drawingRef.current) drawActiveOutline(ctx, draftRef.current, scale);
    }
    // Live tap/drag word selection preview (before it commits to shapes).
    if (wordSelBoxesRef.current.length || wordSelRectRef.current) {
      drawSelectionBoxes(ctx, wordSelBoxesRef.current, wordSelRectRef.current, scale);
    }
  }, [drawShape]);

  const layout = useCallback(() => {
    computeFit();
    clampView();
    renderDisplay();
  }, [computeFit, clampView, renderDisplay]);

  // Resize the on-screen canvas backing store to its container (DPR-aware).
  useEffect(() => {
    const container = containerRef.current;
    const c = displayRef.current;
    if (!container || !c) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(container.clientWidth * dpr));
      const h = Math.max(1, Math.round(container.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      layout();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [layout]);

  // ---- load source image -------------------------------------------------
  useEffect(() => {
    setLoaded(false);
    shapesRef.current = [];
    draftRef.current = null;
    setShapeCount(0);
    // A new source image invalidates any prior OCR result.
    ocrWordsRef.current = [];
    ocrStartedRef.current = false;
    wordSelStartRef.current = null;
    wordSelBoxesRef.current = [];
    wordSelRectRef.current = null;
    setOcrState('idle');

    const img = new Image();
    // same-origin seed SVGs -> canvas is NOT tainted, so toDataURL works.
    img.onload = () => {
      imgRef.current = img;
      const w = img.naturalWidth || 720;
      const h = img.naturalHeight || 480;
      const base = baseRef.current;
      if (base) { base.width = w; base.height = h; }
      // Snapshot the untouched original pixels once for background sampling.
      try {
        const snap = document.createElement('canvas');
        snap.width = w;
        snap.height = h;
        const sctx = snap.getContext('2d', { willReadFrequently: true });
        if (sctx) {
          sctx.drawImage(img, 0, 0, w, h);
          origDataRef.current = sctx.getImageData(0, 0, w, h);
        }
      } catch {
        // e.g. a tainted canvas — fall back to solid black fills.
        origDataRef.current = null;
      }
      // Restore any autosaved in-progress work for THIS round/player.
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { shapes?: Shape[] };
            if (Array.isArray(parsed.shapes) && parsed.shapes.length) {
              shapesRef.current = parsed.shapes;
              setShapeCount(parsed.shapes.length);
            }
          }
        } catch { /* ignore corrupt entry */ }
      }
      rebuildBase();
      layout();
      setLoaded(true);
    };
    img.onerror = () => setLoaded(false);
    img.src = imageUrl;

    return () => { img.onload = null; img.onerror = null; };
  }, [imageUrl, rebuildBase, layout, storageKey]);

  // Prune stale autosave entries from other rounds on mount.
  useEffect(() => {
    try {
      const now = Date.now();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(DRAFT_PREFIX) || key === storageKey) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '{}') as { savedAt?: number };
          if (!parsed.savedAt || now - parsed.savedAt > DRAFT_TTL_MS) localStorage.removeItem(key);
        } catch {
          localStorage.removeItem(key);
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  // Periodic autosave safety net (in addition to per-change saves).
  useEffect(() => {
    if (!storageKey) return;
    const id = setInterval(() => { if (shapesRef.current.length) persist(); }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [storageKey, persist]);

  // ---- pointer / coordinate mapping -------------------------------------
  const clientToBacking = useCallback((clientX: number, clientY: number): Point => {
    const c = displayRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (c.width / rect.width),
      y: (clientY - rect.top) * (c.height / rect.height),
    };
  }, []);

  const backingToImage = useCallback((bx: number, by: number): Point => {
    const v = viewRef.current;
    const scale = v.fit * v.zoom;
    return { x: (bx - v.ox) / scale, y: (by - v.oy) / scale };
  }, []);

  const toImage = useCallback((clientX: number, clientY: number, clamp = true): Point => {
    const b = clientToBacking(clientX, clientY);
    const p = backingToImage(b.x, b.y);
    const img = imgRef.current;
    if (!clamp || !img) return p;
    return {
      x: Math.max(0, Math.min(img.naturalWidth, p.x)),
      y: Math.max(0, Math.min(img.naturalHeight, p.y)),
    };
  }, [clientToBacking, backingToImage]);

  // ---- zoom helpers ------------------------------------------------------
  const applyZoomAt = useCallback((bx: number, by: number, factor: number) => {
    const v = viewRef.current;
    const before = backingToImage(bx, by);
    v.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
    const scale = v.fit * v.zoom;
    v.ox = bx - before.x * scale;
    v.oy = by - before.y * scale;
    clampView();
    renderDisplay();
    setZoomPct(Math.round(v.zoom * 100));
  }, [backingToImage, clampView, renderDisplay]);

  const zoomButton = useCallback((factor: number) => {
    const c = displayRef.current;
    if (!c) return;
    applyZoomAt(c.width / 2, c.height / 2, factor);
  }, [applyZoomAt]);

  const resetView = useCallback(() => {
    const v = viewRef.current;
    v.zoom = 1;
    layout();
    setZoomPct(100);
  }, [layout]);

  // Wheel zoom (attached non-passive so we can preventDefault).
  useEffect(() => {
    const c = displayRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = clientToBacking(e.clientX, e.clientY);
      applyZoomAt(b.x, b.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [clientToBacking, applyZoomAt]);

  // Track Shift (constrain) and Space (pan) on desktop.
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = true;
      if (e.code === 'Space' && !isTypingTarget(document.activeElement)) {
        spaceRef.current = true;
        setSpaceDown(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = false;
      if (e.code === 'Space') { spaceRef.current = false; setSpaceDown(false); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ---- pinch / pan gesture helpers --------------------------------------
  const startPinch = useCallback(() => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bmid = clientToBacking(midClient.x, midClient.y);
    gestureRef.current = {
      mode: 'pinch',
      pinch: { startDist: dist, imgMid: backingToImage(bmid.x, bmid.y), startZoom: viewRef.current.zoom },
    };
  }, [clientToBacking, backingToImage]);

  const doPinch = useCallback(() => {
    const pts = [...pointersRef.current.values()];
    const g = gestureRef.current.pinch;
    if (pts.length < 2 || !g) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bmid = clientToBacking(midClient.x, midClient.y);
    const v = viewRef.current;
    v.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.startZoom * (dist / g.startDist)));
    const scale = v.fit * v.zoom;
    v.ox = bmid.x - g.imgMid.x * scale;
    v.oy = bmid.y - g.imgMid.y * scale;
    clampView();
    renderDisplay();
    setZoomPct(Math.round(v.zoom * 100));
  }, [clientToBacking, clampView, renderDisplay]);

  const doPan = useCallback((clientX: number, clientY: number) => {
    const g = gestureRef.current;
    if (!g.panLast) return;
    const c = displayRef.current!;
    const rect = c.getBoundingClientRect();
    const dx = (clientX - g.panLast.x) * (c.width / rect.width);
    const dy = (clientY - g.panLast.y) * (c.height / rect.height);
    const v = viewRef.current;
    v.ox += dx;
    v.oy += dy;
    g.panLast = { x: clientX, y: clientY };
    clampView();
    renderDisplay();
  }, [clampView, renderDisplay]);

  // ---- draw / erase ------------------------------------------------------
  const eraseAt = useCallback((p: Point) => {
    const shapes = shapesRef.current;
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (shapeHit(shapes[i], p)) {
        shapesRef.current = [...shapes.slice(0, i), ...shapes.slice(i + 1)];
        setShapeCount(shapesRef.current.length);
        rebuildBase();
        renderDisplay();
        persist();
        return;
      }
    }
  }, [rebuildBase, renderDisplay, persist]);

  const beginDraw = useCallback((p: Point) => {
    if (toolRef.current === 'rect') {
      draftRef.current = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, fill: FALLBACK_FILL };
    } else {
      const brush: Shape = { type: 'brush', points: [p], thickness: thicknessRef.current, fill: FALLBACK_FILL };
      brush.fill = computeFill(brush);
      draftRef.current = brush;
    }
    drawingRef.current = true;
    renderDisplay();
  }, [computeFill, renderDisplay]);

  const moveDraw = useCallback((p: Point) => {
    const draft = draftRef.current;
    if (!draft) return;
    if (draft.type === 'rect') {
      let w = p.x - draft.x;
      let h = p.y - draft.y;
      if (constrainActive()) {
        const s = Math.max(Math.abs(w), Math.abs(h));
        w = (w < 0 ? -1 : 1) * s;
        h = (h < 0 ? -1 : 1) * s;
      }
      draft.w = w;
      draft.h = h;
      draft.fill = computeFill(draft);
    } else if (constrainActive()) {
      draft.points = [draft.points[0], p];
    } else {
      const last = draft.points[draft.points.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1.5) draft.points.push(p);
    }
    renderDisplay();
  }, [constrainActive, computeFill, renderDisplay]);

  const commitDraft = useCallback(() => {
    const draft = draftRef.current;
    drawingRef.current = false;
    if (!draft) return;
    const isEmptyRect = draft.type === 'rect' && Math.abs(draft.w) < 2 && Math.abs(draft.h) < 2;
    draftRef.current = null;
    if (isEmptyRect) { renderDisplay(); return; }
    // Authoritative fill from the ORIGINAL image for the final geometry.
    draft.fill = computeFill(draft);
    shapesRef.current = [...shapesRef.current, draft];
    setShapeCount(shapesRef.current.length);
    const base = baseRef.current;
    const ctx = base?.getContext('2d');
    if (ctx) drawShape(ctx, draft);
    renderDisplay();
    persist();
  }, [computeFill, drawShape, renderDisplay, persist]);

  const cancelDraft = useCallback(() => {
    if (draftRef.current) { draftRef.current = null; renderDisplay(); }
    drawingRef.current = false;
  }, [renderDisplay]);

  // ---- OCR tap/drag-to-redact -------------------------------------------
  // Lazily OCR the CURRENT source image (natural size => boxes are already in
  // image space). Runs at most once per image; heavy, so we show a spinner.
  const ensureOcr = useCallback(async () => {
    if (ocrStartedRef.current) return;
    ocrStartedRef.current = true;
    const img = imgRef.current;
    if (!img) { ocrStartedRef.current = false; return; }
    setOcrState('loading');
    try {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      // Rasterize to a natural-size canvas (handles SVG seeds; guarantees the
      // OCR coordinate space equals the editor's image space).
      let src: HTMLCanvasElement | HTMLImageElement = img;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const cctx = canvas.getContext('2d');
      if (cctx) { cctx.drawImage(img, 0, 0, w, h); src = canvas; }
      const res = await runOcr(src);
      ocrWordsRef.current = res.words;
      setOcrState(res.words.length ? 'ready' : 'empty');
      renderDisplay();
    } catch (err) {
      console.warn('[editor] OCR failed:', err);
      ocrWordsRef.current = [];
      setOcrState('error');
    }
  }, [renderDisplay]);

  // Kick off OCR the first time the Tap-words tool is selected for this image.
  useEffect(() => {
    if (tool === 'words') void ensureOcr();
  }, [tool, ensureOcr]);

  /** Boxes to tap/drag against, per current granularity (word vs letter). */
  const collectBoxes = useCallback((): OcrBox[] => {
    const words = ocrWordsRef.current;
    if (granularityRef.current === 'letter') {
      const out: OcrBox[] = [];
      for (const w of words) {
        if (w.symbols.length) out.push(...w.symbols);
        else out.push(w); // no symbol boxes -> fall back to the word box
      }
      return out;
    }
    return words;
  }, []);

  const beginWordSelect = useCallback((p: Point) => {
    wordSelStartRef.current = p;
    wordSelBoxesRef.current = [];
    wordSelRectRef.current = null;
    renderDisplay();
  }, [renderDisplay]);

  const moveWordSelect = useCallback((cur: Point) => {
    const start = wordSelStartRef.current;
    if (!start) return;
    const r = {
      x0: Math.min(start.x, cur.x),
      y0: Math.min(start.y, cur.y),
      x1: Math.max(start.x, cur.x),
      y1: Math.max(start.y, cur.y),
    };
    wordSelRectRef.current = { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 };
    const moved = r.x1 - r.x0 > 3 || r.y1 - r.y0 > 3;
    if (moved) {
      wordSelBoxesRef.current = collectBoxes().filter((b) => boxIntersectsRect(b, r));
    } else {
      const hits = collectBoxes().filter((b) => pointInBox(start, b, 2));
      wordSelBoxesRef.current = hits.length ? [hits.reduce((a, b) => (boxArea(b) < boxArea(a) ? b : a))] : [];
    }
    renderDisplay();
  }, [collectBoxes, renderDisplay]);

  const commitWordSelection = useCallback(() => {
    const start = wordSelStartRef.current;
    wordSelStartRef.current = null;
    let boxes = wordSelBoxesRef.current;
    // Plain tap that produced no drag-selection: redact the tightest box under it.
    if (!boxes.length && start) {
      const hits = collectBoxes().filter((b) => pointInBox(start, b, 2));
      if (hits.length) boxes = [hits.reduce((a, b) => (boxArea(b) < boxArea(a) ? b : a))];
    }
    wordSelBoxesRef.current = [];
    wordSelRectRef.current = null;
    if (!boxes.length) { renderDisplay(); return; }

    // Honor the per-round stroke limit: only add up to the remaining budget.
    let allowed = boxes;
    if (max != null) {
      const room = Math.max(0, max - shapesRef.current.length);
      allowed = boxes.slice(0, room);
    }
    if (!allowed.length) { renderDisplay(); return; }

    const base = baseRef.current;
    const ctx = base?.getContext('2d');
    const pad = 2;
    const added: Shape[] = [];
    for (const b of allowed) {
      const shape: Shape = {
        type: 'rect',
        x: b.x0 - pad,
        y: b.y0 - pad,
        w: b.x1 - b.x0 + pad * 2,
        h: b.y1 - b.y0 + pad * 2,
        fill: FALLBACK_FILL,
      };
      shape.fill = computeFill(shape); // blend-sample from the original image
      added.push(shape);
      if (ctx) drawShape(ctx, shape);
    }
    shapesRef.current = [...shapesRef.current, ...added];
    setShapeCount(shapesRef.current.length);
    renderDisplay();
    persist();
  }, [collectBoxes, computeFill, drawShape, max, renderDisplay, persist]);

  const interactive = loaded && !disabled && !submitted;
  const interactiveRef = useRef(interactive);
  useEffect(() => { interactiveRef.current = interactive; }, [interactive]);

  // ---- pointer handlers --------------------------------------------------
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!loaded) return;
    e.preventDefault();
    try { (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); } catch { /* best effort */ }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two+ fingers => pinch-zoom/pan; abandon any in-progress stroke.
    if (pointersRef.current.size >= 2) {
      cancelDraft();
      startPinch();
      return;
    }

    // Desktop pan: middle mouse OR space held.
    const wantPan = e.pointerType !== 'touch' && (e.button === 1 || spaceRef.current);
    if (wantPan) {
      gestureRef.current = { mode: 'pan', panLast: { x: e.clientX, y: e.clientY } };
      return;
    }

    if (!interactiveRef.current) return;

    if (toolRef.current === 'eraser') {
      gestureRef.current = { mode: 'none' };
      eraseAt(toImage(e.clientX, e.clientY, false));
      return;
    }

    if (toolRef.current === 'words') {
      gestureRef.current = { mode: 'words' };
      beginWordSelect(toImage(e.clientX, e.clientY, false));
      return;
    }

    // Stroke-limit: block starting a NEW shape once the cap is reached.
    if (atLimitRef.current) return;

    gestureRef.current = { mode: 'draw' };
    beginDraw(toImage(e.clientX, e.clientY));
  }, [loaded, cancelDraft, startPinch, eraseAt, toImage, atLimitRef, beginDraw, beginWordSelect]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const mode = gestureRef.current.mode;
    if (mode === 'pinch') { e.preventDefault(); doPinch(); return; }
    if (mode === 'pan') { e.preventDefault(); doPan(e.clientX, e.clientY); return; }
    if (mode === 'words') { e.preventDefault(); moveWordSelect(toImage(e.clientX, e.clientY, false)); return; }
    if (mode === 'draw' && drawingRef.current) {
      e.preventDefault();
      moveDraw(toImage(e.clientX, e.clientY));
    }
  }, [doPinch, doPan, moveWordSelect, moveDraw, toImage]);

  const endPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    e.preventDefault();
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const wasMode = gestureRef.current.mode;
    pointersRef.current.delete(e.pointerId);
    const remaining = pointersRef.current.size;

    if (wasMode === 'draw') {
      if (drawingRef.current) commitDraft();
      gestureRef.current = { mode: 'none' };
      return;
    }
    if (wasMode === 'words') {
      commitWordSelection();
      gestureRef.current = { mode: 'none' };
      return;
    }
    if (wasMode === 'pinch') {
      if (remaining >= 2) { startPinch(); }
      else if (remaining === 1) {
        const [pt] = [...pointersRef.current.values()];
        gestureRef.current = { mode: 'pan', panLast: { ...pt } };
      } else gestureRef.current = { mode: 'none' };
      return;
    }
    if (wasMode === 'pan') {
      if (remaining >= 2) startPinch();
      else if (remaining === 1) {
        const [pt] = [...pointersRef.current.values()];
        gestureRef.current = { mode: 'pan', panLast: { ...pt } };
      } else gestureRef.current = { mode: 'none' };
      return;
    }
    gestureRef.current = { mode: 'none' };
  }, [commitDraft, commitWordSelection, startPinch]);

  // ---- toolbar actions ---------------------------------------------------
  const undo = useCallback(() => {
    if (shapesRef.current.length === 0) return;
    shapesRef.current = shapesRef.current.slice(0, -1);
    setShapeCount(shapesRef.current.length);
    rebuildBase();
    renderDisplay();
    persist();
  }, [rebuildBase, renderDisplay, persist]);

  const reset = useCallback(() => {
    shapesRef.current = [];
    draftRef.current = null;
    setShapeCount(0);
    rebuildBase();
    renderDisplay();
    persist();
  }, [rebuildBase, renderDisplay, persist]);

  const handleSubmit = useCallback(() => {
    const base = baseRef.current;
    if (!base) return;
    // base already holds image + all committed shapes at natural resolution.
    const png = base.toDataURL('image/png');
    clearSaved();
    onSubmit(png);
  }, [onSubmit, clearSaved]);

  // Timer-driven auto-submit: fire once whenever flushToken changes to a truthy value.
  const lastFlush = useRef(0);
  useEffect(() => {
    if (!flushToken || flushToken === lastFlush.current) return;
    lastFlush.current = flushToken;
    if (loaded && !submitted) handleSubmit();
  }, [flushToken, loaded, submitted, handleSubmit]);

  // Once the server confirms our submission, drop the autosave.
  useEffect(() => { if (submitted) clearSaved(); }, [submitted, clearSaved]);

  const remaining = max != null ? Math.max(0, max - shapeCount) : null;
  const cursor = !interactive
    ? 'default'
    : spaceDown
      ? 'grab'
      : tool === 'eraser'
        ? 'cell'
        : 'crosshair';

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <ToolButton active={tool === 'rect'} onClick={() => setTool('rect')} disabled={!interactive} label="▭ Box" />
          <ToolButton active={tool === 'brush'} onClick={() => setTool('brush')} disabled={!interactive} label="✎ Brush" />
          <ToolButton active={tool === 'words'} onClick={() => setTool('words')} disabled={!interactive} label="🔤 Tap text" />
          <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} disabled={!interactive} label="⌫ Eraser" />
        </div>

        <label className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg bg-panel2 ${tool === 'brush' ? 'opacity-100' : 'opacity-40'}`}>
          <span className="whitespace-nowrap">Thickness</span>
          <input
            type="range"
            min={MIN_THICKNESS}
            max={MAX_THICKNESS}
            value={thickness}
            disabled={!interactive || tool !== 'brush'}
            onChange={(e) => setThickness(Number(e.target.value))}
            className="accent-grief w-24 sm:w-32"
          />
          <span className="tabular-nums w-6 text-right">{thickness}</span>
        </label>

        {tool === 'words' && (
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
              <button
                type="button"
                onClick={() => setGranularity('word')}
                disabled={!interactive}
                className={`px-2.5 py-2 font-medium transition-colors disabled:opacity-40 ${granularity === 'word' ? 'bg-grief text-white' : 'bg-panel2 text-white/80 hover:bg-white/10'}`}
              >Words</button>
              <button
                type="button"
                onClick={() => setGranularity('letter')}
                disabled={!interactive}
                className={`px-2.5 py-2 font-medium transition-colors disabled:opacity-40 ${granularity === 'letter' ? 'bg-grief text-white' : 'bg-panel2 text-white/80 hover:bg-white/10'}`}
              >Letters</button>
            </div>
            <span className="text-xs text-white/50 whitespace-nowrap">
              {ocrState === 'loading' && '🔎 Detecting text…'}
              {ocrState === 'ready' && `${ocrWordsRef.current.length} words — tap or drag`}
              {ocrState === 'empty' && 'No text detected'}
              {ocrState === 'error' && 'Text detection failed'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setConstrain((c) => !c)}
          disabled={!interactive}
          title="Constrain: perfect squares (Box) / straight lines (Brush). Hold Shift on desktop."
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-40 ${
            constrain
              ? 'bg-grief/20 border-grief/40 text-white'
              : 'bg-panel2 border-white/10 text-white/80 hover:bg-white/10'
          }`}
        >
          📐 Straight
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center rounded-lg overflow-hidden border border-white/10 text-sm">
          <button type="button" onClick={() => zoomButton(1 / 1.25)} disabled={!loaded} className="px-2.5 py-2 bg-panel2 text-white/80 hover:bg-white/10 disabled:opacity-40" title="Zoom out">−</button>
          <button type="button" onClick={resetView} disabled={!loaded} className="px-2 py-2 bg-panel2 text-white/70 hover:bg-white/10 disabled:opacity-40 tabular-nums w-14" title="Reset view">{zoomPct}%</button>
          <button type="button" onClick={() => zoomButton(1.25)} disabled={!loaded} className="px-2.5 py-2 bg-panel2 text-white/80 hover:bg-white/10 disabled:opacity-40" title="Zoom in">+</button>
        </div>

        <button onClick={undo} disabled={!interactive || shapeCount === 0} className="btn-secondary">↶ Undo</button>
        <button onClick={reset} disabled={!interactive || shapeCount === 0} className="btn-secondary">Reset</button>
      </div>

      {/* Canvas viewport */}
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden bg-panel2 ring-1 ring-white/10"
        style={{ height: '60vh', maxHeight: '640px', touchAction: 'none' }}
      >
        <canvas
          ref={displayRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className="block w-full h-full"
          style={{ touchAction: 'none', cursor }}
        />
        {/* offscreen committed-scene cache (natural resolution) */}
        <canvas ref={baseRef} className="hidden" />
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">Loading source…</div>
        )}
        {remaining != null && (
          <div className={`absolute top-2 left-2 pill text-xs ${atLimit ? 'bg-grief/30 text-grief border-grief/50' : 'bg-black/50 text-white/80 border-white/10'}`}>
            {remaining} redaction{remaining === 1 ? '' : 's'} left
          </div>
        )}
        {submitted && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-grief">Submitted ✓</div>
              <div className="text-white/70 text-sm mt-1">Waiting for the reveal…</div>
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-white/40 -mt-1">
        Pinch or scroll to zoom · two-finger drag (or Space/middle-drag) to pan · {tool === 'eraser' ? 'tap a redaction to remove it' : tool === 'words' ? 'tap a word — or drag across several — to black it out' : 'Shift / 📐 for straight lines & squares'}
      </p>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50">
          {shapeCount} edit{shapeCount === 1 ? '' : 's'}{max != null ? ` · max ${max}` : ''}
        </span>
        <div className="flex-1" />
        <button onClick={handleSubmit} disabled={!interactive} className="btn-primary">
          {submitted ? 'Submitted' : 'Submit redaction'}
        </button>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, disabled, label }: { active: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
        active ? 'bg-grief text-white shadow-glow-grief' : 'bg-panel2 text-white/80 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}
