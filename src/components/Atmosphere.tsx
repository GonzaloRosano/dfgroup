import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 2D orthographic dot-grid feather from public/logo.svg.
 * Regular grid cells → white stipple dots; scroll drives reveal, parallax, shear, tip ember.
 */

const LOGO_PATH =
  'M 105.500 12.572 C 101.650 16.136, 91.750 24.155, 83.500 30.392 C 59.486 48.547, 39.599 67.920, 31.913 80.644 C 26.345 89.862, 21.189 100.776, 18.516 109 C 15.715 117.620, 14.266 119.849, 6.897 126.878 C 3.104 130.495, 0 133.803, 0 134.228 C 0 136.216, 4.186 134.531, 11.500 129.600 C 15.900 126.633, 24.900 121.461, 31.500 118.107 C 38.100 114.753, 45.814 110.094, 48.641 107.754 C 69.115 90.814, 80.854 78.771, 89.339 66 C 91.349 62.975, 93.339 60.050, 93.763 59.500 C 95.049 57.828, 101.915 44.930, 105.474 37.500 C 110.421 27.174, 115.681 5.896, 113.250 6.046 C 112.838 6.072, 109.350 9.008, 105.500 12.572';

const VIEW_W = 122;
const VIEW_H = 135;
export const GRID_COLS = 96;
export const GRID_ROWS = 106;
const DOT_PX = 2.4;
const WHITE = new THREE.Color(0xe8e6e1);
const EMBER = new THREE.Color(0xc45a4a);
const DAMP = 5.5;

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
  const aspect = VIEW_H / VIEW_W;
  const padX = 0.06;
  const padY = 0.06;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = (row * GRID_COLS + col) * 4;
      if (data[idx + 3] < 128) continue;

      const nx = col / (GRID_COLS - 1);
      const ny = row / (GRID_ROWS - 1);
      const x = (nx - 0.5) * (1 - padX * 2);
      const y = -(ny - 0.5) * aspect * (1 - padY * 2);
      const tip = 1 - ny;

      dots.push({ x, y, tip, col: nx, row: ny });
    }
  }

  return dots;
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

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aTip', new THREE.BufferAttribute(tips, 1));
  geo.setAttribute('aCol', new THREE.BufferAttribute(cols, 1));
  geo.setAttribute('aRow', new THREE.BufferAttribute(rows, 1));
  return geo;
}

function sectionPresence(el: Element | null, vh: number) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const overlap = Math.min(r.bottom, vh * 0.88) - Math.max(r.top, vh * 0.12);
  return THREE.MathUtils.clamp(overlap / Math.max(r.height * 0.6, vh * 0.42), 0, 1);
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

  uniform float uTime;
  uniform float uMotion;
  uniform float uOffsetY;
  uniform float uShear;
  uniform float uWave;
  uniform float uReveal;
  uniform float uParallax;
  uniform float uInteract;

  varying float vTip;
  varying float vVisible;
  varying float vCol;

  void main() {
    vTip = aTip;
    vCol = aCol;

    float minTip = 1.0 - uReveal;
    vVisible = smoothstep(minTip - 0.04, minTip + 0.02, aTip);

    vec3 p = position;
    p.y += uOffsetY + uParallax;
    p.x += uShear * p.y;
    p.y += sin(uTime * 1.15 + aCol * 28.0 + aRow * 16.0) * uWave * uMotion;
    p.x += sin(uTime * 0.9 + aRow * 22.0) * uWave * uMotion * 0.35;
    p += vec3(uInteract * 0.012 * sin(uTime * 2.2 + aCol * 40.0), 0.0, 0.0);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = ${DOT_PX.toFixed(1)} * uPixelRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uWhite;
  uniform vec3 uEmber;
  uniform float uEmberMix;
  uniform float uAlpha;
  uniform float uInteract;

  varying float vTip;
  varying float vVisible;
  varying float vCol;

  void main() {
    if (vVisible < 0.02) discard;

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.46) discard;

    float tipAccent = smoothstep(0.78, 0.97, vTip) * uEmberMix;
    vec3 col = mix(uWhite, uEmber, tipAccent);
    col = mix(col, uWhite, uInteract * 0.08);

    float alpha = uAlpha * vVisible * (0.62 + uInteract * 0.12);
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
    mount.appendChild(renderer.domElement);

    const gridDots = buildLogoGrid();
    const geometry = buildGeometry(gridDots);

    const uniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uOffsetY: { value: 0 },
      uShear: { value: 0 },
      uWave: { value: 0 },
      uReveal: { value: reduceMotion ? 1 : 0.88 },
      uParallax: { value: 0 },
      uInteract: { value: 0 },
      uEmberMix: { value: 0.15 },
      uAlpha: { value: 0.78 },
      uWhite: { value: WHITE },
      uEmber: { value: EMBER },
      uPixelRatio: { value: 1 },
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
      inicio: { reveal: 0.88, offsetY: 0, shear: 0, wave: 0.008, ember: 0.12, alpha: 0.8, parallax: 0 },
      grupo: { reveal: 1, offsetY: -0.025, shear: 0, wave: 0.012, ember: 0.18, alpha: 0.82, parallax: -0.018 },
      lineas: { reveal: 1, offsetY: -0.05, shear: 0.09, wave: 0.022, ember: 0.22, alpha: 0.8, parallax: -0.04 },
      oficio: { reveal: 1, offsetY: -0.07, shear: 0.04, wave: 0.014, ember: 0.85, alpha: 0.78, parallax: -0.065 },
      contacto: { reveal: 1, offsetY: -0.1, shear: 0, wave: 0.006, ember: 0.35, alpha: 0.48, parallax: -0.09 },
    };

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;
    let interactTarget = 0;
    let interactCurrent = 0;

    const cur = { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };

    const onFeatherInteract = (e: Event) => {
      const detail = (e as CustomEvent<{ intensity?: number }>).detail;
      interactTarget = THREE.MathUtils.clamp(detail?.intensity ?? 0, 0, 1);
    };

    window.addEventListener('df:feather-interact', onFeatherInteract);

    const sampleSections = () => {
      const vh = window.innerHeight;
      const raw = {
        inicio: sectionPresence(sections.inicio, vh),
        grupo: sectionPresence(sections.grupo, vh),
        lineas: sectionPresence(sections.lineas, vh),
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

    const scrollProgress = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      return max > 0 ? window.scrollY / max : 0;
    };

    const fit = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;

      const aspect = w / h;
      const viewH = 1.18;
      const viewW = viewH * aspect;

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

      cur.inicio = THREE.MathUtils.damp(cur.inicio, beats.inicio, k, delta);
      cur.grupo = THREE.MathUtils.damp(cur.grupo, beats.grupo, k, delta);
      cur.lineas = THREE.MathUtils.damp(cur.lineas, beats.lineas, k, delta);
      cur.oficio = THREE.MathUtils.damp(cur.oficio, beats.oficio, k, delta);
      cur.contacto = THREE.MathUtils.damp(cur.contacto, beats.contacto, k, delta);

      const pose = blendPose(cur, poses);
      const progress = scrollProgress();

      interactCurrent = THREE.MathUtils.damp(interactCurrent, interactTarget, k, delta);

      uniforms.uReveal.value = reduceMotion ? 1 : pose.reveal;
      uniforms.uOffsetY.value = pose.offsetY;
      uniforms.uShear.value = pose.shear;
      uniforms.uWave.value = pose.wave;
      uniforms.uEmberMix.value = pose.ember + interactCurrent * 0.12;
      uniforms.uAlpha.value = pose.alpha;
      uniforms.uParallax.value = pose.parallax + (reduceMotion ? 0 : progress * -0.06);
      uniforms.uInteract.value = interactCurrent;

      if (!reduceMotion) uniforms.uTime.value = elapsed;

      renderer.render(scene, camera);
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      renderFrame(delta, clock.elapsedTime);
      frame = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      if (reduceMotion) renderFrame(0, 0);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    if (reduceMotion) {
      renderFrame(0, 0);
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('df:feather-interact', onFeatherInteract);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="atmosphere" aria-hidden="true" />;
}

export const LOGO_DOT_COUNT =
  typeof document === 'undefined' ? 0 : buildLogoGrid().length;
