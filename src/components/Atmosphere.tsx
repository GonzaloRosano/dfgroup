import { useEffect, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  MathUtils,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';
import {
  buildPageMorph,
  CONTACT_SVG,
  EMPTY_ICON_PATHS,
  fetchSvgPaths,
  loadIconPaths,
  type PageMorphData,
  GRID_COLS,
  GRID_ROWS,
} from '../lib/svgDots';

export { GRID_COLS, GRID_ROWS };

/**
 * Perspective point cloud — one mesh morphs across every page shape.
 * inicio feather → grupo circle → lineas icons → oficio feather → contacto line.
 * Idle: gentle 3D yaw/pitch like the original feather (not 2D Z spin, not tide).
 */

const VIEW_H = 1.0;
const VIEW_MARGIN = 0.10;
const CAM_FOV = 36;
const ICON_MORPH_DURATION = 0.5;
const ICON_MORPH_DURATION_REDUCED = 0.12;
const DOT_PX = 2.4;
const WHITE = new Color(0xe8e6e1);
const EMBER = new Color(0xc45a4a);
// Section/pose damping settle to ~95% in about 3/lambda seconds — derive
// both from ICON_MORPH_DURATION so every morph on the page (section shape
// swaps, pose blends, and the lineas icon crossfade) reads as the same speed.
const DAMP = 3 / ICON_MORPH_DURATION;
const SECTION_DAMP = 3 / ICON_MORPH_DURATION;
const LINEAS_INDEX_MAX = 3;
/** Original feather used PerspectiveCamera + rotation.y; oscillate instead of spin. */
const YAW_AMP = MathUtils.degToRad(18);
const PITCH_AMP = MathUtils.degToRad(7);
const ROCK_PERIOD = 8;

function buildPageGeometry(morph: PageMorphData) {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(morph.inicio.slice(), 3));
  geo.setAttribute('aInicio', new BufferAttribute(morph.inicio, 3));
  geo.setAttribute('aGrupo', new BufferAttribute(morph.grupo, 3));
  geo.setAttribute('aGrupoEdge', new BufferAttribute(morph.grupoEdge, 1));
  geo.setAttribute('aOficio', new BufferAttribute(morph.oficio, 3));
  geo.setAttribute('aContacto', new BufferAttribute(morph.contacto, 3));
  geo.setAttribute('aIcon0', new BufferAttribute(morph.iconPositions[0], 3));
  geo.setAttribute('aIcon1', new BufferAttribute(morph.iconPositions[1], 3));
  geo.setAttribute('aIcon2', new BufferAttribute(morph.iconPositions[2], 3));
  geo.setAttribute('aIcon3', new BufferAttribute(morph.iconPositions[3], 3));
  geo.setAttribute('aTip', new BufferAttribute(morph.tips, 1));
  geo.setAttribute('aCol', new BufferAttribute(morph.cols, 1));
  geo.setAttribute('aRow', new BufferAttribute(morph.rows, 1));
  return geo;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function sectionPresence(el: Element | null, vh: number) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const bandTop = vh * 0.08;
  const bandBottom = vh * 0.92;
  const overlap = Math.min(r.bottom, bandBottom) - Math.max(r.top, bandTop);
  const denom = Math.max(r.height * 0.42, vh * 0.48);
  const raw = MathUtils.clamp(overlap / denom, 0, 1);
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

function readLineasIndex(root: Element | null) {
  const raw = root?.getAttribute('data-lines-index');
  const n = raw == null || raw === '' ? 0 : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return MathUtils.clamp(Math.round(n), 0, LINEAS_INDEX_MAX);
}

/**
 * Page shape chain: inicio 0 → grupo 1 → icons 2–5 → oficio 6 → contacto 7.
 * iconIdx is the *settled* icon (0-3) — only used to pick which icon bucket
 * shows while lineas fades in/out. Icon-to-icon swaps while already inside
 * lineas bypass this entirely (see the direct uFrom/uTo override in
 * renderFrame) since a linear pos chain can't represent wrap-around
 * (voices -> hosting) without sweeping through the buckets in between.
 */
function pageShapePair(
  w: { inicio: number; grupo: number; lineas: number; oficio: number; contacto: number },
  iconIdx: number,
) {
  const sum = w.inicio + w.grupo + w.lineas + w.oficio + w.contacto;
  const n = sum < 1e-4
    ? { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 }
    : {
        inicio: w.inicio / sum,
        grupo: w.grupo / sum,
        lineas: w.lineas / sum,
        oficio: w.oficio / sum,
        contacto: w.contacto / sum,
      };

  const pos = n.grupo * 1 + n.lineas * (2 + iconIdx) + n.oficio * 6 + n.contacto * 7;
  const from = MathUtils.clamp(Math.floor(pos + 1e-6), 0, 7);
  const t = MathUtils.clamp(pos - from, 0, 1);
  const to = Math.min(from + (t > 0.0001 ? 1 : 0), 7);
  return { from, to, t: from === to ? 0 : t };
}

const DOT_VERT = /* glsl */ `
  attribute float aTip;
  attribute float aCol;
  attribute float aRow;
  attribute vec3 aInicio;
  attribute vec3 aGrupo;
  attribute float aGrupoEdge;
  attribute vec3 aOficio;
  attribute vec3 aContacto;
  attribute vec3 aIcon0;
  attribute vec3 aIcon1;
  attribute vec3 aIcon2;
  attribute vec3 aIcon3;

  uniform float uTime;
  uniform float uMotion;
  uniform float uReveal;
  uniform float uScatter;
  uniform float uGather;
  uniform float uDissolve;
  uniform float uPixelRatio;
  uniform float uTipPulse;
  uniform float uWInicio;
  uniform float uWGrupo;
  uniform float uWLineas;
  uniform float uWOficio;
  uniform float uWContacto;
  uniform float uIconMorphT;
  uniform float uFrom;
  uniform float uTo;
  uniform float uShapeT;

  varying float vTip;
  varying float vVisible;
  varying float vCol;
  varying float vDissolve;
  varying float vFeatherMix;
  varying float vMorphDip;
  varying float vGrupoEdgeGlow;
  varying vec2 vWorldXY;

  void main() {
    vCol = aCol;
    vDissolve = uDissolve;
    vFeatherMix = uWInicio + uWOficio;
    vGrupoEdgeGlow = aGrupoEdge * uWGrupo;

    float minTip = 1.0 - uReveal;
    vVisible = smoothstep(minTip - 0.07, minTip + 0.03, aTip);
    vTip = aTip;

    // Same "morph" treatment everywhere: the lineas icon-to-icon crossfade
    // pulses on uIconMorphT; every other section-to-section shape swap now
    // pulses the same way straight off uShapeT, which is already 0 at rest
    // and peaks mid-transition — no separate active/inactive flag needed.
    float iconMorphActive = step(0.001, uIconMorphT) * (1.0 - step(0.999, uIconMorphT));
    float iconMorphPulse = sin(uIconMorphT * 3.14159265) * iconMorphActive * uWLineas;
    float shapeMorphPulse = sin(clamp(uShapeT, 0.0, 1.0) * 3.14159265);
    float morphPulse = max(iconMorphPulse, shapeMorphPulse);
    vMorphDip = 1.0 - 0.12 * morphPulse;

    vec3 s0 = aInicio;
    s0 = mix(s0, aGrupo, step(0.5, uFrom));
    s0 = mix(s0, aIcon0, step(1.5, uFrom));
    s0 = mix(s0, aIcon1, step(2.5, uFrom));
    s0 = mix(s0, aIcon2, step(3.5, uFrom));
    s0 = mix(s0, aIcon3, step(4.5, uFrom));
    s0 = mix(s0, aOficio, step(5.5, uFrom));
    s0 = mix(s0, aContacto, step(6.5, uFrom));

    vec3 s1 = aInicio;
    s1 = mix(s1, aGrupo, step(0.5, uTo));
    s1 = mix(s1, aIcon0, step(1.5, uTo));
    s1 = mix(s1, aIcon1, step(2.5, uTo));
    s1 = mix(s1, aIcon2, step(3.5, uTo));
    s1 = mix(s1, aIcon3, step(4.5, uTo));
    s1 = mix(s1, aOficio, step(5.5, uTo));
    s1 = mix(s1, aContacto, step(6.5, uTo));

    vec3 p = mix(s0, s1, clamp(uShapeT, 0.0, 1.0));

    // Seeded from the dot's resolved position, not its raw grid cell: the
    // shared-union mapping snaps "borrowed" dots (from icon shapes with no
    // matching cell in this silhouette) onto their nearest edge point, so
    // many dots can land exactly coincident here. A seed from aCol/aRow
    // would give each of those piled-up dots a different phase and fan
    // them out into a visible burst; seeding from p keeps coincident dots
    // moving in lockstep instead.
    float seed = fract(sin(p.x * 78.233 + p.y * 12.9898) * 43758.5453);
    vec2 radial = normalize(p.xy + vec2(0.0001));

    // Icon-to-icon crossfade: puff outward + lift toward camera at the
    // midpoint instead of a flat straight-line lerp, so the swap reads as depth.
    p.xy += radial * morphPulse * 0.045;
    p.z += morphPulse * 0.16;

    float tipMask = smoothstep(0.7, 0.97, aTip);
    vec2 oficioOff = radial * sin(uTime * 6.2 + seed * 20.0) * 0.011 * tipMask * uWOficio * uMotion;
    p.xy += oficioOff;
    p.xy += radial * uScatter * (0.55 + seed * 0.65);

    vec2 shaft = vec2(0.0, -0.14);
    p.xy = mix(p.xy, shaft + (p.xy - shaft) * 0.72, uGather);

    vWorldXY = (modelMatrix * vec4(p, 1.0)).xy;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = ${DOT_PX.toFixed(1)} * uPixelRatio * (1.0 + uTipPulse * 0.2) * (1.0 + morphPulse * 0.4);
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
  varying float vMorphDip;
  varying float vGrupoEdgeGlow;
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
    // Only the outermost grupo hexagon dots get a brighter white edge.
    col = mix(col, vec3(1.0), vGrupoEdgeGlow * 0.55);

    float hoverDist = length(vWorldXY - uMouse);
    float hoverTint = (1.0 - smoothstep(uHoverRadius * 0.28, uHoverRadius, hoverDist)) * uHoverStrength;
    col = mix(col, uEmber, hoverTint * 0.52);

    float alpha = uAlpha * vVisible * vMorphDip * (0.65 + uTipPulse * 0.12);
    alpha *= 1.0 - vDissolve * 0.55;
    alpha *= 1.0 + vGrupoEdgeGlow * 0.25;
    if (alpha < 0.03) discard;

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Atmosphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let teardown: (() => void) | undefined;

    try {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let renderer: WebGLRenderer;
      try {
        renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      } catch (err) {
        console.error('[Atmosphere] WebGL unavailable', err);
        return () => {};
      }

      const scene = new Scene();
      const camera = new PerspectiveCamera(CAM_FOV, 1, 0.1, 40);
      camera.position.set(0, 0, 2);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.style.pointerEvents = 'auto';
      canvas.style.cursor = 'default';
      while (mount.firstChild) mount.removeChild(mount.firstChild);
      mount.appendChild(canvas);

      let pageMorph = buildPageMorph(EMPTY_ICON_PATHS);
      if (pageMorph.count === 0) {
        console.warn('[Atmosphere] page morph grid is empty — check Path2D / canvas support');
        renderer.dispose();
        mount.removeChild(canvas);
        return () => {};
      }

      let geometry = buildPageGeometry(pageMorph);

      const uniforms = {
        uTime: { value: 0 },
        uMotion: { value: reduceMotion ? 0 : 1 },
        uReveal: { value: reduceMotion ? 1 : 0.92 },
        uScatter: { value: 0 },
        uGather: { value: 0 },
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
        uIconMorphT: { value: 1 },
        uFrom: { value: 0 },
        uTo: { value: 0 },
        uShapeT: { value: 0 },
        uMouse: { value: new Vector2(0, 0) },
        uHoverStrength: { value: 0 },
        uHoverRadius: { value: 0.14 },
      };

      const material = new ShaderMaterial({
        uniforms,
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: NormalBlending,
      });

      const points = new Points(geometry, material);
      scene.add(points);

      const sections = {
        inicio: document.getElementById('inicio'),
        grupo: document.getElementById('grupo'),
        lineas: document.getElementById('lineas'),
        oficio: document.getElementById('oficio'),
        contacto: document.getElementById('contacto'),
      };

      // Same scale everywhere — inicio/grupo/oficio/contacto now size like lineas.
      const SHAPE_SCALE_UNIFORM = 0.8;
      const poses = {
        inicio: {
          scale: SHAPE_SCALE_UNIFORM, offsetX: 0, offsetY: 0, breathe: 0.055,
          scatter: 0, gather: 0, ember: 0.12, alpha: 0.82, reveal: 0.92, dissolve: 0,
        },
        grupo: {
          scale: SHAPE_SCALE_UNIFORM, offsetX: 0, offsetY: 0, breathe: 0.045,
          scatter: 0, gather: 0, ember: 0.08, alpha: 0.86, reveal: 1, dissolve: 0,
        },
        lineas: {
          scale: SHAPE_SCALE_UNIFORM, offsetX: 0, offsetY: 0,
          scatter: 0, gather: 0, ember: 0.1, alpha: 0.84, reveal: 1, dissolve: 0,
        },
        oficio: {
          scale: SHAPE_SCALE_UNIFORM, offsetX: 0, offsetY: 0,
          scatter: 0, gather: 0.035, ember: 0.92, alpha: 0.81, reveal: 1, dissolve: 0,
        },
        contacto: {
          scale: SHAPE_SCALE_UNIFORM, offsetX: 0, offsetY: 0.04,
          scatter: 0, gather: 0, ember: 0.12, alpha: 0.82, reveal: 1, dissolve: 0,
        },
      };

      const clock = new Clock();
      let frame = 0;
      let viewW = 1;
      let viewH = VIEW_H;
      let hovering = false;
      let hoverStrength = 0;
      const desktopMq = window.matchMedia('(min-width: 960px)');
      let isDesktop = desktopMq.matches;

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
      let settledIconIndex = readLineasIndex(sections.lineas);
      let panelIconMorph = { active: false, from: 0, to: 0, t: 0 };

      const requestIconMorph = (nextIndex: number) => {
        const idx = MathUtils.clamp(nextIndex, 0, LINEAS_INDEX_MAX);
        if (idx === settledIconIndex && !panelIconMorph.active) return;

        if (reduceMotion) {
          settledIconIndex = idx;
          panelIconMorph.active = false;
          panelIconMorph.t = 1;
          iconW = panelWeightsOneHot(idx);
          return;
        }

        if (!panelIconMorph.active) {
          panelIconMorph = { active: true, from: settledIconIndex, to: idx, t: 0 };
        } else if (panelIconMorph.to !== idx) {
          settledIconIndex = panelIconMorph.to;
          panelIconMorph.from = panelIconMorph.to;
          panelIconMorph.to = idx;
          panelIconMorph.t = 0;
        }
      };

      const syncLineasIndex = () => {
        requestIconMorph(readLineasIndex(sections.lineas));
      };

      const onDesktopChange = (e: MediaQueryListEvent) => {
        isDesktop = e.matches;
      };
      desktopMq.addEventListener('change', onDesktopChange);

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

      const fit = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (!w || !h) return false;

        const canvasAspect = w / h;
        viewH = VIEW_H + VIEW_MARGIN * 2;
        viewW = viewH * canvasAspect;

        camera.aspect = canvasAspect;
        camera.fov = CAM_FOV;
        camera.near = 0.1;
        camera.far = 40;
        const dist = (viewH * 0.5) / Math.tan(MathUtils.degToRad(CAM_FOV * 0.5));
        camera.position.set(0, 0, dist);
        camera.updateProjectionMatrix();

        renderer.setSize(w, h, false);
        const pr = Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(pr);
        uniforms.uPixelRatio.value = pr;
        return true;
      };

      const renderFrame = (delta: number, elapsed: number) => {
        syncLineasIndex();

        const k = reduceMotion ? 0 : DAMP;
        const beats = sampleSections();

        cur.inicio = MathUtils.damp(cur.inicio, beats.inicio, SECTION_DAMP, delta);
        cur.grupo = MathUtils.damp(cur.grupo, beats.grupo, SECTION_DAMP, delta);
        cur.lineas = MathUtils.damp(cur.lineas, beats.lineas, SECTION_DAMP, delta);
        cur.oficio = MathUtils.damp(cur.oficio, beats.oficio, SECTION_DAMP, delta);
        cur.contacto = MathUtils.damp(cur.contacto, beats.contacto, SECTION_DAMP, delta);

        const pose = blendPose(cur, poses);

        let iconMorphT = 1;
        let directIconSwap: { from: number; to: number; t: number } | null = null;

        if (panelIconMorph.active) {
          const morphDuration = reduceMotion ? ICON_MORPH_DURATION_REDUCED : ICON_MORPH_DURATION;
          panelIconMorph.t = Math.min(1, panelIconMorph.t + delta / morphDuration);
          const eased = reduceMotion ? panelIconMorph.t : easeInOutCubic(panelIconMorph.t);
          iconMorphT = panelIconMorph.t;
          directIconSwap = { from: panelIconMorph.from, to: panelIconMorph.to, t: eased };
          if (panelIconMorph.t >= 1) {
            settledIconIndex = panelIconMorph.to;
            panelIconMorph.active = false;
            iconMorphT = 1;
            directIconSwap = null;
          }
        }
        uniforms.uIconMorphT.value = iconMorphT;

        const sectionW = reduceMotion ? beats : cur;
        uniforms.uWInicio.value = sectionW.inicio;
        uniforms.uWGrupo.value = sectionW.grupo;
        uniforms.uWLineas.value = sectionW.lineas;
        uniforms.uWOficio.value = sectionW.oficio;
        uniforms.uWContacto.value = sectionW.contacto;

        if (directIconSwap) {
          // Direct bucket-to-bucket crossfade between exactly the two icons
          // involved — every icon-to-icon transition (including the
          // voices -> hosting wrap) behaves identically: a clean two-shape
          // swap, never sweeping through unrelated icons in between.
          uniforms.uFrom.value = 2 + directIconSwap.from;
          uniforms.uTo.value = 2 + directIconSwap.to;
          uniforms.uShapeT.value = directIconSwap.t;
        } else {
          const pair = pageShapePair(sectionW, settledIconIndex);
          uniforms.uFrom.value = pair.from;
          uniforms.uTo.value = pair.to;
          uniforms.uShapeT.value = pair.t;
        }

        const breatheScale = reduceMotion
          ? 1
          : 1 + Math.sin(elapsed * 0.75) * pose.breathe * (cur.inicio + cur.grupo);
        sm.scale = MathUtils.damp(sm.scale, pose.scale * breatheScale, k, delta);
        sm.offsetX = MathUtils.damp(sm.offsetX, pose.offsetX, k, delta);
        const targetOffsetY = isDesktop ? 0 : pose.offsetY;
        sm.offsetY = MathUtils.damp(sm.offsetY, targetOffsetY, k, delta);

        points.scale.setScalar(sm.scale);
        points.position.set(sm.offsetX, sm.offsetY, 0);
        if (reduceMotion) {
          points.rotation.set(0, 0, 0);
        } else {
          const t = (elapsed * Math.PI * 2) / ROCK_PERIOD;
          points.rotation.set(
            Math.sin(t * 0.8 + 0.7) * PITCH_AMP,
            Math.sin(t) * YAW_AMP,
            0,
          );
        }

        uniforms.uReveal.value = reduceMotion ? 1 : pose.reveal;
        uniforms.uScatter.value = pose.scatter;
        uniforms.uGather.value = pose.gather;
        uniforms.uDissolve.value = pose.dissolve;
        uniforms.uEmberMix.value = pose.ember;
        uniforms.uAlpha.value = pose.alpha;
        uniforms.uTipPulse.value = reduceMotion
          ? 0
          : cur.oficio * (0.72 + Math.sin(elapsed * 3.1) * 0.28);

        if (!reduceMotion) uniforms.uTime.value = elapsed;

        const hoverTarget = hovering ? 1 : 0;
        hoverStrength = reduceMotion
          ? 0
          : MathUtils.damp(hoverStrength, hoverTarget, 7.5, delta);
        uniforms.uHoverStrength.value = hoverStrength;

        renderer.render(scene, camera);
      };

      const tick = () => {
        if (disposed) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        renderFrame(delta, clock.elapsedTime);
        frame = requestAnimationFrame(tick);
      };

      const onLineasPanel = (e: Event) => {
        const detail = (e as CustomEvent<{ index?: number }>).detail;
        if (typeof detail?.index === 'number') requestIconMorph(detail.index);
        else syncLineasIndex();
        if (reduceMotion) renderFrame(0, clock.elapsedTime);
      };

      const onReducedMotionScroll = () => {
        syncLineasIndex();
        renderFrame(0, clock.elapsedTime);
      };

      window.addEventListener('df:lineas-panel', onLineasPanel);
      if (reduceMotion) {
        window.addEventListener('scroll', onReducedMotionScroll, { passive: true });
        window.addEventListener('resize', onReducedMotionScroll, { passive: true });
      }

      let fitAttempts = 0;
      const tryFit = () => {
        if (disposed) return;
        if (fit()) {
          if (reduceMotion) renderFrame(0, 0);
          return;
        }
        if (++fitAttempts < 24) requestAnimationFrame(tryFit);
      };

      const ro = new ResizeObserver(() => {
        fit();
        if (reduceMotion) renderFrame(0, 0);
      });
      ro.observe(mount);
      tryFit();

      if (reduceMotion) {
        renderFrame(0, 0);
      } else {
        frame = requestAnimationFrame(tick);
      }

      void Promise.all([loadIconPaths(), fetchSvgPaths(CONTACT_SVG)]).then(([icons, contactIcon]) => {
        if (disposed) return;
        pageMorph = buildPageMorph(icons, contactIcon);
        if (pageMorph.count === 0) return;
        const nextGeo = buildPageGeometry(pageMorph);
        geometry.dispose();
        geometry = nextGeo;
        points.geometry = nextGeo;
        if (reduceMotion) renderFrame(0, clock.elapsedTime);
      });

      teardown = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        window.removeEventListener('df:lineas-panel', onLineasPanel);
        desktopMq.removeEventListener('change', onDesktopChange);
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
    } catch (err) {
      console.error('[Atmosphere] init failed', err);
    }

    return () => {
      disposed = true;
      teardown?.();
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

export const LOGO_DOT_COUNT = (() => {
  if (typeof document === 'undefined') return 0;
  try {
    return buildPageMorph(EMPTY_ICON_PATHS).count;
  } catch {
    return 0;
  }
})();
