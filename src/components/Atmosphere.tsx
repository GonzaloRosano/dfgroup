import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Logo-derived pointillism feather — sampled from public/logo.svg via Canvas 2D.
 * Right-panel accent only; normal blending, no bloom (avoids white washout).
 */

const LOGO_PATH =
  'M 105.500 12.572 C 101.650 16.136, 91.750 24.155, 83.500 30.392 C 59.486 48.547, 39.599 67.920, 31.913 80.644 C 26.345 89.862, 21.189 100.776, 18.516 109 C 15.715 117.620, 14.266 119.849, 6.897 126.878 C 3.104 130.495, 0 133.803, 0 134.228 C 0 136.216, 4.186 134.531, 11.500 129.600 C 15.900 126.633, 24.900 121.461, 31.500 118.107 C 38.100 114.753, 45.814 110.094, 48.641 107.754 C 69.115 90.814, 80.854 78.771, 89.339 66 C 91.349 62.975, 93.339 60.050, 93.763 59.500 C 95.049 57.828, 101.915 44.930, 105.474 37.500 C 110.421 27.174, 115.681 5.896, 113.250 6.046 C 112.838 6.072, 109.350 9.008, 105.500 12.572';

const VIEW_W = 122;
const VIEW_H = 135;
const TARGET_DOTS = 2800;
const DAMP = 4.8;

const EMBER = new THREE.Color(0x9a3b3b);
const BONE = new THREE.Color(0xa1a1aa);
const FOG = new THREE.Color(0x52525b);

const DOT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aTip;
  attribute float aSize;

  uniform float uTime;
  uniform float uMotion;
  uniform float uBreathe;
  uniform float uTwinkle;
  uniform float uInteract;

  varying float vSeed;
  varying float vTip;
  varying float vTwinkle;

  void main() {
    vSeed = aSeed;
    vTip = aTip;

    vec3 p = position;
    float wave = sin(uTime * 0.75 + aSeed * 18.0) * 0.004 * uBreathe * uMotion;
    p.z += wave;
    p.x += cos(uTime * 0.5 + aSeed * 9.0) * 0.003 * uBreathe * uMotion;
    p.y += sin(uTime * 0.6 + aSeed * 11.0) * 0.003 * uBreathe * uMotion;
    p += normalize(vec3(p.x, p.y, 0.001)) * uInteract * 0.018 * sin(uTime * 2.0 + aSeed * 30.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vTwinkle = sin(uTime * 2.0 + aSeed * 40.0) * 0.5 + 0.5;

    gl_PointSize = aSize * (95.0 / -mv.z) * (1.0 + vTwinkle * uTwinkle * 0.12 + uInteract * 0.08);
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
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float dotShape = 1.0 - smoothstep(0.38, 0.5, d);

    float tip = smoothstep(0.55, 0.95, vTip);
    vec3 base = mix(uFog, uBone, 0.35 + vSeed * 0.25);
    vec3 col = mix(base, uEmber, tip * uEmberMix);
    col *= mix(0.92, 1.06, vTwinkle * 0.2);

    float alpha = dotShape * uFade * mix(0.22, 0.52, tip * 0.4 + 0.35);
    if (alpha < 0.02) discard;

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
        x: (u - 0.5) * 1.65,
        y: -(v - 0.5) * 1.85,
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
    dot.x += (Math.random() - 0.5) * 0.006;
    dot.y += (Math.random() - 0.5) * 0.006;
  }

  return picked;
}

function buildDotGeometry(dots: SampledDot[]) {
  const positions: number[] = [];
  const seeds: number[] = [];
  const tips: number[] = [];
  const sizes: number[] = [];

  for (const dot of dots) {
    positions.push(dot.x, dot.y, (Math.random() - 0.5) * 0.008);
    seeds.push(dot.seed);
    tips.push(dot.tip);
    sizes.push(THREE.MathUtils.lerp(1.1, 2.2, dot.tip * 0.35 + dot.seed * 0.45));
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

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0, 0, 6.4);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const dots2d = sampleLogoDots();
    const dotGeo = buildDotGeometry(dots2d);

    const uniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uBreathe: { value: 1 },
      uTwinkle: { value: 0.25 },
      uInteract: { value: 0 },
      uFade: { value: 0.75 },
      uEmberMix: { value: 0.55 },
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
      blending: THREE.NormalBlending,
    });

    const feather = new THREE.Points(dotGeo, dotMat);
    feather.rotation.z = -0.06;
    scene.add(feather);

    const sections = {
      inicio: document.getElementById('inicio'),
      grupo: document.getElementById('grupo'),
      lineas: document.getElementById('lineas'),
      oficio: document.getElementById('oficio'),
      contacto: document.getElementById('contacto'),
    };

    const poses = {
      inicio: {
        fx: 0.08, fy: 0.02, fz: 0, scale: 0.78, rotx: 0, roty: 0.12, rotz: -0.04,
        camY: 0, camZ: 6.4, fov: 38, breathe: 0.6, twinkle: 0.22, ember: 0.55, fade: 0.72,
      },
      grupo: {
        fx: 0.05, fy: 0, fz: 0.02, scale: 0.72, rotx: 0.06, roty: -0.15, rotz: 0.03,
        camY: 0, camZ: 6.2, fov: 37, breathe: 0.55, twinkle: 0.3, ember: 0.62, fade: 0.65,
      },
      lineas: {
        fx: -0.02, fy: -0.04, fz: 0.04, scale: 0.68, rotx: 0.1, roty: 0.45, rotz: 0.06,
        camY: -0.03, camZ: 6, fov: 36, breathe: 0.45, twinkle: 0.38, ember: 0.7, fade: 0.58,
      },
      oficio: {
        fx: -0.06, fy: 0.02, fz: 0.02, scale: 0.62, rotx: -0.04, roty: 0.85, rotz: 0.02,
        camY: 0, camZ: 5.85, fov: 35, breathe: 0.35, twinkle: 0.45, ember: 0.78, fade: 0.5,
      },
      contacto: {
        fx: 0, fy: -0.1, fz: 0.06, scale: 0.52, rotx: 0.12, roty: 1.1, rotz: 0.08,
        camY: -0.08, camZ: 6.6, fov: 34, breathe: 0.2, twinkle: 0.15, ember: 0.45, fade: 0.32,
      },
    };

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const cur = { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };
    const cam = { y: 0, z: 6.4, fov: 38 };
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let interactTarget = 0;
    let interactCurrent = 0;

    const onFeatherInteract = (e: Event) => {
      const detail = (e as CustomEvent<{ intensity?: number }>).detail;
      interactTarget = THREE.MathUtils.clamp(detail?.intensity ?? 0, 0, 1);
    };

    window.addEventListener('df:feather-interact', onFeatherInteract);

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
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!finePointer) return;
      const rect = mount.getBoundingClientRect();
      if (rect.width <= 0) return;
      pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    if (finePointer) mount.addEventListener('pointermove', onPointerMove, { passive: true });

    const ro = new ResizeObserver(() => {
      fit();
      if (reduceMotion) renderer.render(scene, camera);
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
      const px = finePointer ? pointer.x * 0.06 : 0;
      const py = finePointer ? pointer.y * 0.04 : 0;

      cam.y = THREE.MathUtils.damp(cam.y, pose.camY, k, delta);
      cam.z = THREE.MathUtils.damp(cam.z, pose.camZ, k, delta);
      cam.fov = THREE.MathUtils.damp(cam.fov, pose.fov, k, delta);
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.position.set(px * 0.12, cam.y, cam.z);
      camera.lookAt(pose.fx * 0.2 + px * 0.08, 0, 0);

      const floatY = reduceMotion ? 0 : Math.sin(elapsed * 0.65) * 0.018 * pose.breathe;

      feather.position.set(
        THREE.MathUtils.damp(feather.position.x, pose.fx + px * 0.04, k, delta),
        THREE.MathUtils.damp(feather.position.y, pose.fy + floatY + py * 0.04, k, delta),
        THREE.MathUtils.damp(feather.position.z, pose.fz, k, delta),
      );

      feather.scale.setScalar(pose.scale);

      feather.rotation.x = THREE.MathUtils.damp(feather.rotation.x, pose.rotx, k, delta);
      feather.rotation.z = THREE.MathUtils.damp(feather.rotation.z, pose.rotz, k, delta);
      feather.rotation.y = pose.roty + (reduceMotion ? 0 : elapsed * 0.025);

      interactCurrent = THREE.MathUtils.damp(interactCurrent, interactTarget, k, delta);
      uniforms.uInteract.value = interactCurrent;
      uniforms.uTwinkle.value = pose.twinkle + interactCurrent * 0.25;
      uniforms.uEmberMix.value = pose.ember + interactCurrent * 0.15;
      uniforms.uFade.value = pose.fade;
      uniforms.uBreathe.value = pose.breathe + interactCurrent * 0.1;
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      applyBeats(sample(), delta, elapsed);
      if (!reduceMotion) uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      applyBeats(sample(), 1, 0);
      renderer.render(scene, camera);
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      if (finePointer) mount.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('df:feather-interact', onFeatherInteract);
      dotGeo.dispose();
      dotMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="atmosphere" aria-hidden="true" />;
}

export const LOGO_DOT_COUNT = TARGET_DOTS;
