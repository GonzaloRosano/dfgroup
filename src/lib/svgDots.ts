/** Shared SVG → canvas raster → orthographic dot targets (same grid as logo feather). */

export const GRID_COLS = 96;
export const GRID_ROWS = 106;

export type GridDot = {
  x: number;
  y: number;
  tip: number;
  col: number;
  row: number;
};

const LOGO_VIEW_W = 122;
const LOGO_VIEW_H = 135;
const LOGO_ASPECT = LOGO_VIEW_H / LOGO_VIEW_W;
export const ICON_VIEW_W = 96;
export const ICON_VIEW_H = 106;

const LOGO_PATH =
  'M 105.500 12.572 C 101.650 16.136, 91.750 24.155, 83.500 30.392 C 59.486 48.547, 39.599 67.920, 31.913 80.644 C 26.345 89.862, 21.189 100.776, 18.516 109 C 15.715 117.620, 14.266 119.849, 6.897 126.878 C 3.104 130.495, 0 133.803, 0 134.228 C 0 136.216, 4.186 134.531, 11.500 129.600 C 15.900 126.633, 24.900 121.461, 31.500 118.107 C 38.100 114.753, 45.814 110.094, 48.641 107.754 C 69.115 90.814, 80.854 78.771, 89.339 66 C 91.349 62.975, 93.339 60.050, 93.763 59.500 C 95.049 57.828, 101.915 44.930, 105.474 37.500 C 110.421 27.174, 115.681 5.896, 113.250 6.046 C 112.838 6.072, 109.350 9.008, 105.500 12.572';

const SHAPE_OFFSET_X = 0;
/** Uniform shrink for all SVG-sampled shapes (feather + line icons). */
export const SHAPE_SCALE = 0.78;
export const PAD_X = 0.1;
export const PAD_Y = 0.1;
/** Max Manhattan distance when mapping empty feather cells to icon pixels. */
const ICON_NEAREST_MANHATTAN = 3;
/** No dilation — filled icons are already dense; dilation clips edge pixels. */
const ICON_DILATE_PX = 0;

export const ICON_SVGS = {
  hosting: '/icons/server.svg',
  series: '/icons/series.svg',
  atelier: '/icons/paint.svg',
  voices: '/icons/microphone.svg',
} as const;

export type SvgIconData = {
  paths: string[];
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  fillRule: CanvasFillRule;
};

const EMPTY_ICON: SvgIconData = {
  paths: [],
  viewX: 0,
  viewY: 0,
  viewW: ICON_VIEW_W,
  viewH: ICON_VIEW_H,
  fillRule: 'evenodd',
};

function parseViewBox(svg: Element | null): Pick<SvgIconData, 'viewX' | 'viewY' | 'viewW' | 'viewH'> {
  const fallback = { viewX: 0, viewY: 0, viewW: ICON_VIEW_W, viewH: ICON_VIEW_H };
  const raw = svg?.getAttribute('viewBox');
  if (!raw) return fallback;

  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return fallback;
  }

  return { viewX: parts[0], viewY: parts[1], viewW: parts[2], viewH: parts[3] };
}

function parseFillRule(svg: Element | null): CanvasFillRule {
  const rootRule = svg?.getAttribute('fill-rule');
  if (rootRule === 'evenodd' || rootRule === 'nonzero') return rootRule;

  const pathRule = svg?.querySelector('path')?.getAttribute('fill-rule');
  if (pathRule === 'evenodd' || pathRule === 'nonzero') return pathRule;

  return 'evenodd';
}

function cellToOrtho(
  u: number,
  v: number,
  aspect: number,
  padX: number,
  padY: number,
) {
  return {
    x: ((u - 0.5) * (1 - padX * 2) + SHAPE_OFFSET_X) * SHAPE_SCALE,
    y: (-(v - 0.5) * aspect * (1 - padY * 2)) * SHAPE_SCALE,
  };
}

function dilateFilled(filled: Uint8Array, cw: number, ch: number, radius: number): Uint8Array {
  if (radius <= 0) return filled;

  const out = new Uint8Array(cw * ch);
  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      if (!filled[row * cw + col]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const c = col + dx;
          const g = row + dy;
          if (c < 0 || c >= cw || g < 0 || g >= ch) continue;
          out[g * cw + c] = 1;
        }
      }
    }
  }

  return out;
}

/** Axis-aligned bbox of filled pixels (for verification / debugging). */
export function filledPixelBBox(
  filled: Uint8Array,
  cols: number,
  rows: number,
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  let minCol = cols;
  let maxCol = -1;
  let minRow = rows;
  let maxRow = -1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!filled[row * cols + col]) continue;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
    }
  }

  if (maxCol < 0) return null;
  return { minCol, maxCol, minRow, maxRow };
}

/** Rasterize SVG path data onto the dot grid (same technique as logo.svg sampling). */
export function rasterizePaths(
  paths: string[],
  viewW: number,
  viewH: number,
  cols = GRID_COLS,
  rows = GRID_ROWS,
  dilate = 0,
  viewX = 0,
  viewY = 0,
  padX = PAD_X,
  padY = PAD_Y,
  fillRule: CanvasFillRule = 'evenodd',
): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array(cols * rows);

  ctx.clearRect(0, 0, cols, rows);

  const innerW = cols * (1 - padX * 2);
  const innerH = rows * (1 - padY * 2);
  const scale = Math.min(innerW / viewW, innerH / viewH);
  const drawW = viewW * scale;
  const drawH = viewH * scale;
  const tx = (cols - drawW) * 0.5;
  const ty = (rows - drawH) * 0.5;

  ctx.translate(tx, ty);
  ctx.scale(scale, scale);
  ctx.translate(-viewX, -viewY);
  ctx.fillStyle = '#fff';

  for (const d of paths) {
    try {
      ctx.fill(new Path2D(d), fillRule);
    } catch {
      // Skip invalid path data — feather grid still renders.
    }
  }

  const data = ctx.getImageData(0, 0, cols, rows).data;
  const raw = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      raw[row * cols + col] = data[idx + 3] >= 128 ? 1 : 0;
    }
  }

  return dilate > 0 ? dilateFilled(raw, cols, rows, dilate) : raw;
}

/** Shift shape positions so axis-aligned bounding-box center sits at origin (optical center). */
export function centerShapeBuffer(positions: Float32Array): void {
  const n = positions.length / 3;
  if (n === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  for (let i = 0; i < n; i++) {
    positions[i * 3] -= cx;
    positions[i * 3 + 1] -= cy;
  }
}

function nearestFilledManhattan(
  col: number,
  row: number,
  filled: Uint8Array,
  cols: number,
  rows: number,
  maxDist: number,
): { col: number; row: number } | null {
  let bestDist = maxDist + 1;
  let best: { col: number; row: number } | null = null;

  for (let dr = -maxDist; dr <= maxDist; dr++) {
    for (let dc = -maxDist; dc <= maxDist; dc++) {
      if (dc === 0 && dr === 0) continue;
      const manhattan = Math.abs(dc) + Math.abs(dr);
      if (manhattan > maxDist) continue;

      const c = col + dc;
      const g = row + dr;
      if (c < 0 || c >= cols || g < 0 || g >= rows) continue;
      if (!filled[g * cols + c]) continue;

      if (manhattan < bestDist) {
        bestDist = manhattan;
        best = { col: c, row: g };
      }
    }
  }

  return best;
}

/** Map each feather dot to icon ortho coords via direct grid-cell correspondence (logo-style). */
export function buildIconGrid(
  dots: GridDot[],
  filled: Uint8Array,
  cols: number,
  rows: number,
  aspect: number,
): Float32Array {
  const out = new Float32Array(dots.length * 3);

  for (let i = 0; i < dots.length; i++) {
    const col = Math.max(0, Math.min(cols - 1, Math.round(dots[i].col * (cols - 1))));
    const row = Math.max(0, Math.min(rows - 1, Math.round(dots[i].row * (rows - 1))));

    let targetCol = col;
    let targetRow = row;

    if (!filled[row * cols + col]) {
      const nearest = nearestFilledManhattan(
        col,
        row,
        filled,
        cols,
        rows,
        ICON_NEAREST_MANHATTAN,
      );
      if (!nearest) {
        out[i * 3] = dots[i].x;
        out[i * 3 + 1] = dots[i].y;
        continue;
      }
      targetCol = nearest.col;
      targetRow = nearest.row;
    }

    const u = targetCol / (cols - 1);
    const v = targetRow / (rows - 1);
    const { x, y } = cellToOrtho(u, v, aspect, PAD_X, PAD_Y);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
  }

  centerShapeBuffer(out);
  return out;
}

export type ShapeBBox = { minX: number; maxX: number; minY: number; maxY: number };

export function shapeBBox(positions: Float32Array): ShapeBBox | null {
  const n = positions.length / 3;
  if (n === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

export function shapeYSpread(positions: Float32Array): number {
  const bbox = shapeBBox(positions);
  return bbox ? bbox.maxY - bbox.minY : 0;
}

/** True when shape bbox fits inside ortho frustum with fractional margin on each side. */
export function shapeWithinFrustum(
  positions: Float32Array,
  viewHalfW: number,
  viewHalfH: number,
  marginFrac = 0.1,
): boolean {
  const bbox = shapeBBox(positions);
  if (!bbox) return false;

  const marginX = viewHalfW * marginFrac;
  const marginY = viewHalfH * marginFrac;

  return (
    bbox.minX >= -viewHalfW + marginX
    && bbox.maxX <= viewHalfW - marginX
    && bbox.minY >= -viewHalfH + marginY
    && bbox.maxY <= viewHalfH - marginY
  );
}

export function buildGridDotsFromFilled(
  filled: Uint8Array,
  cols: number,
  rows: number,
  aspect: number,
): GridDot[] {
  const dots: GridDot[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!filled[row * cols + col]) continue;

      const nx = col / (cols - 1);
      const ny = row / (rows - 1);
      const { x, y } = cellToOrtho(nx, ny, aspect, PAD_X, PAD_Y);
      const tip = 1 - ny;

      dots.push({ x, y, tip, col: nx, row: ny });
    }
  }

  if (dots.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const dot of dots) {
      if (dot.x < minX) minX = dot.x;
      if (dot.x > maxX) maxX = dot.x;
      if (dot.y < minY) minY = dot.y;
      if (dot.y > maxY) maxY = dot.y;
    }

    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;

    for (const dot of dots) {
      dot.x -= cx;
      dot.y -= cy;
    }
  }

  return dots;
}

export function buildLogoGrid(): GridDot[] {
  const filled = rasterizePaths([LOGO_PATH], LOGO_VIEW_W, LOGO_VIEW_H);
  return buildGridDotsFromFilled(filled, GRID_COLS, GRID_ROWS, LOGO_ASPECT);
}

export function buildIconShapeFromPaths(icon: SvgIconData, dots: GridDot[]): Float32Array {
  const filled = rasterizePaths(
    icon.paths,
    icon.viewW,
    icon.viewH,
    GRID_COLS,
    GRID_ROWS,
    ICON_DILATE_PX,
    icon.viewX,
    icon.viewY,
    PAD_X,
    PAD_Y,
    icon.fillRule,
  );
  const aspect = icon.viewH / icon.viewW;
  return buildIconGrid(dots, filled, GRID_COLS, GRID_ROWS, aspect);
}

/** Full icon silhouette dots (not constrained to feather mask). */
export function buildIconDotsFromPaths(icon: SvgIconData): GridDot[] {
  const filled = rasterizePaths(
    icon.paths,
    icon.viewW,
    icon.viewH,
    GRID_COLS,
    GRID_ROWS,
    ICON_DILATE_PX,
    icon.viewX,
    icon.viewY,
    PAD_X,
    PAD_Y,
    icon.fillRule,
  );
  const aspect = icon.viewH / icon.viewW;
  return buildGridDotsFromFilled(filled, GRID_COLS, GRID_ROWS, aspect);
}

export function iconDotsToPositions(dots: GridDot[]): Float32Array {
  const out = new Float32Array(dots.length * 3);
  for (let i = 0; i < dots.length; i++) {
    out[i * 3] = dots[i].x;
    out[i * 3 + 1] = dots[i].y;
    out[i * 3 + 2] = 0;
  }
  return out;
}

export async function fetchSvgPaths(url: string): Promise<SvgIconData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load SVG: ${url}`);

  const svg = await res.text();
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const paths: string[] = [];
  const { viewX, viewY, viewW, viewH } = parseViewBox(doc.documentElement);
  const fillRule = parseFillRule(doc.documentElement);

  doc.querySelectorAll('path').forEach((el) => {
    const d = el.getAttribute('d');
    if (d) paths.push(d);
  });

  if (paths.length === 0) {
    console.warn(`[svgDots] no paths parsed from SVG (check XML validity): ${url}`);
  }

  return { paths, viewX, viewY, viewW, viewH, fillRule };
}

export const EMPTY_ICON_PATHS = Object.fromEntries(
  Object.keys(ICON_SVGS).map((key) => [key, { ...EMPTY_ICON }]),
) as Record<keyof typeof ICON_SVGS, SvgIconData>;

/** Loads line icon SVG paths; failed icons resolve to empty data so the feather grid still renders. */
export async function loadIconPaths(): Promise<Record<keyof typeof ICON_SVGS, SvgIconData>> {
  const result = { ...EMPTY_ICON_PATHS };

  await Promise.all(
    Object.entries(ICON_SVGS).map(async ([key, url]) => {
      try {
        result[key as keyof typeof ICON_SVGS] = await fetchSvgPaths(url);
      } catch (err) {
        console.warn(`[svgDots] icon unavailable: ${url}`, err);
      }
    }),
  );

  return result;
}
