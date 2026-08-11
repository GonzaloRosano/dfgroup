import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Noir wire lattice — 3D line geometry with scroll-driven camera and warp.
 * No textures, no fullscreen post shader, no particles.
 *
 * Sections: #inicio #grupo #lineas #oficio #contacto
 */

const VOID = 0x0d0d0d;
const EMBER = new THREE.Color(0xc45a4a);
const BONE = new THREE.Color(0xd4d4d8);

const LINE_VERT = /* glsl */ `
  attribute vec3 aOffset;
  uniform float uTime;
  uniform float uMotion;
  uniform float uBreath;
  uniform float uShear;
  uniform float uLift;

  varying float vDepth;
  varying float vAxis;

  void main() {
    vec3 p = position;

    float wave = sin(p.x * 1.6 + uTime * 0.55) * cos(p.z * 1.1 + uTime * 0.35);
    p.y += wave * uBreath * 0.14 * uMotion;
    p.x += sin(p.z * 0.9 + uTime * 0.4) * uShear * 0.22;
    p.y += uLift * 0.35;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vAxis = aOffset.x;
    gl_Position = projectionMatrix * mv;
  }
`;

const LINE_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform float uFade;
  uniform vec3 uEmber;
  uniform vec3 uBone;

  varying float vDepth;
  varying float vAxis;

  void main() {
    float depthFade = smoothstep(14.0, 2.5, vDepth);
    float axisMix = mix(0.55, 1.0, vAxis);
    vec3 col = mix(uBone * 0.35, uEmber, uGlow * axisMix);
    float alpha = depthFade * uFade * mix(0.22, 0.72, uGlow) * axisMix;
    gl_FragColor = vec4(col, alpha);
  }
`;

function buildLattice(cols: number, rows: number, width: number, depth: number) {
  const positions: number[] = [];
  const offsets: number[] = [];
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  for (let r = 0; r <= rows; r++) {
    const z = (r / rows) * depth - halfD;
    for (let c = 0; c < cols; c++) {
      const x0 = (c / cols) * width - halfW;
      const x1 = ((c + 1) / cols) * width - halfW;
      positions.push(x0, 0, z, x1, 0, z);
      offsets.push(0, 0, 1, 1);
    }
  }

  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * width - halfW;
    for (let r = 0; r < rows; r++) {
      const z0 = (r / rows) * depth - halfD;
      const z1 = ((r + 1) / rows) * depth - halfD;
      positions.push(x, 0, z0, x, 0, z1);
      offsets.push(1, 1, 1, 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aOffset', new THREE.Float32BufferAttribute(offsets, 1));
  return geo;
}

function sectionPresence(el: Element | null, vh: number) {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const overlap = Math.min(r.bottom, vh * 0.88) - Math.max(r.top, vh * 0.1);
  return THREE.MathUtils.clamp(overlap / Math.max(r.height * 0.65, vh * 0.45), 0, 1);
}

export default function Atmosphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(VOID, 0.07);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 40);
    camera.position.set(0, 2.8, 5.2);
    camera.lookAt(0, 0, -0.5);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uBreath: { value: 1 },
      uShear: { value: 0 },
      uLift: { value: 0 },
      uGlow: { value: 0.35 },
      uFade: { value: 0.85 },
      uEmber: { value: EMBER },
      uBone: { value: BONE },
    };

    const latticeGeo = buildLattice(28, 20, 9, 7);
    latticeGeo.rotateX(-0.55);
    latticeGeo.translate(0, -0.4, -0.8);

    const latticeMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const lattice = new THREE.LineSegments(latticeGeo, latticeMat);
    scene.add(lattice);

    const sections = {
      inicio: document.getElementById('inicio'),
      grupo: document.getElementById('grupo'),
      lineas: document.getElementById('lineas'),
      oficio: document.getElementById('oficio'),
      contacto: document.getElementById('contacto'),
    };

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const cur = { inicio: 1, grupo: 0, lineas: 0, oficio: 0, contacto: 0 };
    const cam = { y: 2.8, z: 5.2, rx: -0.55 };

    const sample = () => {
      const vh = window.innerHeight;
      return {
        inicio: sectionPresence(sections.inicio, vh),
        grupo: sectionPresence(sections.grupo, vh),
        lineas: sectionPresence(sections.lineas, vh),
        oficio: sectionPresence(sections.oficio, vh),
        contacto: sectionPresence(sections.contacto, vh),
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

    const ro = new ResizeObserver(() => {
      fit();
      if (reduceMotion) renderer.render(scene, camera);
    });
    ro.observe(mount);
    fit();

    const applyBeats = (beats: ReturnType<typeof sample>, delta: number) => {
      const k = reduceMotion ? 0 : 8.5;
      cur.inicio = THREE.MathUtils.damp(cur.inicio, beats.inicio, k, delta);
      cur.grupo = THREE.MathUtils.damp(cur.grupo, beats.grupo, k, delta);
      cur.lineas = THREE.MathUtils.damp(cur.lineas, beats.lineas, k, delta);
      cur.oficio = THREE.MathUtils.damp(cur.oficio, beats.oficio, k, delta);
      cur.contacto = THREE.MathUtils.damp(cur.contacto, beats.contacto, k, delta);

      uniforms.uBreath.value = THREE.MathUtils.lerp(
        1.0,
        0.35,
        THREE.MathUtils.clamp(cur.grupo + cur.lineas * 0.5, 0, 1),
      );
      uniforms.uShear.value = THREE.MathUtils.lerp(0, 1, cur.lineas);
      uniforms.uLift.value = THREE.MathUtils.lerp(0, 0.6, cur.oficio);
      uniforms.uGlow.value = THREE.MathUtils.lerp(
        0.3,
        0.95,
        THREE.MathUtils.clamp(cur.lineas * 0.7 + cur.oficio * 0.4, 0, 1),
      );
      uniforms.uFade.value = THREE.MathUtils.lerp(0.9, 0.35, cur.contacto);

      const targetCamY = THREE.MathUtils.lerp(2.8, 1.6, cur.grupo + cur.lineas * 0.35);
      const targetCamZ = THREE.MathUtils.lerp(5.2, 4.1, cur.lineas + cur.oficio * 0.3);
      cam.y = THREE.MathUtils.damp(cam.y, targetCamY, k, delta);
      cam.z = THREE.MathUtils.damp(cam.z, targetCamZ, k, delta);
      camera.position.set(0, cam.y, cam.z);
      camera.lookAt(0, -0.2 + cur.oficio * 0.15, -0.8 - cur.contacto * 0.4);

      lattice.rotation.z = THREE.MathUtils.lerp(0, 0.08, cur.lineas);
      lattice.rotation.y = THREE.MathUtils.lerp(0, -0.05, cur.oficio);
    };

    const tick = () => {
      if (disposed) return;
      const delta = clock.getDelta();
      applyBeats(sample(), delta);
      if (!reduceMotion) uniforms.uTime.value = clock.elapsedTime;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      applyBeats(sample(), 1);
      renderer.render(scene, camera);
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      latticeGeo.dispose();
      latticeMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="atmosphere" aria-hidden="true" />;
}
