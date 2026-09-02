import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * RedactionEditor — the core mechanic.
 *
 * Real document-redaction: you can only PAINT over the original image's pixels,
 * never add. Each shape is filled with the auto-sampled LOCAL BACKGROUND color
 * of the original image around it (default) so the covered text blends away, or
 * solid black when the Blend toggle is off. The output IS the original image
 * with parts covered.
 *
 * Design notes:
 * - Coordinates are kept in IMAGE space (the source's natural pixels). The
 *   canvas backing store equals the natural resolution, and CSS scales it down
 *   to fit the viewport, so pointer mapping and PNG export are both trivial and
 *   the flattened result matches the original exactly.
 * - Undo removes the LAST SHAPE (a rectangle or a full brush stroke), never a
 *   pixel. We keep a shape list and re-render.
 * - Performance: committed shapes are baked onto an offscreen "base" canvas.
 *   During a drag we only blit that cache + draw the single in-progress shape,
 *   so it stays fast after dozens of edits.
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

type Tool = 'rect' | 'brush';
type RGB = [number, number, number];

/** Solid-black fallback used when blend mode is off or sampling isn't possible. */
const BLACK = '#000';

/** Median of each RGB channel independently — robust to text/outlier pixels. */
function medianColor(samples: RGB[]): string {
  if (samples.length === 0) return BLACK;
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
  return samples.length ? medianColor(samples) : BLACK;
}

/**
 * Sample the local background near a freehand stroke: read small neighborhoods
 * around a handful of points along the path (subsampled for speed) from the
 * original image and take the median. Text strokes are thin relative to the
 * neighborhood, so the median lands on the surrounding background.
 */
function sampleBrushFill(img: ImageData, points: Point[], thickness: number): string {
  const { width: W, height: H, data } = img;
  if (points.length === 0) return BLACK;
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
  return samples.length ? medianColor(samples) : BLACK;
}

interface Props {
  imageUrl: string;
  disabled?: boolean;
  onSubmit: (pngDataUrl: string) => void;
  submitted?: boolean;
  /** Incrementing this triggers an automatic flatten+submit (used by the timer
   * auto-submit). Change the value (e.g. Date.now()) to fire once. */
  flushToken?: number;
}

const MIN_THICKNESS = 6;
const MAX_THICKNESS = 90;

export function RedactionEditor({ imageUrl, disabled, onSubmit, submitted, flushToken }: Props) {
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null); // offscreen committed scene
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Untouched pixels of the ORIGINAL image. We always sample fill colors from
  // here (never from already-redacted output) so overlapping shapes don't
  // compound sampling errors.
  const origDataRef = useRef<ImageData | null>(null);

  const shapesRef = useRef<Shape[]>([]);
  const draftRef = useRef<Shape | null>(null);
  const drawingRef = useRef(false);

  const [tool, setTool] = useState<Tool>('rect');
  const toolRef = useRef<Tool>('rect');
  const [thickness, setThickness] = useState(28);
  const thicknessRef = useRef(28);
  const [shapeCount, setShapeCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Default = blend with sampled local background. Toggle off for solid black.
  const [blend, setBlend] = useState(true);
  const blendRef = useRef(true);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);
  useEffect(() => { blendRef.current = blend; }, [blend]);

  // Compute the fill color for a shape: sampled background (default) or black.
  const computeFill = useCallback((s: Shape): string => {
    if (!blendRef.current) return BLACK;
    const orig = origDataRef.current;
    if (!orig) return BLACK;
    if (s.type === 'rect') return sampleRectFill(orig, s.x, s.y, s.w, s.h);
    return sampleBrushFill(orig, s.points, s.thickness);
  }, []);

  // ---- drawing primitives ------------------------------------------------
  const drawShape = useCallback((ctx: CanvasRenderingContext2D, s: Shape) => {
    const color = s.fill || BLACK;
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

  const renderDisplay = useCallback(() => {
    const display = displayRef.current;
    const base = baseRef.current;
    if (!display || !base) return;
    const ctx = display.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, display.width, display.height);
    ctx.drawImage(base, 0, 0);
    if (draftRef.current) drawShape(ctx, draftRef.current);
  }, [drawShape]);

  // ---- load source image -------------------------------------------------
  useEffect(() => {
    setLoaded(false);
    shapesRef.current = [];
    draftRef.current = null;
    setShapeCount(0);

    const img = new Image();
    // same-origin seed SVGs -> canvas is NOT tainted, so toDataURL works.
    img.onload = () => {
      imgRef.current = img;
      const w = img.naturalWidth || 720;
      const h = img.naturalHeight || 480;
      for (const c of [displayRef.current, baseRef.current]) {
        if (c) { c.width = w; c.height = h; }
      }
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
      rebuildBase();
      renderDisplay();
      setLoaded(true);
    };
    img.onerror = () => setLoaded(false);
    img.src = imageUrl;

    return () => { img.onload = null; img.onerror = null; };
  }, [imageUrl, rebuildBase, renderDisplay]);

  // ---- pointer mapping ---------------------------------------------------
  const toImageSpace = useCallback((clientX: number, clientY: number): Point => {
    const canvas = displayRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(canvas.width, (clientX - rect.left) * sx)),
      y: Math.max(0, Math.min(canvas.height, (clientY - rect.top) * sy)),
    };
  }, []);

  // ---- pointer handlers --------------------------------------------------
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || submitted || !loaded) return;
    e.preventDefault();
    try {
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is best-effort; ignore if unavailable */
    }
    drawingRef.current = true;
    const p = toImageSpace(e.clientX, e.clientY);
    if (toolRef.current === 'rect') {
      // fill is refined live in onPointerMove once the rect has a size.
      draftRef.current = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, fill: BLACK };
    } else {
      const brush: Shape = { type: 'brush', points: [p], thickness: thicknessRef.current, fill: BLACK };
      brush.fill = computeFill(brush);
      draftRef.current = brush;
    }
    renderDisplay();
  }, [disabled, submitted, loaded, toImageSpace, renderDisplay, computeFill]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !draftRef.current) return;
    e.preventDefault();
    const p = toImageSpace(e.clientX, e.clientY);
    const draft = draftRef.current;
    if (draft.type === 'rect') {
      draft.w = p.x - draft.x;
      draft.h = p.y - draft.y;
      // refine the live preview color from the current border ring
      draft.fill = computeFill(draft);
    } else {
      const last = draft.points[draft.points.length - 1];
      // skip micro-moves to keep the point list lean
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1.5) draft.points.push(p);
    }
    renderDisplay();
  }, [toImageSpace, renderDisplay, computeFill]);

  const commitDraft = useCallback(() => {
    const draft = draftRef.current;
    drawingRef.current = false;
    if (!draft) return;
    // discard trivially-empty rectangles (a tap with the rect tool)
    const isEmptyRect = draft.type === 'rect' && Math.abs(draft.w) < 2 && Math.abs(draft.h) < 2;
    draftRef.current = null;
    if (isEmptyRect) { renderDisplay(); return; }
    // Authoritative fill from the ORIGINAL image for the final shape geometry;
    // stored on the shape so undo/redo + the offscreen bake stay consistent.
    draft.fill = computeFill(draft);
    shapesRef.current = [...shapesRef.current, draft];
    setShapeCount(shapesRef.current.length);
    // bake the new shape into the base cache (cheap: draw just this one)
    const base = baseRef.current;
    const ctx = base?.getContext('2d');
    if (ctx) drawShape(ctx, draft);
    renderDisplay();
  }, [drawShape, renderDisplay, computeFill]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    commitDraft();
  }, [commitDraft]);

  // ---- toolbar actions ---------------------------------------------------
  const undo = useCallback(() => {
    if (shapesRef.current.length === 0) return;
    shapesRef.current = shapesRef.current.slice(0, -1);
    setShapeCount(shapesRef.current.length);
    rebuildBase();
    renderDisplay();
  }, [rebuildBase, renderDisplay]);

  const reset = useCallback(() => {
    shapesRef.current = [];
    draftRef.current = null;
    setShapeCount(0);
    rebuildBase();
    renderDisplay();
  }, [rebuildBase, renderDisplay]);

  const handleSubmit = useCallback(() => {
    const base = baseRef.current;
    if (!base) return;
    // base already holds image + all committed shapes at natural resolution.
    const png = base.toDataURL('image/png');
    onSubmit(png);
  }, [onSubmit]);

  // Timer-driven auto-submit: fire once whenever flushToken changes to a truthy value.
  const lastFlush = useRef(0);
  useEffect(() => {
    if (!flushToken || flushToken === lastFlush.current) return;
    lastFlush.current = flushToken;
    if (loaded && !submitted) handleSubmit();
  }, [flushToken, loaded, submitted, handleSubmit]);

  const interactive = loaded && !disabled && !submitted;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <ToolButton active={tool === 'rect'} onClick={() => setTool('rect')} disabled={!interactive} label="▭ Box" />
          <ToolButton active={tool === 'brush'} onClick={() => setTool('brush')} disabled={!interactive} label="✎ Brush" />
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

        <button
          type="button"
          onClick={() => setBlend((b) => !b)}
          disabled={!interactive}
          title={blend ? 'Redactions blend with the background' : 'Redactions are solid black'}
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-40 ${
            blend
              ? 'bg-grief/20 border-grief/40 text-white'
              : 'bg-panel2 border-white/10 text-white/80 hover:bg-white/10'
          }`}
        >
          {blend ? '🎨 Blend' : '■ Black'}
        </button>

        <div className="flex-1" />

        <button onClick={undo} disabled={!interactive || shapeCount === 0} className="btn-secondary">↶ Undo</button>
        <button onClick={reset} disabled={!interactive || shapeCount === 0} className="btn-secondary">Reset</button>
      </div>

      {/* Canvas */}
      <div className="relative w-full flex justify-center rounded-xl overflow-hidden bg-panel2 ring-1 ring-white/10">
        <canvas
          ref={displayRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="max-w-full h-auto block"
          style={{ touchAction: 'none', cursor: interactive ? 'crosshair' : 'default', maxHeight: '62vh' }}
        />
        {/* offscreen committed-scene cache */}
        <canvas ref={baseRef} className="hidden" />
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">Loading source…</div>
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

      {/* Submit */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/50">{shapeCount} edit{shapeCount === 1 ? '' : 's'}</span>
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
      className={`px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
        active ? 'bg-grief text-white' : 'bg-panel2 text-white/80 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}
