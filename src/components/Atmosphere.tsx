import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Logo-derived pointillism feather — sampled from public/logo.svg via Canvas 2D.
 * Sections: #inicio #grupo #lineas #oficio #contacto
 */

const LOGO_PATH =
  'M 105.500 12.572 C 101.650 16.136, 91.750 24.155, 83.500 30.392 C 59.486 48.547, 39.599 67.920, 31.913 80.644 C 26.345 89.862, 21.189 100.776, 18.516 109 C 15.715 117.620, 14.266 119.849, 6.897 126.878 C 3.104 130.495, 0 133.803, 0 134.228 C 0 136.216, 4.186 134.531, 11.500 129.600 C 15.900 126.633, 24.900 121.461, 31.500 118.107 C 38.100 114.753, 45.814 110.094, 48.641 107.754 C 69.115 90.814, 80.854 78.771, 89.339 66 C 91.349 62.975, 93.339 60.050, 93.763 59.500 C 95.049 57.828, 101.915 44.930, 105.474 37.500 C 110.421 27.174, 115.681 5.896, 113.250 6.046 C 112.838 6.072, 109.350 9.008, 105.500 12.572';

const VIEW_W = 122;
const VIEW_H = 135;
const TARGET_DOTS = 3400;
const VOID = 0x0d0d0d;
const EMBER = new THREE.Color(0xc45a4a);
const BONE = new THREE.Color(0xd4d4d8);
const FOG = new THREE.Color(0x71717a);
const DAMP = 6.2;

const DOT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aTip;
  attribute float aSize;

  uniform float uTime;
  uniform float uMotion;
  uniform float uBreathe;
  uniform float uTwinkle;

  varying float vSeed;
  varying float vTip;
  varying float vDepth;
  varying float vTwinkle;

  void main() {
    vSeed = aSeed;
    vTip = aTip;

    vec3 p = position;
    float wave = sin(uTime * 1.1 + aSeed * 18.0) * 0.012 * uBreathe * uMotion;
    p.z += wave;
    p.x += cos(uTime * 0.7 + aSeed * 9.0) * 0.008 * uBreathe * uMotion;
    p.y += sin(uTime * 0.85 + aSeed * 11.0) * 0.01 * uBreathe * uMotion;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vTwinkle = sin(uTime * 2.4 + aSeed * 40.0) * 0.5 + 0.5;

    gl_PointSize = aSize * (280.0 / -mv.z) * mix(0.85, 1.15, vTwinkle * uTwinkle);
    gl_Position = projectionMatrix * mv;
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform float uFade;
  uniform float uEmberMix;
  uniform vec3 uEmber;
  uniform vec3 uBone;
  uniform vec3 uFog;

  varying float vSeed;
  varying float vTip;
  varying float vDepth;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float soft = smoothstep(0.5, 0.12, d);
    float depthFade = smoothstep(14.0, 2.0, vDepth);

    float tip = smoothstep(0.55, 0.95, vTip);
    vec3 base = mix(uFog, uBone, 0.55 + vSeed * 0.35);
    vec3 col = mix(base, uEmber, tip * uEmberMix);
    col += uEmber * tip * uEmberMix * 0.35;
    col *= mix(0.88, 1.08, vTwinkle * 0.35);

    float alpha = soft * depthFade * uFade * mix(0.35, 0.92, tip * 0.5 + 0.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

type SampledDot = { x: number; y: number; u: number; v: number; tip: number; seed: number };

function sampleLogoDots(): SampledDot[] {
  const cw = 280;
  const ch = Math.round(cw * (VIEW_H / VIEW_W));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, cw, ch);
  ctx.scale(cw / VIEW_W, ch / VIEW_H);
  ctx.fill(new Path2D(LOGO_PATH));

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const candidates: SampledDot[] = [];
  const step = 2;

  for (let py = 0; py < ch; py += step) {
    for (let px = 0; px < cw; px += step) {
      const idx = (py * cw + px) * 4;
      if (data[idx + 3] < 100) continue;

      const u = px / cw;
      const v = py / ch;
      const svgY = (py / ch) * VIEW_H;
      const tip = 1 - THREE.MathUtils.clamp(svgY / VIEW_H, 0, 1);

      candidates.push({
        x: (u - 0.5) * 2.35,
        y: -(v - 0.5) * 2.6,
        u,
        v,
        tip,
        seed: Math.random(),
      });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const picked = candidates.slice(0, Math.min(TARGET_DOTS, candidates.length));

  for (const dot of picked) {
    dot.x += (Math.random() - 0.5) * 0.012;
    dot.y += (Math.random() - 0.5) * 0.012;
  }

  return picked;
}

function buildDotGeometry(dots: SampledDot[]) {
  const layers = [-0.035, 0, 0.035];
  const positions: number[] = [];
  const seeds: number[] = [];
  const tips: number[] = [];
  const sizes: number[] = [];

  for (const dot of dots) {
    for (const lz of layers) {
      positions.push(dot.x, dot.y, lz + (Math.random() - 0.5) * 0.018);
      seeds.push(dot.seed);
      tips.push(dot.tip);
      sizes.push(THREE.MathUtils.lerp(2.2, 4.8, dot.tip * 0.4 + dot.seed * 0.6));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geo.setAttribute('aTip', new THREE.Float32BufferAttribute(tips, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geo.computeBoundingSphere();
  return geo;
}

function sectionPresence(el: Element | null, vh: number) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const overlap = Math.min(r.bottom, vh * 0.88) - Math.max(r.top, vh * 0.1);
  return THREE.MathUtils.clamp(overlap / Math.max(r.height * 0.65, vh * 0.45), 0, 1);
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

export default function Atmosphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches && !reduceMotion;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(VOID, 0.045);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    camera.position.set(0, 0.1, 5.4);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const dots2d = sampleLogoDots();
    const dotGeo = buildDotGeometry(dots2d);

    const uniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uBreathe: { value: 1 },
      uTwinkle: { value: 0.55 },
      uFade: { value: 0.92 },
      uEmberMix: { value: 0.45 },
      uEmber: { value: EMBER },
      uBone: { value: BONE },
      uFog: { value: FOG },
    };

    const dotMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const feather = new THREE.Points(dotGeo, dotMat);
    feather.rotation.z = -0.08;
    scene.add(feather);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.32, 0.82);
    composer.addPass(bloomPass);

    const sections = {
      inicio: document.getElementById('inicio'),
      grupo: document.getElementById('grupo'),
      lineas: document.getElementById('lineas'),
      oficio: document.getElementById('oficio'),
      contacto: document.getElementById('contacto'),
    };

    const poses = {
      inicio: {
        fx: 0.62, fy: 0.08, fz: 0, scale: 1.18, rotx: 0, roty: 0.25, rotz: -0.06,
        camY: 0.1, camZ: 5.4, fov: 42, breathe: 1, twinkle: 0.45, ember: 0.5, fade: 0.95,
      },
      grupo: {
        fx: 0.42, fy: 0, fz: 0.04, scale: 1.05, rotx: 0.08, roty: -0.2, rotz: 0.04,
        camY: 0, camZ: 5.1, fov: 40, breathe: 0.85, twinkle: 0.55, ember: 0.58, fade: 0.88,
      },
      lineas: {
        fx: 0.22, fy: -0.06, fz: 0.08, scale: 1, rotx: 0.15, roty: 0.65, rotz: 0.1,
        camY: -0.05, camZ: 4.85, fov: 38, breathe: 0.7, twinkle: 0.75, ember: 0.72, fade: 0.82,
      },
      oficio: {
        fx: -0.05, fy: 0.04, fz: 0.02, scale: 0.92, rotx: -0.05, roty: 1.05, rotz: 0.02,
        camY: 0, camZ: 4.65, fov: 37, breathe: 0.55, twinkle: 0.85, ember: 0.95, fade: 0.75,
      },
      contacto: {
        fx: 0, fy: -0.18, fz: 0.12, scale: 0.75, rotx: 0.2, roty: 1.35, rotz: 0.12,
        camY: -0.12, camZ: 5.8, fov: 36, breathe: 0.25, twinkle: 0.2, ember: 0.35, fade: 0.38,
      },
    };

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const cur = { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };
    const cam = { y: 0.1, z: 5.4, fov: 42 };
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const sample = () => {
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
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!finePointer) return;
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    if (finePointer) window.addEventListener('pointermove', onPointerMove, { passive: true });

    const ro = new ResizeObserver(() => {
      fit();
      if (reduceMotion) composer.render();
    });
    ro.observe(mount);
    fit();

    const applyBeats = (beats: ReturnType<typeof sample>, delta: number, elapsed: number) => {
      const k = reduceMotion ? 0 : DAMP;
      cur.inicio = THREE.MathUtils.damp(cur.inicio, beats.inicio, k, delta);
      cur.grupo = THREE.MathUtils.damp(cur.grupo, beats.grupo, k, delta);
      cur.lineas = THREE.MathUtils.damp(cur.lineas, beats.lineas, k, delta);
      cur.oficio = THREE.MathUtils.damp(cur.oficio, beats.oficio, k, delta);
      cur.contacto = THREE.MathUtils.damp(cur.contacto, beats.contacto, k, delta);

      const pose = blendPose(cur, poses);

      pointer.x = THREE.MathUtils.damp(pointer.x, pointer.tx, k, delta);
      pointer.y = THREE.MathUtils.damp(pointer.y, pointer.ty, k, delta);
      const px = finePointer ? pointer.x * 0.1 : 0;
      const py = finePointer ? pointer.y * 0.06 : 0;

      cam.y = THREE.MathUtils.damp(cam.y, pose.camY, k, delta);
      cam.z = THREE.MathUtils.damp(cam.z, pose.camZ, k, delta);
      cam.fov = THREE.MathUtils.damp(cam.fov, pose.fov, k, delta);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.position.set(px * 0.25, cam.y, cam.z);
      camera.lookAt(pose.fx * 0.35 + px * 0.15, 0, 0);

      const floatY = reduceMotion ? 0 : Math.sin(elapsed * 0.75) * 0.035 * pose.breathe;

      feather.position.set(
        THREE.MathUtils.damp(feather.position.x, pose.fx + px, k, delta),
        THREE.MathUtils.damp(feather.position.y, pose.fy + floatY + py, k, delta),
        THREE.MathUtils.damp(feather.position.z, pose.fz, k, delta),
      );

      const densityPulse = reduceMotion ? 1 : 1 + Math.sin(elapsed * 1.2) * 0.025 * pose.twinkle;
      feather.scale.setScalar(pose.scale * densityPulse);

      feather.rotation.x = THREE.MathUtils.damp(feather.rotation.x, pose.rotx, k, delta);
      feather.rotation.y = pose.roty + (reduceMotion ? 0 : elapsed * 0.08);
      feather.rotation.z = THREE.MathUtils.damp(feather.rotation.z, pose.rotz, k, delta);

      uniforms.uBreathe.value = pose.breathe;
      uniforms.uTwinkle.value = pose.twinkle;
      uniforms.uEmberMix.value = pose.ember;
      uniforms.uFade.value = pose.fade;

      bloomPass.strength = THREE.MathUtils.lerp(0.22, 0.52, pose.ember);
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      applyBeats(sample(), delta, elapsed);
      if (!reduceMotion) uniforms.uTime.value = elapsed;
      composer.render();
      frame = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      applyBeats(sample(), 1, 0);
      composer.render();
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      if (finePointer) window.removeEventListener('pointermove', onPointerMove);
      dotGeo.dispose();
      dotMat.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="atmosphere" aria-hidden="true" />;
}

export const LOGO_DOT_COUNT = TARGET_DOTS;
