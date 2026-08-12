/**
 * Programmatic checks for icon dot mapping (run: pnpm verify:icons).
 * Rasterizes SVGs via node-canvas loadImage (no Path2D required).
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const {
  ICON_SVGS,
  GRID_COLS,
  GRID_ROWS,
  PAD_X,
  PAD_Y,
  buildGridDotsFromFilled,
  shapeYSpread,
  shapeWithinFrustum,
  shapeBBox,
} = await import('../src/lib/svgDots.ts');
type SvgIconData = import('../src/lib/svgDots.ts').SvgIconData;

const VIEW_H = 1.55;
const VIEW_MARGIN = 0.10;
const CANVAS_ASPECT = 16 / 9;
const viewHalfH = (VIEW_H + VIEW_MARGIN * 2) * 0.5;
const viewHalfW = viewHalfH * CANVAS_ASPECT;

function parseSvgFile(filePath: string): SvgIconData {
  const svg = readFileSync(filePath, 'utf8');
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
  const fallback = { viewX: 0, viewY: 0, viewW: 96, viewH: 106 };
  let view = fallback;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      view = { viewX: parts[0], viewY: parts[1], viewW: parts[2], viewH: parts[3] };
    }
  }
  const fillRule = /fill-rule=["']nonzero["']/.test(svg) ? 'nonzero' : 'evenodd';
  return { paths: [], ...view, fillRule };
}

async function rasterizeSvgFile(
  filePath: string,
  icon: SvgIconData,
  cols = GRID_COLS,
  rows = GRID_ROWS,
): Promise<Uint8Array> {
  let svg = readFileSync(filePath, 'utf8');
  svg = svg.replace(/\bfill=["']none["']/g, 'fill="#00000000"');
  svg = svg.replace(/currentColor/g, '#ffffff');
  svg = svg.replace(/\bwidth=["'][^"']*["']/, `width="${icon.viewW}"`);
  if (!/\bwidth=/.test(svg)) {
    svg = svg.replace(/<svg\b/, `<svg width="${icon.viewW}"`);
  }
  svg = svg.replace(/\bheight=["'][^"']*["']/, `height="${icon.viewH}"`);
  if (!/\bheight=/.test(svg)) {
    svg = svg.replace(/<svg\b/, `<svg height="${icon.viewH}"`);
  }
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const img = await loadImage(dataUrl);

  const canvas = createCanvas(cols, rows);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, cols, rows);

  const innerW = cols * (1 - PAD_X * 2);
  const innerH = rows * (1 - PAD_Y * 2);
  const scale = Math.min(innerW / icon.viewW, innerH / icon.viewH);
  const drawW = icon.viewW * scale;
  const drawH = icon.viewH * scale;
  const tx = (cols - drawW) * 0.5;
  const ty = (rows - drawH) * 0.5;

  ctx.drawImage(img, tx, ty, drawW, drawH);

  const data = ctx.getImageData(0, 0, cols, rows).data;
  const raw = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      raw[row * cols + col] = data[idx + 3] >= 128 ? 1 : 0;
    }
  }
  return raw;
}

/** Feather logo grid via SVG rasterization (matches browser buildLogoGrid). */
async function buildLogoDots(): Promise<import('../src/lib/svgDots.ts').GridDot[]> {
  const logoSvgPath = join(root, 'public', 'logo.svg');
  const icon = parseSvgFile(logoSvgPath);
  const filled = await rasterizeSvgFile(logoSvgPath, icon);
  const aspect = icon.viewH / icon.viewW;
  return buildGridDotsFromFilled(filled, GRID_COLS, GRID_ROWS, aspect);
}

const dots = await buildLogoDots();
let failed = false;

console.log('Icon dot mapping verification (full icon grids)\n');

for (const [key, relPath] of Object.entries(ICON_SVGS)) {
  const filePath = join(root, 'public', relPath.replace(/^\//, ''));
  const icon = parseSvgFile(filePath);
  const filled = await rasterizeSvgFile(filePath, icon);
  const aspect = icon.viewH / icon.viewW;
  const iconDots = buildGridDotsFromFilled(filled, GRID_COLS, GRID_ROWS, aspect);
  const shape = new Float32Array(iconDots.length * 3);
  for (let i = 0; i < iconDots.length; i++) {
    shape[i * 3] = iconDots[i].x;
    shape[i * 3 + 1] = iconDots[i].y;
  }
  const ySpread = shapeYSpread(shape);
  const inFrustum = shapeWithinFrustum(shape, viewHalfW, viewHalfH, 0.1);
  const bbox = shapeBBox(shape);

  const yOk = key === 'hosting' ? ySpread > 0.2 : true;
  const ok = yOk && inFrustum;

  console.log(`${key} (${relPath})`);
  console.log(`  Dot count: ${iconDots.length}`);
  console.log(`  Y spread: ${ySpread.toFixed(3)} ${yOk ? 'OK' : 'FAIL (need > 0.2)'}`);
  console.log(`  BBox: x[${bbox?.minX.toFixed(3)}, ${bbox?.maxX.toFixed(3)}] y[${bbox?.minY.toFixed(3)}, ${bbox?.maxY.toFixed(3)}]`);
  console.log(`  Frustum (${viewHalfW.toFixed(2)}×${viewHalfH.toFixed(2)} @10%): ${inFrustum ? 'OK' : 'FAIL'}`);
  console.log(`  => ${ok ? 'PASS' : 'FAIL'}\n`);

  if (!ok) failed = true;
}

console.log(`Grid: ${GRID_COLS}×${GRID_ROWS}, feather dots: ${dots.length}`);

if (failed) {
  process.exit(1);
}

console.log('All checks passed.');
