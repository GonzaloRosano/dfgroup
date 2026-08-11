import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 2D orthographic dot-grid — each scroll section has a distinct shape + motion personality.
 */

const LOGO_PATH =
  'M 105.500 12.572 C 101.650 16.136, 91.750 24.155, 83.500 30.392 C 59.486 48.547, 39.599 67.920, 31.913 80.644 C 26.345 89.862, 21.189 100.776, 18.516 109 C 15.715 117.620, 14.266 119.849, 6.897 126.878 C 3.104 130.495, 0 133.803, 0 134.228 C 0 136.216, 4.186 134.531, 11.500 129.600 C 15.900 126.633, 24.900 121.461, 31.500 118.107 C 38.100 114.753, 45.814 110.094, 48.641 107.754 C 69.115 90.814, 80.854 78.771, 89.339 66 C 91.349 62.975, 93.339 60.050, 93.763 59.500 C 95.049 57.828, 101.915 44.930, 105.474 37.500 C 110.421 27.174, 115.681 5.896, 113.250 6.046 C 112.838 6.072, 109.350 9.008, 105.500 12.572';

const VIEW_W = 122;
const VIEW_H = 135;
export const GRID_COLS = 96;
export const GRID_ROWS = 106;
const ASPECT = VIEW_H / VIEW_W;
const DOT_PX = 2.4;
const WHITE = new THREE.Color(0xe8e6e1);
const EMBER = new THREE.Color(0xc45a4a);
const DAMP = 3.1;
const SECTION_DAMP = 2.4;
/** Shapes are centered in orthographic space; layout uses the right 50% viewport panel */
const SHAPE_OFFSET_X = 0;
const ICON_SCALE = 0.96;
const ICON_DILATE_PX = 2;

type GridDot = {
  x: number;
  y: number;
  tip: number;
  col: number;
  row: number;
};

function buildLogoGrid(): GridDot[] {
  const cw = GRID_COLS;
  const ch = GRID_ROWS;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, cw, ch);
  ctx.scale(cw / VIEW_W, ch / VIEW_H);
  ctx.fill(new Path2D(LOGO_PATH));

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const dots: GridDot[] = [];
  const padX = 0.06;
  const padY = 0.06;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = (row * GRID_COLS + col) * 4;
      if (data[idx + 3] < 128) continue;

      const nx = col / (GRID_COLS - 1);
      const ny = row / (GRID_ROWS - 1);
      const x = (nx - 0.5) * (1 - padX * 2) + SHAPE_OFFSET_X;
      const y = -(ny - 0.5) * ASPECT * (1 - padY * 2);
      const tip = 1 - ny;

      dots.push({ x, y, tip, col: nx, row: ny });
    }
  }

  return dots;
}

/** Filled disc — #grupo */
function buildShapeCircle(dots: GridDot[]): Float32Array {
  const out = new Float32Array(dots.length * 3);
  const n = dots.length;

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const angle = t * Math.PI * 2 - Math.PI * 0.5;
    const r = Math.sqrt(dots[i].row * 0.85 + 0.08) * 0.4;
    out[i * 3] = Math.cos(angle) * r + SHAPE_OFFSET_X;
    out[i * 3 + 1] = Math.sin(angle) * r * ASPECT;
    out[i * 3 + 2] = 0;
  }

  return out;
}

/** Sinusoidal wave band — #lineas */
function buildShapeWave(dots: GridDot[]): Float32Array {
  const out = new Float32Array(dots.length * 3);

  for (let i = 0; i < dots.length; i++) {
    const x = (dots[i].col - 0.5) * 1.05;
    const y = Math.sin(dots[i].col * Math.PI * 2.8 + dots[i].row * 1.2) * 0.3 * ASPECT;
    out[i * 3] = x + SHAPE_OFFSET_X;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = 0;
  }

  return out;
}

/** 2×2 four-cluster echo — blended into lineas via second target */
function buildShapeClusters(dots: GridDot[]): Float32Array {
  const out = new Float32Array(dots.length * 3);
  const centers = [
    [-0.26, 0.2 * ASPECT],
    [0.26, 0.2 * ASPECT],
    [-0.26, -0.2 * ASPECT],
    [0.26, -0.2 * ASPECT],
  ];

  for (let i = 0; i < dots.length; i++) {
    const cluster = i % 4;
    const [cx, cy] = centers[cluster];
    const jitter = (dots[i].col - 0.5) * 0.14;
    const jitterY = (dots[i].row - 0.5) * 0.12 * ASPECT;
    out[i * 3] = cx + jitter + SHAPE_OFFSET_X;
    out[i * 3 + 1] = cy + jitterY;
    out[i * 3 + 2] = 0;
  }

  return out;
}

/** Horizontal line + slight spread — #contacto */
function buildShapeLine(dots: GridDot[]): Float32Array {
  const out = new Float32Array(dots.length * 3);

  for (let i = 0; i < dots.length; i++) {
    out[i * 3] = (dots[i].col - 0.5) * 1.12 + SHAPE_OFFSET_X;
    out[i * 3 + 1] = (dots[i].row - 0.5) * 0.06 * ASPECT + 0.04;
    out[i * 3 + 2] = 0;
  }

  return out;
}

type IconDrawFn = (ctx: CanvasRenderingContext2D) => void;

function iconCellToOrtho(u: number, v: number, padX: number, padY: number) {
  return {
    x: (u - 0.5) * (1 - padX * 2) + SHAPE_OFFSET_X,
    y: -(v - 0.5) * ASPECT * (1 - padY * 2),
  };
}

/** Thicken rasterized icon strokes so thin lines survive the dot grid */
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

/** Assign feather dots to rasterized icon pixels so silhouettes read clearly */
function buildIconShape(dots: GridDot[], draw: IconDrawFn): Float32Array {
  const cw = GRID_COLS;
  const ch = GRID_ROWS;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Float32Array(dots.length * 3);

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.save();
  ctx.translate(cw * 0.5, ch * 0.5);
  const scale = Math.min(cw, ch) * ICON_SCALE;
  ctx.scale(scale, scale);
  ctx.lineWidth = 0.11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  ctx.restore();

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const raw = new Uint8Array(cw * ch);

  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      const idx = (row * cw + col) * 4;
      raw[row * cw + col] = data[idx + 3] > 96 ? 1 : 0;
    }
  }

  const filled = dilateFilled(raw, cw, ch, ICON_DILATE_PX);
  const padX = 0.06;
  const padY = 0.06;
  const targets: { u: number; v: number; x: number; y: number }[] = [];

  for (let row = 0; row < ch; row++) {
    for (let col = 0; col < cw; col++) {
      if (!filled[row * cw + col]) continue;
      const u = col / (cw - 1);
      const v = row / (ch - 1);
      const { x, y } = iconCellToOrtho(u, v, padX, padY);
      targets.push({ u, v, x, y });
    }
  }

  const out = new Float32Array(dots.length * 3);
  if (targets.length === 0) return out;

  targets.sort((a, b) => a.v - b.v || a.u - b.u);

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

function drawIconServer(ctx: CanvasRenderingContext2D) {
  const w = 0.64;
  const h = 0.13;
  const gap = 0.048;
  const left = -w / 2;

  for (let i = 0; i < 3; i++) {
    const y = -0.27 + i * (h + gap);
    ctx.fillRect(left, y, w, h);
    ctx.beginPath();
    ctx.arc(left + 0.09, y + h / 2, 0.034, 0, Math.PI * 2);
    ctx.fill();
    for (let v = 0; v < 4; v++) {
      ctx.fillRect(left + w - 0.24 + v * 0.04, y + 0.028, 0.024, h - 0.056);
    }
  }
}

function drawIconSeries(ctx: CanvasRenderingContext2D) {
  const fw = 0.17;
  const fh = 0.5;
  const gap = 0.034;
  const startX = -0.28;

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (fw + gap);
    ctx.fillRect(x, -fh / 2, fw, fh);
    ctx.clearRect(x + 0.022, -fh / 2 + 0.034, fw - 0.044, fh - 0.068);
    for (let hole = 0; hole < 4; hole++) {
      const hy = -0.16 + hole * 0.11;
      ctx.fillRect(x - 0.034, hy, 0.02, 0.048);
      ctx.fillRect(x + fw + 0.014, hy, 0.02, 0.048);
    }
  }

  ctx.beginPath();
  ctx.moveTo(-0.04, -0.11);
  ctx.lineTo(-0.04, 0.11);
  ctx.lineTo(0.14, 0);
  ctx.closePath();
  ctx.fill();
}

function drawIconBrush(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.rotate(-0.48);
  ctx.fillRect(-0.055, -0.42, 0.11, 0.54);
  ctx.fillRect(-0.07, 0.1, 0.14, 0.07);
  ctx.beginPath();
  ctx.moveTo(-0.17, 0.19);
  ctx.lineTo(0.17, 0.19);
  ctx.lineTo(0.12, 0.36);
  ctx.lineTo(-0.12, 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIconCode(ctx: CanvasRenderingContext2D) {
  const s = 0.36;

  ctx.beginPath();
  ctx.moveTo(0.1, -s);
  ctx.lineTo(-0.2, 0);
  ctx.lineTo(0.1, s);
  ctx.lineTo(0.0, s);
  ctx.lineTo(-0.3, 0);
  ctx.lineTo(0.0, -s);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-0.1, -s);
  ctx.lineTo(0.2, 0);
  ctx.lineTo(-0.1, s);
  ctx.lineTo(0.0, s);
  ctx.lineTo(0.3, 0);
  ctx.lineTo(0.0, -s);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.rotate(0.22);
  ctx.fillRect(-0.04, -0.24, 0.08, 0.48);
  ctx.restore();
}

function drawIconMic(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.ellipse(0, -0.12, 0.15, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-0.1, -0.24 + i * 0.08, 0.2, 0.028);
  }

  ctx.fillRect(-0.04, 0.1, 0.08, 0.14);

  ctx.lineWidth = 0.058;
  ctx.beginPath();
  ctx.arc(0, 0.2, 0.17, 0.12, Math.PI - 0.12);
  ctx.stroke();

  ctx.fillRect(-0.13, 0.32, 0.26, 0.05);
}

function buildGeometry(dots: GridDot[]) {
  const positions = new Float32Array(dots.length * 3);
  const tips = new Float32Array(dots.length);
  const cols = new Float32Array(dots.length);
  const rows = new Float32Array(dots.length);

  dots.forEach((dot, i) => {
    positions[i * 3] = dot.x;
    positions[i * 3 + 1] = dot.y;
    positions[i * 3 + 2] = 0;
    tips[i] = dot.tip;
    cols[i] = dot.col;
    rows[i] = dot.row;
  });

  const wave = buildShapeWave(dots);
  const clusters = buildShapeClusters(dots);
  const lineasBlend = new Float32Array(dots.length * 3);
  for (let i = 0; i < dots.length * 3; i++) {
    lineasBlend[i] = wave[i] * 0.55 + clusters[i] * 0.45;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aTip', new THREE.BufferAttribute(tips, 1));
  geo.setAttribute('aCol', new THREE.BufferAttribute(cols, 1));
  geo.setAttribute('aRow', new THREE.BufferAttribute(rows, 1));
  geo.setAttribute('aCircle', new THREE.BufferAttribute(buildShapeCircle(dots), 3));
  geo.setAttribute('aWave', new THREE.BufferAttribute(lineasBlend, 3));
  geo.setAttribute('aLine', new THREE.BufferAttribute(buildShapeLine(dots), 3));
  geo.setAttribute('aServer', new THREE.BufferAttribute(buildIconShape(dots, drawIconServer), 3));
  geo.setAttribute('aSeries', new THREE.BufferAttribute(buildIconShape(dots, drawIconSeries), 3));
  geo.setAttribute('aBrush', new THREE.BufferAttribute(buildIconShape(dots, drawIconBrush), 3));
  geo.setAttribute('aCode', new THREE.BufferAttribute(buildIconShape(dots, drawIconCode), 3));
  geo.setAttribute('aMic', new THREE.BufferAttribute(buildIconShape(dots, drawIconMic), 3));
  return geo;
}

function iconPanelWeight(panelIdx: number, progress: number) {
  const d = Math.abs(progress - panelIdx);
  return 1 - THREE.MathUtils.smoothstep(0.08, 1.05, d);
}

function sectionPresence(el: Element | null, vh: number, scrollTrack = false) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const bandTop = vh * 0.08;
  const bandBottom = vh * 0.92;
  const overlap = Math.min(r.bottom, bandBottom) - Math.max(r.top, bandTop);
  const denom = scrollTrack
    ? Math.max(vh * 0.68, 1)
    : Math.max(r.height * 0.42, vh * 0.48);
  const raw = THREE.MathUtils.clamp(overlap / denom, 0, 1);
  return raw * raw * (3 - 2 * raw);
}

function blendPose(weights: Record<string, number>, poses: Record<string, Record<string, number>>) {
  const out: Record<string, number> = {};
  const keys = Object.keys(Object.values(poses)[0] ?? {});
  for (const key of keys) {
    out[key] = 0;
    for (const [section, w] of Object.entries(weights)) {
      out[key] += (poses[section]?.[key] ?? 0) * w;
    }
  }
  return out;
}

const DOT_VERT = /* glsl */ `
  attribute float aTip;
  attribute float aCol;
  attribute float aRow;
  attribute vec3 aCircle;
  attribute vec3 aWave;
  attribute vec3 aLine;
  attribute vec3 aServer;
  attribute vec3 aSeries;
  attribute vec3 aBrush;
  attribute vec3 aCode;
  attribute vec3 aMic;

  uniform float uTime;
  uniform float uMotion;
  uniform float uShear;
  uniform float uWave;
  uniform float uReveal;
  uniform float uScatter;
  uniform float uGather;
  uniform float uStretchX;
  uniform float uDissolve;
  uniform float uPixelRatio;
  uniform float uTipPulse;
  uniform float uWInicio;
  uniform float uWGrupo;
  uniform float uWLineas;
  uniform float uWOficio;
  uniform float uWContacto;
  uniform float uLineasIconMix;
  uniform float uIconW0;
  uniform float uIconW1;
  uniform float uIconW2;
  uniform float uIconW3;
  uniform float uAtelierCode;
  uniform float uLineasFrac;
  uniform float uGrupoPulse;
  uniform float uLineasSnap;

  varying float vTip;
  varying float vVisible;
  varying float vCol;
  varying float vDissolve;
  varying float vFeatherMix;
  varying vec2 vWorldXY;

  void main() {
    vCol = aCol;
    vDissolve = uDissolve;
    vFeatherMix = uWInicio + uWOficio;

    float waveFront = uReveal + sin(uTime * 2.0 + aCol * 14.0) * uWave * 0.35;
    float minTip = 1.0 - waveFront;
    vVisible = smoothstep(minTip - 0.07, minTip + 0.03, aTip);
    vTip = aTip;

    vec3 atelierIcon = mix(aBrush, aCode, uAtelierCode);
    vec3 iconShape = aServer * uIconW0
                   + aSeries * uIconW1
                   + atelierIcon * uIconW2
                   + aMic * uIconW3;

    vec3 lineasShape = mix(aWave, iconShape, uLineasIconMix);

    vec3 p = position * (uWInicio + uWOficio)
           + aCircle * uWGrupo
           + lineasShape * uWLineas
           + aLine * uWContacto;

    p.x *= mix(1.0, uStretchX, 0.85);

    float seed = fract(aCol * 12.9898 + aRow * 78.233);
    vec2 radial = normalize(p.xy + vec2(0.0001));
    float ang = atan(p.y, p.x);
    float iconFocus = uLineasIconMix * clamp(uIconW0 + uIconW1 + uIconW2 + uIconW3, 0.0, 1.0);

    // --- #inicio: organic breathe sway ---
    vec2 inicioOff = vec2(
      sin(uTime * 0.62 + aCol * 11.0 + aRow * 5.0),
      cos(uTime * 0.48 + aRow * 13.0 + aCol * 4.0)
    ) * 0.018 * uWInicio * uMotion;

    // --- #grupo: orbital drift + pulsing radius ---
    float orbitPhase = uTime * 0.52 + seed * 6.28318 + ang * 0.4;
    float orbitAmp = 0.032 * (0.6 + 0.4 * sin(uTime * 1.3 + seed * 5.0));
    vec2 grupoOff = vec2(cos(orbitPhase), sin(orbitPhase)) * orbitAmp * uWGrupo * uMotion;
    p.xy *= mix(vec2(1.0), vec2(1.0 + uGrupoPulse * 0.08), uWGrupo);

    // --- #lineas: snap shear + panel-driven horizontal jitter ---
    float snapWave = sin(uTime * 4.2 + aRow * 24.0);
    vec2 lineasOff = vec2(
      snapWave * 0.014 + uLineasSnap * 0.022 * sin(uTime * 9.0 + aCol * 30.0),
      cos(uTime * 3.1 + aCol * 18.0) * 0.005
    ) * uWLineas * uMotion * mix(1.0, 0.12, iconFocus);
    p.x += uShear * p.y * uWLineas * mix(1.35, 0.25, iconFocus);

    // --- #oficio: warm ember tremble at quill tip ---
    float tipMask = smoothstep(0.7, 0.97, aTip);
    vec2 oficioOff = radial * sin(uTime * 6.2 + seed * 20.0) * 0.011 * tipMask * uWOficio * uMotion;

    // --- #contacto: outward scatter + dissolve drift ---
    vec2 contactOff = radial * (0.03 + seed * 0.05) * (0.7 + 0.3 * sin(uTime * 0.55 + seed * 10.0))
                    * uWContacto * uMotion;
    p.xy += radial * uDissolve * sin(uTime * 0.7 + seed * 14.0) * 0.06 * uWContacto;

    p.xy += inicioOff + grupoOff + lineasOff + oficioOff + contactOff;

    // Residual scatter/gather for section poses + contact blend
    p.xy += radial * uScatter * (0.55 + seed * 0.65);

    vec2 shaft = vec2(0.0, -0.14);
    p.xy = mix(p.xy, shaft + (p.xy - shaft) * 0.72, uGather);

    // Legacy wave only bleeds through non-grupo sections lightly
    float legacyWave = uWave * uMotion * (1.0 - uWGrupo * 0.85);
    p.x += sin(uTime * 1.6 + aRow * 20.0) * legacyWave * 0.012;
    p.y += cos(uTime * 1.3 + aCol * 26.0) * legacyWave * 0.008;

    vWorldXY = (modelMatrix * vec4(p, 1.0)).xy;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = ${DOT_PX.toFixed(1)} * uPixelRatio * (1.0 + uTipPulse * 0.2);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uWhite;
  uniform vec3 uEmber;
  uniform float uEmberMix;
  uniform float uAlpha;
  uniform float uTipPulse;
  uniform float uDissolve;
  uniform float uTime;
  uniform float uWOficio;
  uniform vec2 uMouse;
  uniform float uHoverStrength;
  uniform float uHoverRadius;

  varying float vTip;
  varying float vVisible;
  varying float vCol;
  varying float vDissolve;
  varying float vFeatherMix;
  varying vec2 vWorldXY;

  void main() {
    if (vVisible < 0.02) discard;

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.46) discard;

    float tipAccent = smoothstep(0.78, 0.97, vTip) * (uEmberMix + uTipPulse * 0.65) * vFeatherMix;
    float flicker = 1.0 + sin(uTime * 6.8 + vCol * 48.0) * 0.32 * uTipPulse * uWOficio;
    tipAccent *= flicker;
    vec3 col = mix(uWhite, uEmber, tipAccent);

    float hoverDist = length(vWorldXY - uMouse);
    float hoverTint = (1.0 - smoothstep(uHoverRadius * 0.28, uHoverRadius, hoverDist)) * uHoverStrength;
    col = mix(col, uEmber, hoverTint * 0.52);

    float alpha = uAlpha * vVisible * (0.65 + uTipPulse * 0.12);
    alpha *= 1.0 - vDissolve * 0.55;
    if (alpha < 0.03) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Atmosphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    camera.position.z = 1;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'default';
    mount.appendChild(canvas);

    const gridDots = buildLogoGrid();
    const geometry = buildGeometry(gridDots);

    const uniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uShear: { value: 0 },
      uWave: { value: 0 },
      uReveal: { value: reduceMotion ? 1 : 0.92 },
      uScatter: { value: 0 },
      uGather: { value: 0 },
      uStretchX: { value: 1 },
      uDissolve: { value: 0 },
      uEmberMix: { value: 0.15 },
      uAlpha: { value: 0.82 },
      uWhite: { value: WHITE },
      uEmber: { value: EMBER },
      uPixelRatio: { value: 1 },
      uTipPulse: { value: 0 },
      uWInicio: { value: 1 },
      uWGrupo: { value: 0 },
      uWLineas: { value: 0 },
      uWOficio: { value: 0 },
      uWContacto: { value: 0 },
      uLineasIconMix: { value: 0 },
      uIconW0: { value: 0 },
      uIconW1: { value: 0 },
      uIconW2: { value: 0 },
      uIconW3: { value: 0 },
      uAtelierCode: { value: 0 },
      uLineasFrac: { value: 0 },
      uGrupoPulse: { value: 0 },
      uLineasSnap: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uHoverStrength: { value: 0 },
      uHoverRadius: { value: 0.14 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const sections = {
      inicio: document.getElementById('inicio'),
      grupo: document.getElementById('grupo'),
      lineas: document.getElementById('lineas'),
      oficio: document.getElementById('oficio'),
      contacto: document.getElementById('contacto'),
    };

    const poses = {
      inicio: {
        scale: 1, breathe: 0.058, offsetX: 0, offsetY: 0,
        scatter: 0, gather: 0, stretchX: 1, shear: 0, wave: 0.006,
        ember: 0.12, alpha: 0.82, reveal: 0.92, dissolve: 0,
      },
      grupo: {
        scale: 1.04, breathe: 0, offsetX: 0, offsetY: 0,
        scatter: 0, gather: 0, stretchX: 1, shear: 0, wave: 0,
        ember: 0.08, alpha: 0.86, reveal: 1, dissolve: 0,
      },
      lineas: {
        scale: 1.05, breathe: 0, offsetX: 0, offsetY: 0,
        scatter: 0, gather: 0, stretchX: 1.06, shear: 0.14, wave: 0.008,
        ember: 0.1, alpha: 0.84, reveal: 1, dissolve: 0,
      },
      oficio: {
        scale: 0.97, breathe: 0, offsetX: 0, offsetY: 0,
        scatter: 0, gather: 0.035, stretchX: 1, shear: 0, wave: 0.004,
        ember: 0.92, alpha: 0.81, reveal: 1, dissolve: 0,
      },
      contacto: {
        scale: 0.86, breathe: 0, offsetX: 0, offsetY: 0.04,
        scatter: 0.035, gather: 0, stretchX: 1, shear: 0, wave: 0,
        ember: 0.12, alpha: 0.38, reveal: 1, dissolve: 0.78,
      },
    };

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;
    let viewW = 1;
    let viewH = 1.18;
    let hovering = false;
    let hoverStrength = 0;

    const setMouseFromEvent = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      uniforms.uMouse.value.set((nx - 0.5) * viewW, -(ny - 0.5) * viewH);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (reduceMotion) return;
      setMouseFromEvent(e);
    };

    const onPointerEnter = (e: PointerEvent) => {
      if (reduceMotion) return;
      hovering = true;
      setMouseFromEvent(e);
    };

    const onPointerLeave = () => {
      hovering = false;
    };

    if (!reduceMotion) {
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerenter', onPointerEnter);
      canvas.addEventListener('pointerleave', onPointerLeave);
    }

    const cur = { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };
    const sm = { scale: 1, offsetX: 0, offsetY: 0 };
    let lineasPanel = { index: 0, frac: 0, progress: 0, raw: 0 };
    let lineasIconMix = 0;
    let iconW = { w0: 1, w1: 0, w2: 0, w3: 0, atelierCode: 0 };
    let sectionTransition: { from: keyof typeof cur; to: keyof typeof cur; progress: number } | null = null;

    const onLineasPanel = (e: Event) => {
      const detail = (e as CustomEvent<{ index: number; frac: number; progress: number; raw: number }>).detail;
      if (detail) lineasPanel = detail;
      if (reduceMotion) renderFrame(0, clock.elapsedTime);
    };

    const onSectionTransition = (e: Event) => {
      const detail = (e as CustomEvent<{ from: string; to: string; progress: number } | null>).detail;
      if (!detail?.from || !detail?.to) {
        sectionTransition = null;
        return;
      }
      const from = detail.from as keyof typeof cur;
      const to = detail.to as keyof typeof cur;
      if (!(from in cur) || !(to in cur)) return;
      sectionTransition = { from, to, progress: detail.progress };
      if (reduceMotion) renderFrame(0, clock.elapsedTime);
    };

    window.addEventListener('df:lineas-panel', onLineasPanel);
    window.addEventListener('df:section-transition', onSectionTransition);

    const onReducedMotionScroll = () => {
      if (reduceMotion) renderFrame(0, clock.elapsedTime);
    };
    if (reduceMotion) {
      window.addEventListener('scroll', onReducedMotionScroll, { passive: true });
      window.addEventListener('resize', onReducedMotionScroll, { passive: true });
    }

    const sampleSections = () => {
      if (sectionTransition) {
        const t = sectionTransition.progress;
        const smooth = t * t * (3 - 2 * t);
        const beats = { inicio: 0, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };
        beats[sectionTransition.from] = 1 - smooth;
        beats[sectionTransition.to] = smooth;
        return beats;
      }

      const vh = window.innerHeight;
      const raw = {
        inicio: sectionPresence(sections.inicio, vh),
        grupo: sectionPresence(sections.grupo, vh),
        lineas: sectionPresence(sections.lineas, vh, true),
        oficio: sectionPresence(sections.oficio, vh),
        contacto: sectionPresence(sections.contacto, vh),
      };
      const sum = raw.inicio + raw.grupo + raw.lineas + raw.oficio + raw.contacto;
      if (sum < 0.001) return { ...raw, inicio: 1 };
      return {
        inicio: raw.inicio / sum,
        grupo: raw.grupo / sum,
        lineas: raw.lineas / sum,
        oficio: raw.oficio / sum,
        contacto: raw.contacto / sum,
      };
    };

    const fit = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;

      const aspect = w / h;
      viewH = 1.18;
      viewW = viewH * aspect;

      camera.left = -viewW * 0.5;
      camera.right = viewW * 0.5;
      camera.top = viewH * 0.5;
      camera.bottom = -viewH * 0.5;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h, false);
      const pr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pr);
      uniforms.uPixelRatio.value = pr;
    };

    const ro = new ResizeObserver(() => {
      fit();
      if (reduceMotion) renderFrame(0, 0);
    });
    ro.observe(mount);
    fit();

    const renderFrame = (delta: number, elapsed: number) => {
      const k = reduceMotion ? 0 : DAMP;
      const beats = sampleSections();

      cur.inicio = THREE.MathUtils.damp(cur.inicio, beats.inicio, SECTION_DAMP, delta);
      cur.grupo = THREE.MathUtils.damp(cur.grupo, beats.grupo, SECTION_DAMP, delta);
      cur.lineas = THREE.MathUtils.damp(cur.lineas, beats.lineas, SECTION_DAMP, delta);
      cur.oficio = THREE.MathUtils.damp(cur.oficio, beats.oficio, SECTION_DAMP, delta);
      cur.contacto = THREE.MathUtils.damp(cur.contacto, beats.contacto, SECTION_DAMP, delta);

      const pose = blendPose(cur, poses);

      const lineasScrollActive = lineasPanel.raw > 0.001;
      const iconTargetMix = lineasScrollActive || cur.lineas > 0.12 ? 1 : 0;
      lineasIconMix = THREE.MathUtils.damp(lineasIconMix, iconTargetMix, k * 1.65, delta);

      const p = lineasPanel.progress;
      const targetIconW = {
        w0: iconPanelWeight(0, p),
        w1: iconPanelWeight(1, p),
        w2: iconPanelWeight(2, p),
        w3: iconPanelWeight(3, p),
        atelierCode: THREE.MathUtils.smoothstep(2.45, 2.95, p),
      };

      iconW.w0 = THREE.MathUtils.damp(iconW.w0, targetIconW.w0, k * 1.65, delta);
      iconW.w1 = THREE.MathUtils.damp(iconW.w1, targetIconW.w1, k * 1.65, delta);
      iconW.w2 = THREE.MathUtils.damp(iconW.w2, targetIconW.w2, k * 1.65, delta);
      iconW.w3 = THREE.MathUtils.damp(iconW.w3, targetIconW.w3, k * 1.65, delta);
      iconW.atelierCode = THREE.MathUtils.damp(iconW.atelierCode, targetIconW.atelierCode, k * 1.8, delta);

      if (reduceMotion) {
        const inLineas = beats.lineas > 0.35 || lineasPanel.raw > 0.001;
        if (inLineas) {
          uniforms.uWInicio.value = 0;
          uniforms.uWGrupo.value = 0;
          uniforms.uWLineas.value = 1;
          uniforms.uWOficio.value = 0;
          uniforms.uWContacto.value = 0;
          uniforms.uLineasIconMix.value = 1;
          const idx = lineasPanel.index;
          uniforms.uIconW0.value = idx === 0 ? 1 : 0;
          uniforms.uIconW1.value = idx === 1 ? 1 : 0;
          uniforms.uIconW2.value = idx === 2 ? 1 : 0;
          uniforms.uIconW3.value = idx === 3 ? 1 : 0;
          uniforms.uAtelierCode.value = idx === 2 && lineasPanel.progress > 2.7 ? 1 : 0;
        } else {
          uniforms.uWInicio.value = 1;
          uniforms.uWGrupo.value = 0;
          uniforms.uWLineas.value = 0;
          uniforms.uWOficio.value = 0;
          uniforms.uWContacto.value = 0;
          uniforms.uLineasIconMix.value = 0;
          uniforms.uIconW0.value = 0;
          uniforms.uIconW1.value = 0;
          uniforms.uIconW2.value = 0;
          uniforms.uIconW3.value = 0;
          uniforms.uAtelierCode.value = 0;
        }
      } else {
        uniforms.uWInicio.value = cur.inicio;
        uniforms.uWGrupo.value = cur.grupo;
        uniforms.uWLineas.value = cur.lineas;
        uniforms.uWOficio.value = cur.oficio;
        uniforms.uWContacto.value = cur.contacto;
        uniforms.uLineasIconMix.value = lineasIconMix;
        uniforms.uIconW0.value = iconW.w0;
        uniforms.uIconW1.value = iconW.w1;
        uniforms.uIconW2.value = iconW.w2;
        uniforms.uIconW3.value = iconW.w3;
        uniforms.uAtelierCode.value = iconW.atelierCode;
      }

      const inicioLife = cur.inicio;
      const breatheScale = reduceMotion
        ? 1
        : 1 + Math.sin(elapsed * 0.75) * pose.breathe * inicioLife;

      sm.scale = THREE.MathUtils.damp(sm.scale, pose.scale * breatheScale, k, delta);
      sm.offsetX = THREE.MathUtils.damp(sm.offsetX, pose.offsetX, k, delta);
      sm.offsetY = THREE.MathUtils.damp(sm.offsetY, pose.offsetY, k, delta);

      points.scale.setScalar(sm.scale);
      points.position.set(sm.offsetX, sm.offsetY, 0);
      points.rotation.z = reduceMotion ? 0 : elapsed * 0.024 * cur.inicio;

      uniforms.uReveal.value = reduceMotion ? 1 : pose.reveal;
      uniforms.uShear.value = pose.shear;
      uniforms.uWave.value = pose.wave;
      uniforms.uScatter.value = pose.scatter;
      uniforms.uGather.value = pose.gather;
      uniforms.uStretchX.value = pose.stretchX;
      uniforms.uDissolve.value = pose.dissolve;
      uniforms.uEmberMix.value = pose.ember;
      uniforms.uAlpha.value = pose.alpha;
      uniforms.uTipPulse.value = reduceMotion
        ? 0
        : cur.oficio * (0.72 + Math.sin(elapsed * 3.1) * 0.28);
      uniforms.uGrupoPulse.value = reduceMotion ? 0 : Math.sin(elapsed * 1.35) * cur.grupo;
      uniforms.uLineasFrac.value = lineasPanel.frac * cur.lineas;
      uniforms.uLineasSnap.value = reduceMotion
        ? 0
        : cur.lineas * (0.12 + Math.abs(Math.sin(elapsed * 4.2 + lineasPanel.index)) * 0.28);

      if (!reduceMotion) uniforms.uTime.value = elapsed;

      const hoverTarget = hovering ? 1 : 0;
      hoverStrength = reduceMotion
        ? 0
        : THREE.MathUtils.damp(hoverStrength, hoverTarget, 7.5, delta);
      uniforms.uHoverStrength.value = hoverStrength;

      renderer.render(scene, camera);
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      renderFrame(delta, clock.elapsedTime);
      frame = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      renderFrame(0, 0);
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('df:lineas-panel', onLineasPanel);
      window.removeEventListener('df:section-transition', onSectionTransition);
      if (reduceMotion) {
        window.removeEventListener('scroll', onReducedMotionScroll);
        window.removeEventListener('resize', onReducedMotionScroll);
      }
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerenter', onPointerEnter);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (canvas.parentElement === mount) {
        mount.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="atmosphere"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    />
  );
}

export const LOGO_DOT_COUNT =
  typeof document === 'undefined' ? 0 : buildLogoGrid().length;
