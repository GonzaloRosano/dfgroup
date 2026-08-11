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
const ICON_ASPECT = ICON_VIEW_H / ICON_VIEW_W;

const LOGO_PATH =
  'M 105.500 12.572 C 101.650 16.136, 91.750 24.155, 83.500 30.392 C 59.486 48.547, 39.599 67.920, 31.913 80.644 C 26.345 89.862, 21.189 100.776, 18.516 109 C 15.715 117.620, 14.266 119.849, 6.897 126.878 C 3.104 130.495, 0 133.803, 0 134.228 C 0 136.216, 4.186 134.531, 11.500 129.600 C 15.900 126.633, 24.900 121.461, 31.500 118.107 C 38.100 114.753, 45.814 110.094, 48.641 107.754 C 69.115 90.814, 80.854 78.771, 89.339 66 C 91.349 62.975, 93.339 60.050, 93.763 59.500 C 95.049 57.828, 101.915 44.930, 105.474 37.500 C 110.421 27.174, 115.681 5.896, 113.250 6.046 C 112.838 6.072, 109.350 9.008, 105.500 12.572';

const SHAPE_OFFSET_X = 0;
const PAD_X = 0.06;
const PAD_Y = 0.06;
const ICON_DILATE_PX = 2;

export const ICON_SVGS = {
  hosting: '/icons/hosting.svg',
  series: '/icons/series.svg',
  atelier: '/icons/atelier.svg',
  atelierCode: '/icons/atelier-code.svg',
  voices: '/icons/voices.svg',
} as const;

function cellToOrtho(
  u: number,
  v: number,
  aspect: number,
  padX: number,
  padY: number,
) {
  return {
    x: (u - 0.5) * (1 - padX * 2) + SHAPE_OFFSET_X,
    y: -(v - 0.5) * aspect * (1 - padY * 2),
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

/** Rasterize SVG path data onto the dot grid (same technique as logo.svg sampling). */
export function rasterizePaths(
  paths: string[],
  viewW: number,
  viewH: number,
  cols = GRID_COLS,
  rows = GRID_ROWS,
  dilate = 0,
): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array(cols * rows);

  ctx.clearRect(0, 0, cols, rows);
  ctx.scale(cols / viewW, rows / viewH);
  ctx.fillStyle = '#fff';

  for (const d of paths) {
    try {
      ctx.fill(new Path2D(d));
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

function centerTargetPoints(targets: { x: number; y: number }[]): void {
  if (targets.length === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const t of targets) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  for (const t of targets) {
    t.x -= cx;
    t.y -= cy;
  }
}

function filledToTargets(
  filled: Uint8Array,
  cols: number,
  rows: number,
  aspect: number,
) {
  const targets: { u: number; v: number; x: number; y: number }[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!filled[row * cols + col]) continue;
      const u = col / (cols - 1);
      const v = row / (rows - 1);
      const { x, y } = cellToOrtho(u, v, aspect, PAD_X, PAD_Y);
      targets.push({ u, v, x, y });
    }
  }

  targets.sort((a, b) => a.v - b.v || a.u - b.u);
  centerTargetPoints(targets);

  return targets;
}

/** Spatially sorted assignment — keeps dot count identical to feather grid. */
export function assignDotsToTargets(dots: GridDot[], targets: { x: number; y: number }[]): Float32Array {
  const out = new Float32Array(dots.length * 3);
  if (targets.length === 0) return out;

  const order = dots.map((_, i) => i);
  order.sort((a, b) => dots[a].row - dots[b].row || dots[a].col - dots[b].col);

  for (let j = 0; j < order.length; j++) {
    const i = order[j];
    const target = targets[j % targets.length];
    out[i * 3] = target.x;
    out[i * 3 + 1] = target.y;
    out[i * 3 + 2] = 0;
  }

  return out;
}

export function buildLogoGrid(): GridDot[] {
  const filled = rasterizePaths([LOGO_PATH], LOGO_VIEW_W, LOGO_VIEW_H);
  const dots: GridDot[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (!filled[row * GRID_COLS + col]) continue;

      const nx = col / (GRID_COLS - 1);
      const ny = row / (GRID_ROWS - 1);
      const { x, y } = cellToOrtho(nx, ny, LOGO_ASPECT, PAD_X, PAD_Y);
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

export function buildIconShapeFromPaths(paths: string[], dots: GridDot[]): Float32Array {
  const filled = rasterizePaths(paths, ICON_VIEW_W, ICON_VIEW_H, GRID_COLS, GRID_ROWS, ICON_DILATE_PX);
  const targets = filledToTargets(filled, GRID_COLS, GRID_ROWS, ICON_ASPECT);
  const out = assignDotsToTargets(dots, targets);
  centerShapeBuffer(out);
  return out;
}

export async function fetchSvgPaths(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load SVG: ${url}`);

  const svg = await res.text();
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const paths: string[] = [];

  doc.querySelectorAll('path').forEach((el) => {
    const d = el.getAttribute('d');
    if (d) paths.push(d);
  });

  if (paths.length === 0) {
    console.warn(`[svgDots] no paths parsed from SVG (check XML validity): ${url}`);
  }

  return paths;
}

export const EMPTY_ICON_PATHS = Object.fromEntries(
  Object.keys(ICON_SVGS).map((key) => [key, [] as string[]]),
) as Record<keyof typeof ICON_SVGS, string[]>;

/** Loads line icon SVG paths; failed icons resolve to [] so the feather grid still renders. */
export async function loadIconPaths(): Promise<Record<keyof typeof ICON_SVGS, string[]>> {
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
