import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Noir wire lattice — scroll-choreographed 3D field with pulse flow,
 * ember drift, feather strokes, mouse parallax, and subtle bloom.
 * Sections: #inicio #grupo #lineas #oficio #contacto
 */

const VOID = 0x0d0d0d;
const EMBER = new THREE.Color(0xc45a4a);
const BONE = new THREE.Color(0xd4d4d8);
const EMBER_COUNT = 28;
const DAMP = 6.5;

const LINE_VERT = /* glsl */ `
  attribute float aLineCoord;
  attribute float aAxis;

  uniform float uTime;
  uniform float uMotion;
  uniform float uBreath;
  uniform float uShear;
  uniform float uLift;
  uniform float uGridPulse;
  uniform float uTighten;

  varying float vDepth;
  varying float vLineCoord;
  varying float vAxis;

  void main() {
    vec3 p = position;

    float freq = 1.6 + uGridPulse * 0.9;
    float wave = sin(p.x * freq + uTime * 0.65) * cos(p.z * (1.1 + uGridPulse * 0.4) + uTime * 0.42);
    p.y += wave * uBreath * (0.16 + uGridPulse * 0.06) * uMotion;
    p.x += sin(p.z * 0.95 + uTime * 0.48) * uShear * 0.28;
    p.y += uLift * 0.42;
    p.z += sin(p.x * 0.7 + uTime * 0.35) * uTighten * 0.12;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vLineCoord = aLineCoord;
    vAxis = aAxis;
    gl_Position = projectionMatrix * mv;
  }
`;

const LINE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uGlow;
  uniform float uFade;
  uniform float uPulse;
  uniform vec3 uEmber;
  uniform vec3 uBone;

  varying float vDepth;
  varying float vLineCoord;
  varying float vAxis;

  void main() {
    float depthFade = smoothstep(16.0, 2.2, vDepth);
    float axisMix = mix(0.45, 1.0, vAxis);

    float travel = fract(vLineCoord - uTime * 0.22 * uMotion);
    float pulse = pow(sin(travel * 6.283) * 0.5 + 0.5, 4.0) * uPulse;

    vec3 base = mix(uBone * 0.32, uEmber * 0.85, uGlow * axisMix);
    vec3 col = base + uEmber * pulse * 0.55 * axisMix;

    float alpha = depthFade * uFade * mix(0.2, 0.78, uGlow + pulse * 0.35) * axisMix;
    gl_FragColor = vec4(col, alpha);
  }
`;

const EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uFade;

  attribute float aSeed;

  varying float vSeed;
  varying float vDepth;

  void main() {
    vSeed = aSeed;
    vec3 p = position;
    p.x += sin(uTime * 0.35 + aSeed * 12.0) * 0.35 * uMotion;
    p.y += mod(uTime * 0.08 + aSeed * 2.4, 2.8) - 1.4;
    p.z += cos(uTime * 0.28 + aSeed * 8.0) * 0.25 * uMotion;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_PointSize = mix(2.0, 5.5, aSeed) * (220.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const EMBER_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform float uFade;
  uniform vec3 uEmber;

  varying float vSeed;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float soft = smoothstep(0.5, 0.08, d);
    float depthFade = smoothstep(14.0, 2.0, vDepth);
    float twinkle = 0.65 + 0.35 * sin(vSeed * 40.0);
    vec3 col = uEmber * (1.1 + uGlow * 0.4) * twinkle;
    float alpha = soft * depthFade * uFade * 0.55;
    gl_FragColor = vec4(col, alpha);
  }
`;

const FEATHER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uReveal;

  varying float vAlong;
  varying float vDepth;

  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.4 + p.y * 2.0) * 0.04 * uMotion * uReveal;
    p.z += cos(uTime * 0.32 + p.y * 1.6) * 0.03 * uMotion * uReveal;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vAlong = p.y;
    gl_Position = projectionMatrix * mv;
  }
`;

const FEATHER_FRAG = /* glsl */ `
  uniform float uReveal;
  uniform float uFade;
  uniform vec3 uEmber;
  uniform vec3 uBone;

  varying float vAlong;
  varying float vDepth;

  void main() {
    float depthFade = smoothstep(14.0, 2.5, vDepth);
    float along = smoothstep(-0.7, 0.85, vAlong);
    vec3 col = mix(uBone * 0.5, uEmber, 0.65);
    float alpha = depthFade * uFade * uReveal * along * 0.45;
    gl_FragColor = vec4(col, alpha);
  }
`;

type LatticeAttrs = {
  lineCoord: number[];
  axis: number[];
};

function buildLattice(cols: number, rows: number, width: number, depth: number): {
  geo: THREE.BufferGeometry;
  attrs: LatticeAttrs;
} {
  const positions: number[] = [];
  const lineCoord: number[] = [];
  const axis: number[] = [];
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  for (let r = 0; r <= rows; r++) {
    const z = (r / rows) * depth - halfD;
    for (let c = 0; c < cols; c++) {
      const x0 = (c / cols) * width - halfW;
      const x1 = ((c + 1) / cols) * width - halfW;
      positions.push(x0, 0, z, x1, 0, z);
      lineCoord.push(0, 1);
      axis.push(0, 0);
    }
  }

  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * width - halfW;
    for (let r = 0; r < rows; r++) {
      const z0 = (r / rows) * depth - halfD;
      const z1 = ((r + 1) / rows) * depth - halfD;
      positions.push(x, 0, z0, x, 0, z1);
      lineCoord.push(0, 1);
      axis.push(1, 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aLineCoord', new THREE.Float32BufferAttribute(lineCoord, 1));
  geo.setAttribute('aAxis', new THREE.Float32BufferAttribute(axis, 1));
  return { geo, attrs: { lineCoord, axis } };
}

function buildFeatherStrokes(): THREE.BufferGeometry {
  const positions: number[] = [];

  const shaft: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    shaft.push(new THREE.Vector3(Math.sin(t * Math.PI) * 0.06, t * 1.35 - 0.55, -1.05 + t * 0.25));
  }
  const shaftCurve = new THREE.CatmullRomCurve3(shaft);
  const shaftPts = shaftCurve.getPoints(36);
  for (let i = 0; i < shaftPts.length - 1; i++) {
    positions.push(shaftPts[i].x, shaftPts[i].y, shaftPts[i].z);
    positions.push(shaftPts[i + 1].x, shaftPts[i + 1].y, shaftPts[i + 1].z);
  }

  for (let b = 0; b < 7; b++) {
    const side = b % 2 === 0 ? -1 : 1;
    const barb: THREE.Vector3[] = [];
    const y0 = 0.15 + (b / 7) * 0.75;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      barb.push(
        new THREE.Vector3(
          side * (0.08 + t * 0.38),
          y0 + t * 0.12,
          -0.95 + y0 * 0.2,
        ),
      );
    }
    const barbCurve = new THREE.CatmullRomCurve3(barb);
    const barbPts = barbCurve.getPoints(12);
    for (let i = 0; i < barbPts.length - 1; i++) {
      positions.push(barbPts[i].x, barbPts[i].y, barbPts[i].z);
      positions.push(barbPts[i + 1].x, barbPts[i + 1].y, barbPts[i + 1].z);
    }
  }

  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
}

function buildEmberCloud(): THREE.BufferGeometry {
  const positions: number[] = [];
  const seeds: number[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    const seed = Math.random();
    positions.push(
      (Math.random() - 0.5) * 7,
      (Math.random() - 0.5) * 2.2,
      (Math.random() - 0.5) * 4 - 0.6,
    );
    seeds.push(seed);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
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
    scene.fog = new THREE.FogExp2(VOID, 0.085);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 40);
    camera.position.set(0.15, 2.9, 5.6);

    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const lineUniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uBreath: { value: 1 },
      uShear: { value: 0 },
      uLift: { value: 0 },
      uGridPulse: { value: 0 },
      uTighten: { value: 0 },
      uGlow: { value: 0.35 },
      uFade: { value: 0.88 },
      uPulse: { value: 0.5 },
      uEmber: { value: EMBER },
      uBone: { value: BONE },
    };

    const latticeRoot = new THREE.Group();
    scene.add(latticeRoot);

    const { geo: latticeGeo } = buildLattice(32, 22, 9.5, 7.5);
    latticeGeo.rotateX(-0.52);
    latticeGeo.translate(0, -0.35, -0.75);

    const latticeMat = new THREE.ShaderMaterial({
      uniforms: lineUniforms,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lattice = new THREE.LineSegments(latticeGeo, latticeMat);
    latticeRoot.add(lattice);

    const { geo: echoGeo } = buildLattice(16, 11, 9.5, 7.5);
    echoGeo.rotateX(-0.52);
    echoGeo.translate(0, -0.55, -1.15);
    echoGeo.scale(1.04, 1, 1.04);
    const echoMat = latticeMat.clone();
    const echoLattice = new THREE.LineSegments(echoGeo, echoMat);
    echoLattice.position.y = -0.08;
    latticeRoot.add(echoLattice);

    const emberUniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uGlow: { value: 0.4 },
      uFade: { value: 0.85 },
      uEmber: { value: EMBER },
    };
    const emberGeo = buildEmberCloud();
    const emberMat = new THREE.ShaderMaterial({
      uniforms: emberUniforms,
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const embers = new THREE.Points(emberGeo, emberMat);
    embers.position.y = 0.35;
    scene.add(embers);

    const featherUniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uReveal: { value: 0 },
      uFade: { value: 0.88 },
      uEmber: { value: EMBER },
      uBone: { value: BONE },
    };
    const featherGeo = buildFeatherStrokes();
    featherGeo.rotateX(-0.48);
    featherGeo.translate(0.55, -0.15, -0.5);
    const featherMat = new THREE.ShaderMaterial({
      uniforms: featherUniforms,
      vertexShader: FEATHER_VERT,
      fragmentShader: FEATHER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const feather = new THREE.LineSegments(featherGeo, featherMat);
    scene.add(feather);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.35, 0.72);
    composer.addPass(bloomPass);

    const sections = {
      inicio: document.getElementById('inicio'),
      grupo: document.getElementById('grupo'),
      lineas: document.getElementById('lineas'),
      oficio: document.getElementById('oficio'),
      contacto: document.getElementById('contacto'),
    };

    const poses = {
      inicio: { camX: 0.15, camY: 2.95, camZ: 5.75, fov: 54, lookX: 0, lookY: -0.05, lookZ: -0.45, breath: 1.0, shear: 0, lift: 0, gridPulse: 0, tighten: 0, glow: 0.32, pulse: 0.45, fade: 0.92 },
      grupo: { camX: -0.25, camY: 2.15, camZ: 5.1, fov: 50, lookX: 0.1, lookY: -0.15, lookZ: -0.65, breath: 0.72, shear: 0.15, lift: 0.1, gridPulse: 0.1, tighten: 0.05, glow: 0.42, pulse: 0.55, fade: 0.88 },
      lineas: { camX: 0.35, camY: 1.75, camZ: 4.55, fov: 46, lookX: -0.05, lookY: -0.22, lookZ: -0.85, breath: 0.55, shear: 1.0, lift: 0.15, gridPulse: 1.0, tighten: 0.1, glow: 0.82, pulse: 0.95, fade: 0.85 },
      oficio: { camX: -0.15, camY: 1.45, camZ: 4.25, fov: 44, lookX: 0.15, lookY: -0.08, lookZ: -0.95, breath: 0.38, shear: 0.35, lift: 0.55, gridPulse: 0.35, tighten: 0.65, glow: 0.7, pulse: 0.65, fade: 0.78 },
      contacto: { camX: 0, camY: 1.25, camZ: 5.85, fov: 42, lookX: 0, lookY: -0.35, lookZ: -1.25, breath: 0.2, shear: 0.1, lift: 0.05, gridPulse: 0, tighten: 0.2, glow: 0.25, pulse: 0.2, fade: 0.32 },
    };

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const cur = { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };
    const cam = { x: 0.15, y: 2.9, z: 5.6, fov: 52, lookX: 0, lookY: -0.05, lookZ: -0.45 };
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

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer) return;
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    if (finePointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    const ro = new ResizeObserver(() => {
      fit();
      if (reduceMotion) composer.render();
    });
    ro.observe(mount);
    fit();

    const applyBeats = (beats: ReturnType<typeof sample>, delta: number) => {
      const k = reduceMotion ? 0 : DAMP;
      cur.inicio = THREE.MathUtils.damp(cur.inicio, beats.inicio, k, delta);
      cur.grupo = THREE.MathUtils.damp(cur.grupo, beats.grupo, k, delta);
      cur.lineas = THREE.MathUtils.damp(cur.lineas, beats.lineas, k, delta);
      cur.oficio = THREE.MathUtils.damp(cur.oficio, beats.oficio, k, delta);
      cur.contacto = THREE.MathUtils.damp(cur.contacto, beats.contacto, k, delta);

      const w = { ...cur };
      const pose = blendPose(w, poses);

      pointer.x = THREE.MathUtils.damp(pointer.x, pointer.tx, k, delta);
      pointer.y = THREE.MathUtils.damp(pointer.y, pointer.ty, k, delta);
      const parallax = finePointer ? 0.22 : 0;

      cam.x = THREE.MathUtils.damp(cam.x, pose.camX + pointer.x * parallax, k, delta);
      cam.y = THREE.MathUtils.damp(cam.y, pose.camY - pointer.y * parallax * 0.35, k, delta);
      cam.z = THREE.MathUtils.damp(cam.z, pose.camZ, k, delta);
      cam.fov = THREE.MathUtils.damp(cam.fov, pose.fov, k, delta);
      cam.lookX = THREE.MathUtils.damp(cam.lookX, pose.lookX + pointer.x * parallax * 0.5, k, delta);
      cam.lookY = THREE.MathUtils.damp(cam.lookY, pose.lookY - pointer.y * parallax * 0.25, k, delta);
      cam.lookZ = THREE.MathUtils.damp(cam.lookZ, pose.lookZ, k, delta);

      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);

      lineUniforms.uBreath.value = pose.breath;
      lineUniforms.uShear.value = pose.shear;
      lineUniforms.uLift.value = pose.lift;
      lineUniforms.uGridPulse.value = pose.gridPulse;
      lineUniforms.uTighten.value = pose.tighten;
      lineUniforms.uGlow.value = pose.glow;
      lineUniforms.uFade.value = pose.fade;
      lineUniforms.uPulse.value = pose.pulse;

      echoMat.uniforms.uBreath.value = pose.breath * 0.65;
      echoMat.uniforms.uShear.value = pose.shear * 0.8;
      echoMat.uniforms.uLift.value = pose.lift * 0.5;
      echoMat.uniforms.uGridPulse.value = pose.gridPulse;
      echoMat.uniforms.uTighten.value = pose.tighten * 0.5;
      echoMat.uniforms.uGlow.value = pose.glow * 0.45;
      echoMat.uniforms.uFade.value = pose.fade * 0.55;
      echoMat.uniforms.uPulse.value = pose.pulse * 0.7;

      emberUniforms.uGlow.value = pose.glow;
      emberUniforms.uFade.value = pose.fade;

      featherUniforms.uReveal.value = THREE.MathUtils.damp(
        featherUniforms.uReveal.value,
        THREE.MathUtils.clamp(cur.oficio * 1.2 + cur.lineas * 0.15, 0, 1),
        reduceMotion ? 0 : 4,
        delta,
      );
      featherUniforms.uFade.value = pose.fade;

      const breathe = reduceMotion ? 0 : 1 + Math.sin(clock.elapsedTime * 0.9) * 0.035 * pose.gridPulse;
      latticeRoot.scale.set(breathe, 1, breathe);

      latticeRoot.rotation.z = THREE.MathUtils.lerp(0, 0.09, cur.lineas);
      latticeRoot.rotation.y = THREE.MathUtils.lerp(0, -0.06, cur.oficio);

      bloomPass.strength = THREE.MathUtils.lerp(0.28, 0.58, pose.glow);
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      applyBeats(sample(), delta);

      if (!reduceMotion) {
        lineUniforms.uTime.value = elapsed;
        echoMat.uniforms.uTime.value = elapsed;
        emberUniforms.uTime.value = elapsed;
        featherUniforms.uTime.value = elapsed;
      }

      composer.render();
      frame = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      applyBeats(sample(), 1);
      composer.render();
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      if (finePointer) window.removeEventListener('pointermove', onPointerMove);
      latticeGeo.dispose();
      echoGeo.dispose();
      latticeMat.dispose();
      echoMat.dispose();
      emberGeo.dispose();
      emberMat.dispose();
      featherGeo.dispose();
      featherMat.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="atmosphere" aria-hidden="true" />;
}
