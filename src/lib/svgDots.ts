/** Shared SVG → canvas raster → orthographic dot targets (same grid as logo feather). */

export const GRID_COLS = 96;
export const GRID_ROWS = 106;

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
/** No dilation — filled icons are already dense; dilation clips edge pixels. */
const ICON_DILATE_PX = 0;

export const ICON_SVGS = {
  hosting: '/icons/server.svg',
  series: '/icons/series.svg',
  atelier: '/icons/paint.svg',
  voices: '/icons/microphone.svg',
} as const;

/** Contacto's page shape — a filled icon like the other sections, not a bare line. */
export const CONTACT_SVG = '/icons/contact.svg';

export const ICON_PANEL_KEYS = Object.keys(ICON_SVGS) as (keyof typeof ICON_SVGS)[];

/** Ortho bbox width when a lineas icon is fully visible. */
export const ICON_TARGET_WIDTH = 0.9;
/** Max ortho bbox height after width scaling; tall icons shrink uniformly. */
export const ICON_MAX_HEIGHT = 1.0;

export type SvgIconData = {
  paths: string[];
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  fillRule: CanvasFillRule;
};

export const EMPTY_ICON: SvgIconData = {
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

/** A cell survives only if every neighbor within radius is also filled. */
function erodeFilled(filled: Uint8Array, cw: number, ch: number, radius: number): Uint8Array {
  if (radius <= 0) return filled;

  const out = new Uint8Array(cw * ch);
  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      const idx = row * cw + col;
      if (!filled[idx]) continue;

      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const c = col + dx;
          const g = row + dy;
          if (c < 0 || c >= cw || g < 0 || g >= ch || !filled[g * cw + c]) {
            keep = false;
            break;
          }
        }
      }
      out[idx] = keep ? 1 : 0;
    }
  }

  return out;
}

/** Morphological opening (erode then dilate) — drops thin spurs/stray teeth
 *  along a silhouette's edge without shrinking the main body. */
function openFilled(filled: Uint8Array, cw: number, ch: number, radius: number): Uint8Array {
  if (radius <= 0) return filled;
  return dilateFilled(erodeFilled(filled, cw, ch, radius), cw, ch, radius);
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
  smooth = 0,
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

  const opened = smooth > 0 ? openFilled(raw, cols, rows, smooth) : raw;
  return dilate > 0 ? dilateFilled(opened, cols, rows, dilate) : opened;
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

/** Multi-source BFS: every cell maps to its nearest filled cell (packed index), or -1. */
function closestFilledMap(filled: Uint8Array, cols: number, rows: number): Int32Array {
  const nearest = new Int32Array(cols * rows);
  nearest.fill(-1);
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < filled.length; i++) {
    if (!filled[i]) continue;
    nearest[i] = i;
    queue[tail++] = i;
  }

  while (head < tail) {
    const i = queue[head++];
    const col = i % cols;
    const row = (i / cols) | 0;
    const next = nearest[i];

    if (col > 0 && nearest[i - 1] < 0) {
      nearest[i - 1] = next;
      queue[tail++] = i - 1;
    }
    if (col < cols - 1 && nearest[i + 1] < 0) {
      nearest[i + 1] = next;
      queue[tail++] = i + 1;
    }
    if (row > 0 && nearest[i - cols] < 0) {
      nearest[i - cols] = next;
      queue[tail++] = i - cols;
    }
    if (row < rows - 1 && nearest[i + cols] < 0) {
      nearest[i + cols] = next;
      queue[tail++] = i + cols;
    }
  }

  return nearest;
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

/**
 * Scale centered shape: width → targetWidth, then uniform shrink if height exceeds maxHeight.
 */
export function normalizeIconShapeBuffer(
  positions: Float32Array,
  targetWidth = ICON_TARGET_WIDTH,
  maxHeight = ICON_MAX_HEIGHT,
): void {
  const bbox = shapeBBox(positions);
  if (!bbox) return;

  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  if (width <= 1e-6 || height <= 1e-6) return;

  let scale = targetWidth / width;
  if (height * scale > maxHeight) {
    scale = maxHeight / height;
  }

  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3] *= scale;
    positions[i * 3 + 1] *= scale;
  }
}

export type LineasIconMorphData = {
  count: number;
  positions: Float32Array;
  iconPositions: [Float32Array, Float32Array, Float32Array, Float32Array];
  tips: Float32Array;
  cols: Float32Array;
  rows: Float32Array;
};

const EMPTY_MORPH: LineasIconMorphData = {
  count: 0,
  positions: new Float32Array(0),
  iconPositions: [
    new Float32Array(0),
    new Float32Array(0),
    new Float32Array(0),
    new Float32Array(0),
  ],
  tips: new Float32Array(0),
  cols: new Float32Array(0),
  rows: new Float32Array(0),
};

function rasterizeIconFilled(icon: SvgIconData): Uint8Array {
  return rasterizePaths(
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
}

function iconUnionCells(filledGrids: Uint8Array[]): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = row * GRID_COLS + col;
      let any = false;
      for (const filled of filledGrids) {
        if (filled[idx]) {
          any = true;
          break;
        }
      }
      if (any) cells.push({ col, row });
    }
  }

  return cells;
}

/** Ortho positions for a filled silhouette, aligned to shared union cells. */
function positionsForFilled(
  filled: Uint8Array,
  cells: { col: number; row: number }[],
  aspect: number,
): Float32Array {
  const out = new Float32Array(cells.length * 3);
  const nearest = closestFilledMap(filled, GRID_COLS, GRID_ROWS);

  for (let i = 0; i < cells.length; i++) {
    const { col, row } = cells[i];
    const idx = row * GRID_COLS + col;
    let target = filled[idx] ? idx : nearest[idx];
    if (target < 0) continue;

    const targetCol = target % GRID_COLS;
    const targetRow = (target / GRID_COLS) | 0;
    const u = targetCol / (GRID_COLS - 1);
    const v = targetRow / (GRID_ROWS - 1);
    const { x, y } = cellToOrtho(u, v, aspect, PAD_X, PAD_Y);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
  }

  centerShapeBuffer(out);
  return out;
}

/** Per-icon ortho positions aligned to shared grid cells (for GPU morph). */
function iconPositionsForUnion(
  icon: SvgIconData,
  filled: Uint8Array,
  cells: { col: number; row: number }[],
): Float32Array {
  return positionsForFilled(filled, cells, icon.viewH / icon.viewW);
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Regular polygon's boundary radius at a given angle (varies between the
 *  apothem and the circumradius as the angle sweeps past each vertex). */
function polygonRadiusAtAngle(angle: number, sides: number, circumradius: number): number {
  const segAngle = (Math.PI * 2) / sides;
  const a = (((angle % segAngle) + segAngle) % segAngle) - segAngle / 2;
  return (circumradius * Math.cos(segAngle / 2)) / Math.cos(a);
}

/**
 * A single *filled* hexagon — angular like the feather's straight edges,
 * reading as cells/nodes forming one whole rather than a soft circle.
 *
 * Same grid-quantized-fill style as the feather/icons instead of a
 * mathematical spiral: membership test (dist <= polygon boundary at that
 * angle) against the shared GRID_COLS x GRID_ROWS grid, so the dot density
 * and grid-snap character match the rest of the page shapes. Filled cells
 * are collected once, then the n union dots cycle through that list
 * (i % targets.length) with a small per-cycle jitter so repeats don't stack
 * exactly on top of each other. Also flags cells near the boundary so the
 * caller can brighten just the outermost dots.
 */
function buildGrupoFromCells(
  cells: { col: number; row: number }[],
  logoFilled: Uint8Array,
): {
  positions: Float32Array;
  edge: Float32Array;
} {
  const out = new Float32Array(cells.length * 3);
  const edgeOut = new Float32Array(cells.length);
  const n = cells.length || 1;
  const sides = 6;
  const circumradius = 0.42;

  const membership = (col: number, row: number, cols: number, rows: number) => {
    const u = col / (cols - 1);
    const v = row / (rows - 1);
    const x0 = (u - 0.5) * (1 - PAD_X * 2);
    const y0 = -(v - 0.5) * LOGO_ASPECT * (1 - PAD_Y * 2);
    const dist = Math.hypot(x0, y0);
    const boundary = polygonRadiusAtAngle(Math.atan2(y0, x0), sides, circumradius);
    return dist <= boundary ? dist > boundary * 0.97 : null;
  };

  // At the full 96x106 grid, the hexagon has *more* candidate cells than n
  // (the feather/icons never hit this — they're part of the union that
  // defines n, so they can't outnumber it). More slots than dots means full
  // coverage is mathematically impossible, which shows up as visible
  // gaps/holes instead of the feather's dense, seamless grid. Count cells at
  // full resolution first, then resample at whatever coarser resolution
  // keeps the candidate count comfortably under n (same circumradius, same
  // on-screen size after normalizeIconShapeBuffer — just fewer, wider-spaced
  // candidate cells, so there are enough dots to actually fill them).
  let fullResCount = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (membership(col, row, GRID_COLS, GRID_ROWS) !== null) fullResCount++;
    }
  }

  // A hash-based pick isn't perfectly uniform: with only ~1.5x more dots
  // than cells (the 0.65 this used to be), the odds any given cell never
  // gets hit across n draws is ~e^(-n/targets.length) — around 20% at that
  // ratio, matching the still-visible gaps. Lower ratio -> more oversampling
  // -> that miss probability drops sharply (~5% at ~3x oversampling).
  const desiredCount = n * 0.33;
  const scale = Math.min(1, Math.sqrt(desiredCount / Math.max(fullResCount, 1)));
  const hexCols = Math.max(8, Math.round(GRID_COLS * scale));
  const hexRows = Math.max(8, Math.round(GRID_ROWS * scale));

  const targets: { edge: number; x: number; y: number }[] = [];
  for (let row = 0; row < hexRows; row++) {
    for (let col = 0; col < hexCols; col++) {
      const edge = membership(col, row, hexCols, hexRows);
      if (edge === null) continue;
      const u = col / (hexCols - 1);
      const v = row / (hexRows - 1);
      const { x, y } = cellToOrtho(u, v, LOGO_ASPECT, PAD_X, PAD_Y);
      targets.push({ edge: edge ? 1 : 0, x, y });
    }
  }
  if (targets.length === 0) return { positions: out, edge: edgeOut };

  for (let i = 0; i < n; i++) {
    const { col, row } = cells[i];

    if (logoFilled[row * GRID_COLS + col]) {
      // This cell is part of the feather's own silhouette, so it's also a
      // dot that's *on screen* right before/after the inicio <-> grupo
      // morph. Send it to the nearest target *by real on-screen distance*
      // (not a hash, not a rescaled grid index) so that transition moves
      // each feather dot a short, coherent distance instead of teleporting
      // it to an unrelated slot.
      const homeU = col / (GRID_COLS - 1);
      const homeV = row / (GRID_ROWS - 1);
      const { x: hx, y: hy } = cellToOrtho(homeU, homeV, LOGO_ASPECT, PAD_X, PAD_Y);

      let best = targets[0];
      let bestDist = Infinity;
      for (const target of targets) {
        const dx = target.x - hx;
        const dy = target.y - hy;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = target;
        }
      }

      out[i * 3] = best.x;
      out[i * 3 + 1] = best.y;
      edgeOut[i] = best.edge;
    } else {
      // This cell only exists because some *line icon* silhouette needed
      // it — grupo never morphs directly with those, so there's no
      // transition to keep coherent here. Nearest-by-distance would still
      // apply (it doesn't know that), and because these icon-only cells
      // cluster tightly in their own small silhouette-shaped region, a
      // faithful distance match reproduces that recognizable icon outline
      // inside the hexagon instead of blending into it. A hash scatters
      // these across every target uniformly instead, so they read as fill,
      // not as a ghost of whichever icon they came from.
      const hash = Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1;
      const target = targets[Math.min(targets.length - 1, Math.floor(hash * targets.length))];
      out[i * 3] = target.x;
      out[i * 3 + 1] = target.y;
      edgeOut[i] = target.edge;
    }
  }

  centerShapeBuffer(out);
  return { positions: out, edge: edgeOut };
}

/** Shared dot set + four normalized position targets for lineas icon morph. */
export function buildLineasIconMorph(
  icons: Record<keyof typeof ICON_SVGS, SvgIconData>,
  targetWidth = ICON_TARGET_WIDTH,
  maxHeight = ICON_MAX_HEIGHT,
): LineasIconMorphData {
  const filledGrids = ICON_PANEL_KEYS.map((key) => rasterizeIconFilled(icons[key]));
  const cells = iconUnionCells(filledGrids);
  if (cells.length === 0) return EMPTY_MORPH;

  const iconPositions = ICON_PANEL_KEYS.map((key, idx) => {
    const positions = iconPositionsForUnion(icons[key], filledGrids[idx], cells);
    normalizeIconShapeBuffer(positions, targetWidth, maxHeight);
    return positions;
  }) as LineasIconMorphData['iconPositions'];

  const count = cells.length;
  const positions = iconPositions[0].slice();
  const tips = new Float32Array(count);
  const cols = new Float32Array(count);
  const rows = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const { col, row } = cells[i];
    cols[i] = col / (GRID_COLS - 1);
    rows[i] = row / (GRID_ROWS - 1);
    tips[i] = 1 - rows[i];
  }

  return { count, positions, iconPositions, tips, cols, rows };
}

export type PageMorphData = {
  count: number;
  inicio: Float32Array;
  grupo: Float32Array;
  grupoEdge: Float32Array;
  oficio: Float32Array;
  contacto: Float32Array;
  iconPositions: [Float32Array, Float32Array, Float32Array, Float32Array];
  tips: Float32Array;
  cols: Float32Array;
  rows: Float32Array;
};

const EMPTY_PAGE_MORPH: PageMorphData = {
  count: 0,
  inicio: new Float32Array(0),
  grupo: new Float32Array(0),
  grupoEdge: new Float32Array(0),
  oficio: new Float32Array(0),
  contacto: new Float32Array(0),
  iconPositions: [
    new Float32Array(0),
    new Float32Array(0),
    new Float32Array(0),
    new Float32Array(0),
  ],
  tips: new Float32Array(0),
  cols: new Float32Array(0),
  rows: new Float32Array(0),
};

function rasterizeLogoFilled(): Uint8Array {
  // smooth=1: the raw rasterization at grid resolution leaves thin stray
  // spurs off the blade's edge — an opening pass drops them, keeps the body.
  return rasterizePaths(
    [LOGO_PATH], LOGO_VIEW_W, LOGO_VIEW_H, GRID_COLS, GRID_ROWS, 0, 0, 0, PAD_X, PAD_Y, 'evenodd', 1,
  );
}

/**
 * Shared union of logo + line icons so one Points mesh can morph
 * inicio → grupo → lineas icons → oficio → contacto.
 */
export function buildPageMorph(
  icons: Record<keyof typeof ICON_SVGS, SvgIconData>,
  contactIcon: SvgIconData = EMPTY_ICON,
  targetWidth = ICON_TARGET_WIDTH,
  maxHeight = ICON_MAX_HEIGHT,
): PageMorphData {
  const logoFilled = rasterizeLogoFilled();
  const iconFilled = ICON_PANEL_KEYS.map((key) => rasterizeIconFilled(icons[key]));
  const contactFilled = rasterizeIconFilled(contactIcon);
  const cells = iconUnionCells([logoFilled, ...iconFilled, contactFilled]);
  if (cells.length === 0) return EMPTY_PAGE_MORPH;

  // Same width/height normalization as the lineas icons, so every page
  // shape shares one consistent footprint instead of each keeping its own
  // natural (very different) proportions.
  const inicio = positionsForFilled(logoFilled, cells, LOGO_ASPECT);
  normalizeIconShapeBuffer(inicio, targetWidth, maxHeight);
  const { positions: grupo, edge: grupoEdge } = buildGrupoFromCells(cells, logoFilled);
  normalizeIconShapeBuffer(grupo, targetWidth, maxHeight);
  const oficio = inicio.slice();
  const contacto = contactIcon.paths.length && contactFilled.indexOf(1) >= 0
    ? (() => {
        const positions = positionsForFilled(contactFilled, cells, contactIcon.viewH / contactIcon.viewW);
        normalizeIconShapeBuffer(positions, targetWidth, maxHeight);
        return positions;
      })()
    : inicio.slice();
  const iconPositions = ICON_PANEL_KEYS.map((key, idx) => {
    const icon = icons[key];
    if (!icon.paths.length || iconFilled[idx].indexOf(1) < 0) return inicio.slice();
    const positions = iconPositionsForUnion(icon, iconFilled[idx], cells);
    normalizeIconShapeBuffer(positions, targetWidth, maxHeight);
    return positions;
  }) as PageMorphData['iconPositions'];

  const count = cells.length;
  const tips = new Float32Array(count);
  const cols = new Float32Array(count);
  const rows = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const { col, row } = cells[i];
    cols[i] = col / (GRID_COLS - 1);
    rows[i] = row / (GRID_ROWS - 1);
    tips[i] = 1 - rows[i];
  }

  return { count, inicio, grupo, grupoEdge, oficio, contacto, iconPositions, tips, cols, rows };
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
