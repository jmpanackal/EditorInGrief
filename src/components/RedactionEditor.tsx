import { useCallback, useEffect, useRef, useState } from 'react';
import { disposeOcr, runOcr, type OcrBox, type OcrWord } from '../lib/ocr';

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
 *   Default scale is fit-to-width (readable body text; tall images pan vertically),
 *   not contain-entire-image — see computeFit.
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
  | { type: 'rect'; x: number; y: number; w: number; h: number; fill: string; ocrKey?: string }
  | { type: 'brush'; points: Point[]; thickness: number; fill: string };

type Tool = 'rect' | 'brush' | 'eraser' | 'words';
/** Redact whole words (default) or individual letters in the tap/drag tool. */
type WordGranularity = 'word' | 'letter';
/** An OCR box tagged with a STABLE key so tap-toggle can find/remove its shape. */
type KeyedBox = OcrBox & { key: string };
type RGB = [number, number, number];

/** Initial tool: Tap text below Tailwind `md` (768px); Box on desktop. */
function initialTool(): Tool {
  if (typeof window === 'undefined') return 'rect';
  return window.matchMedia('(max-width: 767px)').matches ? 'words' : 'rect';
}

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

/**
 * Flatten OCR results into tappable boxes with STABLE keys. Word mode keys each
 * word by its index (`w{i}`); letter mode keys each symbol (`s{i}_{j}`), falling
 * back to the word box when a word has no symbol boxes. Keys let tap-to-toggle
 * find the exact shape a previous tap created so a second tap can remove it.
 */
function keyedBoxesFor(words: OcrWord[], granularity: WordGranularity): KeyedBox[] {
  if (granularity === 'letter') {
    const out: KeyedBox[] = [];
    words.forEach((w, i) => {
      if (w.symbols.length) w.symbols.forEach((s, j) => out.push({ ...s, key: `s${i}_${j}` }));
      else out.push({ ...w, key: `w${i}` });
    });
    return out;
  }
  return words.map((w, i) => ({ ...w, key: `w${i}` }));
}

/** Keys of OCR-originated redactions currently on the canvas (for underline state). */
function redactedKeySet(shapes: Shape[]): Set<string> {
  const set = new Set<string>();
  for (const s of shapes) if (s.type === 'rect' && s.ocrKey) set.add(s.ocrKey);
  return set;
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

/**
 * UNDERLINE affordance: a thin rule beneath each detected word/letter signals
 * it's tappable. Drawn as a light halo + dark/red core so it stays readable on
 * both light (paper/white posts) and dark (memes, night-mode) backgrounds.
 */
function drawUnderlines(ctx: CanvasRenderingContext2D, boxes: KeyedBox[], redacted: Set<string>, scale: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const inset = 1 / scale;
  for (const b of boxes) {
    const on = redacted.has(b.key);
    const y = b.y1 + 1.5 / scale;
    const x0 = b.x0 + inset;
    const x1 = b.x1 - inset;
    // Halo — light stroke so the mark pops on dark ink/photos
    ctx.beginPath();
    ctx.lineWidth = (on ? 5.2 : 4.2) / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    // Soft dark outer edge — pops on pale paper without eating the halo
    ctx.beginPath();
    ctx.lineWidth = (on ? 3.6 : 3) / scale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    // Core — grief red when already redacted, near-black when available
    ctx.beginPath();
    ctx.lineWidth = (on ? 2.2 : 1.7) / scale;
    ctx.strokeStyle = on ? 'rgba(196, 30, 30, 1)' : 'rgba(18, 18, 18, 0.95)';
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
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
    ctx.strokeStyle = 'rgba(26, 26, 26, 0.65)';
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(200, 30, 30, 0.28)';
  ctx.strokeStyle = 'rgba(200, 30, 30, 0.9)';
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
  onSubmit: (pngDataUrl: string, editCount: number) => void;
  /** Withdraw Ready so the player can keep editing. */
  onUnsubmit?: () => void;
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

/** Gartic-style brush size presets (circles in the tool rail). */
const THICKNESS_PRESETS = [10, 18, 28, 44, 64] as const;
/** Allow zooming out below the default fit-width view to survey the whole page. */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
/**
 * Default view is fit-to-width (not contain-entire-image). A slight pad keeps
 * the image from kissing the viewport edge. `zoom === 1` ("100%") means this
 * readable default — Reset returns here.
 */
const FIT_WIDTH_PAD = 0.98;
/** Cap initial upscale so tiny assets don't fill the stage (~2 CSS px / source px). */
const MAX_FIT_CSS_PX = 2;
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

export function RedactionEditor({ imageUrl, disabled, onSubmit, onUnsubmit, submitted, flushToken, maxRedactions, storageKey }: Props) {
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

  const [tool, setTool] = useState<Tool>(initialTool);
  const toolRef = useRef<Tool>(tool);
  const [thickness, setThickness] = useState(28);
  const thicknessRef = useRef(28);
  const [shapeCount, setShapeCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpWrapRef = useRef<HTMLDivElement | null>(null);
  const brushHoverRef = useRef<Point | null>(null);

  // Dismiss help when tapping/clicking outside the ⓘ control + popover.
  useEffect(() => {
    if (!helpOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = helpWrapRef.current;
      if (el && !el.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [helpOpen]);

  // ---- OCR tap/drag-to-redact (assist on top of manual tools) -----------
  const ocrWordsRef = useRef<OcrWord[]>([]);
  const [ocrState, setOcrState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'empty'>('idle');
  const ocrStartedRef = useRef(false); // guards a single OCR run per source image
  const [granularity, setGranularity] = useState<WordGranularity>('word');
  const granularityRef = useRef<WordGranularity>('word');
  // Live tap/drag selection preview (image-space boxes highlighted before commit).
  const wordSelStartRef = useRef<Point | null>(null);
  const wordSelBoxesRef = useRef<KeyedBox[]>([]);
  const wordSelRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const wordDraggedRef = useRef(false); // did the current words gesture actually drag?

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
  /**
   * Base scale maps image → viewport. Prefer fit-to-width so tall screenshots
   * fill the stage (minimal side gutters) and body text stays readable; the
   * user pans vertically for the rest. Tiny sources are clamped so they
   * aren't blown up absurdly. User zoom multiplies this (`scale = fit * zoom`);
   * zoom=1 is the default readable view.
   */
  const computeFit = useCallback(() => {
    const img = imgRef.current;
    const c = displayRef.current;
    if (!img || !c || c.width < 2) return;
    const iw = img.naturalWidth || 1;
    const dpr = window.devicePixelRatio || 1;
    const usable = c.width * FIT_WIDTH_PAD;
    // Fill viewport width (tall images overflow vertically → pan).
    let fit = usable / iw;
    // Tiny sources: don't upscale past ~2 CSS pixels per source pixel.
    fit = Math.min(fit, MAX_FIT_CSS_PX * dpr);
    viewRef.current.fit = fit || 1;
  }, []);

  /**
   * Keep the image on-stage. Document-style: top-align when the scaled image
   * is shorter than the viewport (avoid floating mid-canvas gutters after
   * fit-to-width); center horizontally only when letterboxed on the sides.
   */
  const clampView = useCallback(() => {
    const c = displayRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const v = viewRef.current;
    const scale = v.fit * v.zoom;
    const sw = (img.naturalWidth || 1) * scale;
    const sh = (img.naturalHeight || 1) * scale;
    v.ox = sw <= c.width ? (c.width - sw) / 2 : Math.min(0, Math.max(c.width - sw, v.ox));
    // Top-align when there's spare vertical room; otherwise clamp pan range.
    v.oy = sh <= c.height ? 0 : Math.min(0, Math.max(c.height - sh, v.oy));
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
    // Underline affordance for tappable words/letters whenever Tap-text is active.
    if (toolRef.current === 'words' && ocrWordsRef.current.length) {
      const kb = keyedBoxesFor(ocrWordsRef.current, granularityRef.current);
      drawUnderlines(ctx, kb, redactedKeySet(shapesRef.current), scale);
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
    // Display-only Marker cursor ring — never written to the editing canvas.
    if (toolRef.current === 'brush' && brushHoverRef.current && !drawingRef.current) {
      drawBrushHover(ctx, brushHoverRef.current, thicknessRef.current, scale);
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
      // New source → default readable view (fit-width at 100%), top-left origin
      // before clamp recenters horizontally if the image is narrower than the stage.
      viewRef.current.zoom = 1;
      viewRef.current.ox = 0;
      viewRef.current.oy = 0;
      setZoomPct(100);
      rebuildBase();
      layout();
      setLoaded(true);
      // Container may still be settling (fonts, flex); re-fit once more next frame.
      requestAnimationFrame(() => {
        if (imgRef.current !== img) return;
        layout();
      });
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

  /** Return to the default readable view (fit-width at 100%, top-aligned). */
  const resetView = useCallback(() => {
    const v = viewRef.current;
    v.zoom = 1;
    v.ox = 0;
    v.oy = 0;
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

  // Shift (constrain) + Space (pan) — tracked globally while the editor is mounted.
  // Other shortcuts are wired later (after undo/submit) so they share the same guards.
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

  /** Escape: drop in-progress box/marker stroke or tap-text drag preview. */
  const cancelInProgress = useCallback(() => {
    const hadDraft = !!draftRef.current || drawingRef.current;
    cancelDraft();
    const hadWords =
      !!wordSelStartRef.current ||
      wordSelBoxesRef.current.length > 0 ||
      !!wordSelRectRef.current;
    if (hadWords) {
      wordSelStartRef.current = null;
      wordSelBoxesRef.current = [];
      wordSelRectRef.current = null;
      wordDraggedRef.current = false;
      if (gestureRef.current.mode === 'words') gestureRef.current = { mode: 'none' };
    }
    if (hadDraft || hadWords) renderDisplay();
  }, [cancelDraft, renderDisplay]);

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
      // Let a deliberate retry start a fresh recognition attempt rather than
      // leaving this browser stuck behind a failed worker request.
      ocrStartedRef.current = false;
      setOcrState('error');
    }
  }, [renderDisplay]);

  const retryOcr = useCallback(() => {
    if (ocrState === 'loading') return;
    void (async () => {
      // OCR runs in each player's browser. Recreating the worker clears a
      // transient CDN/worker failure without affecting anyone else in the room.
      await disposeOcr();
      ocrWordsRef.current = [];
      ocrStartedRef.current = false;
      setOcrState('idle');
      await ensureOcr();
    })();
  }, [ensureOcr, ocrState]);

  // Kick off OCR the first time the Tap-words tool is selected for this image.
  useEffect(() => {
    if (tool === 'words') void ensureOcr();
  }, [tool, ensureOcr]);

  // Redraw the canvas overlays when the tool or granularity changes (so the
  // underline affordances appear/disappear and switch word<->letter promptly).
  useEffect(() => { renderDisplay(); }, [tool, granularity, renderDisplay]);

  /** Boxes to tap/drag against, per current granularity (word vs letter). */
  const collectBoxes = useCallback((): KeyedBox[] => {
    return keyedBoxesFor(ocrWordsRef.current, granularityRef.current);
  }, []);

  const beginWordSelect = useCallback((p: Point) => {
    wordSelStartRef.current = p;
    wordDraggedRef.current = false;
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
      wordDraggedRef.current = true;
      wordSelBoxesRef.current = collectBoxes().filter((b) => boxIntersectsRect(b, r));
    } else {
      const hits = collectBoxes().filter((b) => pointInBox(start, b, 2));
      wordSelBoxesRef.current = hits.length ? [hits.reduce((a, b) => (boxArea(b) < boxArea(a) ? b : a))] : [];
    }
    renderDisplay();
  }, [collectBoxes, renderDisplay]);

  /** Build a blend-filled rect redaction from an OCR box, tagged with its key. */
  const shapeFromBox = useCallback((b: KeyedBox): Shape => {
    const pad = 2;
    const shape: Shape = {
      type: 'rect',
      x: b.x0 - pad,
      y: b.y0 - pad,
      w: b.x1 - b.x0 + pad * 2,
      h: b.y1 - b.y0 + pad * 2,
      fill: FALLBACK_FILL,
      ocrKey: b.key,
    };
    shape.fill = computeFill(shape); // blend-sample from the original image
    return shape;
  }, [computeFill]);

  const commitWordSelection = useCallback(() => {
    const start = wordSelStartRef.current;
    const dragged = wordDraggedRef.current;
    wordSelStartRef.current = null;
    const selected = wordSelBoxesRef.current;
    wordSelBoxesRef.current = [];
    wordSelRectRef.current = null;

    // TAP (no drag): TOGGLE the single box under the pointer. If it's already
    // redacted, reveal it (remove that shape); otherwise hide it.
    if (!dragged) {
      let box = selected[0];
      if (!box && start) {
        const hits = collectBoxes().filter((b) => pointInBox(start, b, 2));
        if (hits.length) box = hits.reduce((a, b) => (boxArea(b) < boxArea(a) ? b : a));
      }
      if (!box) { renderDisplay(); return; }

      const existingIdx = shapesRef.current.findIndex((s) => s.type === 'rect' && s.ocrKey === box!.key);
      if (existingIdx >= 0) {
        // Reveal: drop that specific redaction and re-bake the scene.
        shapesRef.current = [...shapesRef.current.slice(0, existingIdx), ...shapesRef.current.slice(existingIdx + 1)];
        setShapeCount(shapesRef.current.length);
        rebuildBase();
        renderDisplay();
        persist();
        return;
      }
      // Hide (respect the per-round stroke limit).
      if (max != null && shapesRef.current.length >= max) { renderDisplay(); return; }
      const shape = shapeFromBox(box);
      shapesRef.current = [...shapesRef.current, shape];
      setShapeCount(shapesRef.current.length);
      const ctx = baseRef.current?.getContext('2d');
      if (ctx) drawShape(ctx, shape);
      renderDisplay();
      persist();
      return;
    }

    // DRAG across a range: always HIDE the touched boxes not already redacted.
    if (!selected.length) { renderDisplay(); return; }
    const already = redactedKeySet(shapesRef.current);
    let toAdd = selected.filter((b) => !already.has(b.key));
    if (max != null) {
      const room = Math.max(0, max - shapesRef.current.length);
      toAdd = toAdd.slice(0, room);
    }
    if (!toAdd.length) { renderDisplay(); return; }
    const ctx = baseRef.current?.getContext('2d');
    const added = toAdd.map((b) => {
      const shape = shapeFromBox(b);
      if (ctx) drawShape(ctx, shape);
      return shape;
    });
    shapesRef.current = [...shapesRef.current, ...added];
    setShapeCount(shapesRef.current.length);
    renderDisplay();
    persist();
  }, [collectBoxes, shapeFromBox, drawShape, rebuildBase, max, renderDisplay, persist]);

  const interactive = loaded && !disabled && !submitted;
  const interactiveRef = useRef(interactive);
  useEffect(() => { interactiveRef.current = interactive; }, [interactive]);
  /** Ready/Unready stays available while stamped Ready (tools stay locked). */
  const canToggleReady = loaded && !disabled;
  const canToggleReadyRef = useRef(canToggleReady);
  useEffect(() => { canToggleReadyRef.current = canToggleReady; }, [canToggleReady]);

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
    if (toolRef.current === 'brush' && interactiveRef.current && e.pointerType !== 'touch' && !drawingRef.current) {
      const point = toImage(e.clientX, e.clientY, false);
      const img = imgRef.current;
      const inImage = !!img && point.x >= 0 && point.y >= 0 && point.x <= img.naturalWidth && point.y <= img.naturalHeight;
      brushHoverRef.current = inImage ? point : null;
      renderDisplay();
    }
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
  }, [doPinch, doPan, moveWordSelect, moveDraw, toImage, renderDisplay]);

  const clearBrushHover = useCallback(() => {
    if (!brushHoverRef.current) return;
    brushHoverRef.current = null;
    renderDisplay();
  }, [renderDisplay]);

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
    onSubmit(png, shapesRef.current.length);
  }, [onSubmit, clearSaved]);

  const handleUnsubmit = useCallback(() => {
    onUnsubmit?.();
  }, [onUnsubmit]);

  const toggleReady = useCallback(() => {
    if (submitted) handleUnsubmit();
    else handleSubmit();
  }, [submitted, handleSubmit, handleUnsubmit]);

  // Timer-driven auto-submit: fire once whenever flushToken changes to a truthy value.
  // If the image isn't loaded yet, keep a pending flag so we flush as soon as it is
  // (empty/unedited source still submits — required for deadline auto-file).
  const lastFlush = useRef(0);
  const pendingFlush = useRef(false);
  useEffect(() => {
    if (flushToken && flushToken !== lastFlush.current) {
      lastFlush.current = flushToken;
      pendingFlush.current = true;
    }
    if (!pendingFlush.current || submitted || !loaded) return;
    pendingFlush.current = false;
    handleSubmit();
  }, [flushToken, loaded, submitted, handleSubmit]);

  // Once the server confirms Ready, drop the autosave (draft returns if they Unready).
  useEffect(() => { if (submitted) clearSaved(); }, [submitted, clearSaved]);

  // Editor keyboard shortcuts (mounted only during the redaction round).
  // Skip when typing in a field, when a modal is open, or when the editor is inactive.
  // No redo stack — Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y are intentionally not bound.
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const modalOpen = () => !!document.querySelector('[aria-modal="true"]');
    const editorLive = () => interactiveRef.current && !modalOpen();

    const stepThickness = (dir: -1 | 1) => {
      if (toolRef.current !== 'brush') return false;
      const cur = thicknessRef.current;
      let idx = THICKNESS_PRESETS.indexOf(cur as (typeof THICKNESS_PRESETS)[number]);
      if (idx < 0) {
        idx = THICKNESS_PRESETS.reduce(
          (best, t, i) => (Math.abs(t - cur) < Math.abs(THICKNESS_PRESETS[best] - cur) ? i : best),
          0,
        );
      }
      const next = THICKNESS_PRESETS[Math.max(0, Math.min(THICKNESS_PRESETS.length - 1, idx + dir))];
      setThickness(next);
      return true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
      // Space / Shift handled by the dedicated pan/constrain listeners above.
      if (e.code === 'Space' || e.key === 'Shift') return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === 'Escape') {
        if (helpOpen) { setHelpOpen(false); e.preventDefault(); return; }
        if (!editorLive()) return;
        cancelInProgress();
        e.preventDefault();
        return;
      }

      // Ready / Unready — works even while stamped Ready (tools stay locked).
      if (e.key === 'Enter' && (mod || !e.altKey)) {
        if (modalOpen() || !canToggleReadyRef.current) return;
        if (!mod) {
          const el = document.activeElement as HTMLElement | null;
          if (el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.closest('button, a, [role="button"]'))) return;
        }
        e.preventDefault();
        toggleReady();
        return;
      }

      if (!editorLive()) return;

      // Undo (same as Undo button — pops last shape).
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
        return;
      }

      // Tool switch: 1–4 or B / M / T / E
      const toolKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const toolMap: Record<string, Tool> = {
        '1': 'rect', b: 'rect',
        '2': 'brush', m: 'brush',
        '3': 'words', t: 'words',
        '4': 'eraser', e: 'eraser',
      };
      if (!mod && !e.altKey && toolMap[toolKey]) {
        e.preventDefault();
        setTool(toolMap[toolKey]);
        return;
      }

      // Marker thickness: [ ] or - / +
      if (!mod && !e.altKey && (e.key === '[' || e.key === '-' || e.key === '_')) {
        if (stepThickness(-1)) e.preventDefault();
        return;
      }
      if (!mod && !e.altKey && (e.key === ']' || e.key === '+' || e.key === '=')) {
        if (stepThickness(1)) e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, toggleReady, cancelInProgress, helpOpen]);

  const remaining = max != null ? Math.max(0, max - shapeCount) : null;
  const limitTone = remaining === 0
    ? 'bg-grief text-paper'
    : max != null && remaining != null && remaining <= Math.ceil(max / 3)
      ? 'bg-[#e0a21a] text-ink'
      : 'bg-papercard text-ink';
  const cursor = !interactive
    ? 'default'
    : spaceDown
      ? 'grab'
      : tool === 'eraser'
        ? 'cell'
        : 'crosshair';

  const wordsStatus =
    ocrState === 'loading' ? '🔎 Detecting text…'
    : ocrState === 'ready' ? `${ocrWordsRef.current.length} words · tap to toggle, drag to hide`
    : ocrState === 'empty' ? 'No text found — retry or use Box / Brush'
    : ocrState === 'error' ? 'Reader paused — retry or use Box / Brush'
    : '';

  const controlsHint =
    'Default view fits the image to the viewport width (100%) for readable text — pan vertically on tall screenshots.\n' +
    'Zoom: scroll wheel or pinch (Reset returns to fit-width, top-aligned)\n' +
    'Pan: Space + drag, middle-drag, or two-finger drag\n' +
    'Straight lines / squares: hold Shift (or the Straight toggle)\n' +
    'Tap-text: tap a word to hide/reveal, drag across to hide a range\n' +
    'Shortcuts — Ctrl/Cmd+Z undo · 1/B Box · 2/M Marker · 3/T Tap text · 4/E Eraser\n' +
    '[ ] or −/+ Marker thickness · Ctrl/Cmd+Enter (or Enter) Ready/Unready · Esc cancel draw';

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'rect', icon: '▭', label: 'Box' },
    { id: 'brush', icon: '✎', label: 'Marker' },
    { id: 'words', icon: 'abc', label: 'Tap text' },
    { id: 'eraser', icon: '⌫', label: 'Eraser' },
  ];

  const renderTools = () =>
    tools.map((t) => (
      <RailTool
        key={t.id}
        active={tool === t.id}
        onClick={() => setTool(t.id)}
        disabled={!interactive}
        icon={t.icon}
        label={t.label}
      />
    ));

  const undoResetTools = (
    <>
      <RailTool
        onClick={undo}
        disabled={!interactive || shapeCount === 0}
        icon="↶"
        label="Undo"
      />
      <RailTool
        onClick={reset}
        disabled={!interactive || shapeCount === 0}
        icon="⟳"
        label="Reset"
      />
    </>
  );

  /** Tool modifiers centered under the canvas (Gartic-style sub-controls). */
  const bottomModifiers = (
    <>
      {tool === 'rect' && (
        <ConstrainButton label="Square" constrain={constrain} interactive={interactive} onClick={() => setConstrain((c) => !c)} />
      )}
      {tool === 'brush' && (
        <>
          <div className="flex items-center gap-0.5 sm:gap-1 rounded-[3px] border-2 border-ink bg-papercard px-1 py-0.5 shrink-0">
            {THICKNESS_PRESETS.map((t) => {
              const active = thickness === t;
              const dot = Math.max(6, Math.min(18, t * 0.28));
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!interactive}
                  onClick={() => setThickness(t)}
                  aria-label={`Brush size ${t}`}
                  aria-pressed={active}
                  className={`w-8 h-8 sm:w-9 sm:h-9 grid place-items-center rounded-full border-2 border-ink transition disabled:opacity-40 ${
                    active ? 'bg-grief' : 'bg-papercard hover:bg-paper2'
                  }`}
                >
                  <span
                    className={`rounded-full ${active ? 'bg-paper' : 'bg-ink'}`}
                    style={{ width: dot, height: dot }}
                  />
                </button>
              );
            })}
          </div>
          <ConstrainButton label="Straight" constrain={constrain} interactive={interactive} onClick={() => setConstrain((c) => !c)} />
        </>
      )}
      {tool === 'words' && (
        <>
          <div className="flex rounded-[3px] overflow-hidden border-2 border-ink text-xs shrink-0">
            <button
              type="button"
              onClick={() => setGranularity('word')}
              disabled={!interactive}
              className={`px-2.5 sm:px-3 py-2 font-slab font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${
                granularity === 'word' ? 'bg-ink text-paper' : 'bg-papercard text-ink hover:bg-paper2'
              }`}
            >
              Words
            </button>
            <button
              type="button"
              onClick={() => setGranularity('letter')}
              disabled={!interactive}
              className={`px-2.5 sm:px-3 py-2 font-slab font-bold uppercase tracking-wide transition-colors disabled:opacity-40 border-l-2 border-ink ${
                granularity === 'letter' ? 'bg-ink text-paper' : 'bg-papercard text-ink hover:bg-paper2'
              }`}
            >
              Letters
            </button>
          </div>
          {wordsStatus && (
            <span className="hidden lg:inline font-slab text-xs font-bold leading-snug text-ink max-w-[14rem] truncate" title={wordsStatus}>
              {wordsStatus}
            </span>
          )}
          {(ocrState === 'error' || ocrState === 'empty') && (
            <button type="button" onClick={retryOcr} disabled={!interactive} className="btn-secondary !px-2 !py-1.5 !text-xs shrink-0">
              ↻ Retry
            </button>
          )}
        </>
      )}
    </>
  );

  const zoomControl = (
    <div className="flex rounded-[3px] overflow-hidden border-2 border-ink bg-papercard font-slab font-bold text-sm shrink-0">
      <button type="button" onClick={() => zoomButton(1 / 1.25)} disabled={!loaded} className="h-9 w-8 sm:w-9 text-lg text-ink hover:bg-paper2 disabled:opacity-40" title="Zoom out" aria-label="Zoom out">−</button>
      <button type="button" onClick={resetView} disabled={!loaded} className="h-9 w-11 sm:w-12 text-ink2 hover:bg-paper2 disabled:opacity-40 tabular-nums border-x-2 border-ink text-[11px]" title="Reset to default (fit width)">{zoomPct}</button>
      <button type="button" onClick={() => zoomButton(1.25)} disabled={!loaded} className="h-9 w-8 sm:w-9 text-lg text-ink hover:bg-paper2 disabled:opacity-40" title="Zoom in" aria-label="Zoom in">+</button>
    </div>
  );

  // Must sit outside overflow-x-auto: that axis forces y clipping too, so a
  // bottom-full popover looked like a no-op click (state toggled, panel hidden).
  const helpPopover = helpOpen && (
    <div
      role="dialog"
      aria-label="Editor controls"
      className="absolute z-40 left-1/2 -translate-x-1/2 bottom-full mb-2 w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(70dvh,24rem)] overflow-y-auto themed-scroll card p-3 text-left shadow-clip text-xs leading-relaxed text-ink2"
    >
      <div className="kicker text-[10px] mb-1">Editor controls</div>
      {controlsHint.split('\n').map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 gap-1.5 sm:gap-2">
      {/* Desktop: compact square tool palette · dominant canvas
          Mobile: canvas on top, tool strip below */}
      <div className="flex flex-1 min-h-0 gap-2 sm:gap-2.5">
        {/* Left palette (md+) — Gartic 2-col square grid, vertically centered beside stage */}
        <aside className="hidden md:flex flex-col justify-center gap-2 shrink-0 w-[8.75rem] lg:w-[9.75rem] self-stretch">
          <div className="grid grid-cols-2 gap-2">
            {renderTools()}
            {undoResetTools}
          </div>
          {remaining != null && (
            <span className={`px-1.5 py-1 text-center rounded-[3px] border-2 border-ink font-slab font-bold uppercase tracking-wide text-[10px] leading-tight shrink-0 ${limitTone}`}>
              {remaining} left
            </span>
          )}
        </aside>

        {/* Center stage */}
        <div
          ref={containerRef}
          className="relative flex-1 min-w-0 min-h-0 rounded-[3px] overflow-hidden bg-paper2 border-2 border-ink"
          style={{ touchAction: 'none' }}
        >
          <canvas
            ref={displayRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={clearBrushHover}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            className="block w-full h-full"
            style={{ touchAction: 'none', cursor }}
          />
          {/* offscreen committed-scene cache (natural resolution) */}
          <canvas ref={baseRef} className="hidden" />
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center text-ink2 text-sm">Setting the type…</div>
          )}
          {tool === 'words' && ocrState === 'loading' && (
            <div
              className="absolute inset-0 z-10 grid place-items-center pointer-events-none"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[3px] border-2 border-ink bg-papercard/90 shadow-clip">
                <span
                  className="inline-block w-5 h-5 shrink-0 rounded-full border-2 border-ink/25 border-t-grief animate-spin"
                  aria-hidden="true"
                />
                <span className="font-slab font-bold uppercase tracking-wide text-sm text-ink">Detecting text…</span>
              </div>
            </div>
          )}
          {submitted && (
            <div className="absolute inset-0 grid place-items-center bg-paper/70 backdrop-blur-[1px]">
              <div className="text-center">
                <div className="stamp text-2xl animate-stamp-in">Ready</div>
                <div className="text-ink2 text-sm mt-3 italic">Waiting for everyone — tap Unready to keep editing</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: primary tools + undo/reset always visible */}
      <div className="md:hidden shrink-0 flex items-stretch gap-1.5">
        <div className="grid grid-cols-6 flex-1 min-w-0 gap-1">
          {renderTools()}
          {undoResetTools}
        </div>
        {remaining != null && (
          <span className={`shrink-0 px-2 inline-flex items-center rounded-[3px] border-2 border-ink font-slab font-bold uppercase tracking-wide text-[10px] ${limitTone}`}>
            {remaining} left
          </span>
        )}
      </div>

      {/* Bottom bar — sub-controls + zoom centered under canvas; Ready bottom-right */}
      <div className="shrink-0 grid grid-cols-[1fr_auto] md:grid-cols-[8.75rem_1fr_auto] lg:grid-cols-[9.75rem_1fr_auto] items-center gap-x-2 sm:gap-x-2.5 gap-y-1.5 min-h-[2.75rem] pt-0.5 min-w-0">
        {/* Spacer matching desktop palette width so center cluster sits under the stage */}
        <div className="hidden md:block" aria-hidden="true" />

        <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-w-0 col-span-1 md:col-span-1">
          {/* Only tool modifiers scroll; zoom/help stay unclipped so the popover can open upward. */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0 overflow-x-auto themed-scroll">
            {bottomModifiers}
          </div>
          {zoomControl}

          <div ref={helpWrapRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setHelpOpen((open) => !open)}
              aria-expanded={helpOpen}
              aria-label="Editor controls help"
              className="btn-secondary !px-2 !py-1.5 !text-xs"
            >
              ⓘ
            </button>
            {helpPopover}
          </div>

          <span className="text-[11px] sm:text-xs text-ink3 tabular-nums whitespace-nowrap shrink-0 hidden sm:inline">
            {shapeCount} edit{shapeCount === 1 ? '' : 's'}{max != null ? ` · max ${max}` : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleReady}
          disabled={!canToggleReady}
          className={`!py-2 sm:!py-2.5 shrink-0 justify-self-end ${submitted ? 'btn-secondary' : 'btn-primary'}`}
        >
          {submitted ? 'Unready' : 'Ready →'}
        </button>
      </div>
    </div>
  );
}

/** Compact square palette button (Gartic-style 1:1 tile). */
function RailTool({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={active}
      className={`aspect-square w-full flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] sm:text-[11px] font-slab font-bold uppercase tracking-wide transition-colors disabled:opacity-40 rounded-[3px] border-2 border-ink leading-none ${
        active ? 'bg-grief text-paper' : 'bg-papercard text-ink hover:bg-paper2'
      }`}
    >
      <span className="text-lg sm:text-xl leading-none" aria-hidden="true">{icon}</span>
      <span className="text-center leading-tight max-w-full truncate px-0.5">{label}</span>
    </button>
  );
}

function ConstrainButton({ label, constrain, interactive, onClick }: { label: string; constrain: boolean; interactive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={constrain}
      className={`shrink-0 px-2.5 py-2 text-xs font-slab font-bold uppercase tracking-wide rounded-[3px] border-2 border-ink transition-colors disabled:opacity-40 whitespace-nowrap ${
        constrain ? 'bg-ink text-paper' : 'bg-papercard text-ink hover:bg-paper2'
      }`}
    >
      📐 {label}
    </button>
  );
}

/** Non-destructive cursor ring: shows the Marker diameter before drawing. */
function drawBrushHover(ctx: CanvasRenderingContext2D, p: Point, thickness: number, scale: number): void {
  const radius = thickness / 2;
  const dash = [5 / scale, 3 / scale];
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = 2.4 / scale;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash(dash);
  ctx.lineWidth = 1.4 / scale;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
