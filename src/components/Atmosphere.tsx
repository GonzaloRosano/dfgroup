import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Home-only living film still. Full-viewport textured plane with subtle
 * displacement, parallax UV drift, film grain, and a slow light sweep.
 *
 * Texture: /images/grupo-asphalt.jpg (wet asphalt, noir still).
 *
 * Scroll beats (data-atmosphere on index.astro):
 *   uHero     — parallax drift, sweep visible, open exposure
 *   uLines    — about + products: horizontal shear / UV stretch
 *   uPreview  — craft + contact: dims and tightens toward footer
 *
 * prefers-reduced-motion: static still, no time-driven effects.
 */

const TEXTURE_URL = '/images/grupo-asphalt.jpg';
const VOID = new THREE.Color(0x0d0d0d);

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vParallax;

  uniform float uTime;
  uniform float uMotion;
  uniform float uHero;
  uniform float uLines;
  uniform float uPreview;
  uniform float uHeroTravel;
  uniform vec2 uParallax;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vUv = uv;

    vec2 drift = uParallax * mix(0.018, 0.006, uPreview);
    drift.x += uLines * 0.014;
    drift.y -= uHeroTravel * uHero * 0.022;
    vParallax = uv + drift;

    vec3 pos = position;
    float dispAmp = uMotion * mix(0.028, 0.008, uPreview) * (0.55 + uHero * 0.45);
    float n = noise(uv * 3.4 + vec2(uTime * 0.04, uTime * 0.025));
    pos.z += (n - 0.5) * dispAmp;
    pos.z -= uHeroTravel * uHero * 0.08;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uMotion;
  uniform float uHero;
  uniform float uLines;
  uniform float uPreview;
  uniform vec3 uVoid;

  varying vec2 vUv;
  varying vec2 vParallax;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vParallax;

    float stretchX = 1.0 + uLines * 0.06;
    float stretchY = 1.0 - uPreview * 0.04;
    uv.x = (uv.x - 0.5) / stretchX + 0.5;
    uv.y = (uv.y - 0.5) / stretchY + 0.5;

    vec4 tex = texture2D(uMap, uv);
    vec3 col = tex.rgb;

    float sweep = sin((uv.x + uv.y * 0.35) * 6.2832 - uTime * 0.22) * 0.5 + 0.5;
    sweep = pow(sweep, 4.5) * uMotion * mix(0.08, 0.02, uPreview) * (0.4 + uHero * 0.6);
    col += vec3(0.07, 0.06, 0.05) * sweep;

    float grain = hash(uv * vec2(1920.0, 1080.0) + uTime * 120.0);
    grain = (grain - 0.5) * uMotion * mix(0.09, 0.04, uPreview);
    col += vec3(grain);

    float vig = smoothstep(0.95, 0.28, length((vUv - 0.5) * vec2(1.05, 0.92)));
    col *= mix(0.72, 0.92, vig);

    float dim = 1.0 - uPreview * 0.42 - uLines * 0.1;
    col *= dim;

    col = mix(uVoid, col, 0.88 + uHero * 0.12);

    float alpha = mix(0.55, 0.82, uHero) * vig;
    gl_FragColor = vec4(col, alpha);
  }
`;

function presence(el: Element, vh: number, pad: number) {
  const r = el.getBoundingClientRect();
  const top = r.top - pad;
  const bottom = r.bottom + pad;
  const overlap = Math.min(bottom, vh * 0.9) - Math.max(top, vh * 0.08);
  const denom = Math.max(72, Math.min(bottom - top, vh * 0.72));
  return THREE.MathUtils.clamp(overlap / denom, 0, 1);
}

function travel(el: Element, vh: number) {
  const r = el.getBoundingClientRect();
  return THREE.MathUtils.clamp(-r.top / Math.max(r.height * 0.85, vh * 0.65), 0, 1);
}

export default function Atmosphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
    camera.position.set(0, 0, 1.35);

    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    const texture = loader.load(TEXTURE_URL);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const uniforms = {
      uMap: { value: texture },
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uHero: { value: 1 },
      uLines: { value: 0 },
      uPreview: { value: 0 },
      uHeroTravel: { value: 0 },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uVoid: { value: VOID },
    };

    const geo = new THREE.PlaneGeometry(2.8, 1.75, 48, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const plane = new THREE.Mesh(geo, mat);
    scene.add(plane);

    const heroEl = document.querySelector('[data-atmosphere="hero"]');
    const aboutEl = document.querySelector('[data-atmosphere="about"]');
    const productsEl = document.querySelector('[data-atmosphere="products"]');
    const craftEl = document.querySelector('[data-atmosphere="craft"]');
    const contactEl = document.querySelector('[data-atmosphere="contact"]');

    const clock = new THREE.Clock();
    let frame = 0;
    let disposed = false;

    const cur = { hero: 1, lines: 0, preview: 0, travel: 0, px: 0, py: 0 };

    const sampleBeats = () => {
      const vh = window.innerHeight;
      let h = heroEl ? presence(heroEl, vh, 0) : 1;
      const about = aboutEl ? presence(aboutEl, vh, vh * 0.12) : 0;
      const products = productsEl ? presence(productsEl, vh, vh * 0.08) : 0;
      const craft = craftEl ? presence(craftEl, vh, vh * 0.06) : 0;
      const contact = contactEl ? presence(contactEl, vh, vh * 0.04) : 0;

      let l = about + products;
      let p = craft + contact;

      const sum = h + l + p;
      if (sum > 0.001) {
        h /= sum;
        l /= sum;
        p /= sum;
      } else {
        h = 1;
        l = 0;
        p = 0;
      }

      const t = heroEl ? travel(heroEl, vh) : 0;
      return { h, l, p, t };
    };

    const fitPlane = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);

      const pr = Math.min(window.devicePixelRatio, 1.5);
      renderer.setPixelRatio(pr);
    };

    const coverPlane = () => {
      const dist = camera.position.z;
      const vFov = (camera.fov * Math.PI) / 180;
      const visibleH = 2 * Math.tan(vFov / 2) * dist;
      const visibleW = visibleH * camera.aspect;
      const cover = Math.max(visibleW / 2.8, visibleH / 1.75) * 1.08;
      plane.scale.set(cover, cover, 1);
    };

    const ro = new ResizeObserver(() => {
      fitPlane();
      coverPlane();
      if (reduceMotion) renderer.render(scene, camera);
    });
    ro.observe(mount);
    fitPlane();
    coverPlane();

    const tick = () => {
      if (disposed) return;
      const delta = clock.getDelta();
      const beats = sampleBeats();
      const k = reduceMotion ? 0 : 9.2;

      cur.hero = THREE.MathUtils.damp(cur.hero, beats.h, k, delta);
      cur.lines = THREE.MathUtils.damp(cur.lines, beats.l, k, delta);
      cur.preview = THREE.MathUtils.damp(cur.preview, beats.p, k, delta);
      cur.travel = THREE.MathUtils.damp(cur.travel, beats.t, k, delta);

      const targetPx = cur.lines * 0.035 - cur.preview * 0.012;
      const targetPy = cur.travel * cur.hero * 0.04 - cur.preview * 0.018;
      cur.px = THREE.MathUtils.damp(cur.px, targetPx, k, delta);
      cur.py = THREE.MathUtils.damp(cur.py, targetPy, k, delta);

      uniforms.uHero.value = cur.hero;
      uniforms.uLines.value = cur.lines;
      uniforms.uPreview.value = cur.preview;
      uniforms.uHeroTravel.value = cur.travel;
      uniforms.uParallax.value.set(cur.px, cur.py);
      if (!reduceMotion) {
        uniforms.uTime.value = clock.elapsedTime;
      }

      const zT = 1.35 - cur.lines * 0.06 + cur.preview * 0.04;
      camera.position.z = THREE.MathUtils.damp(camera.position.z, zT, k, delta);
      coverPlane();

      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      const beats = sampleBeats();
      uniforms.uHero.value = beats.h;
      uniforms.uLines.value = beats.l;
      uniforms.uPreview.value = beats.p;
      uniforms.uHeroTravel.value = beats.t;
      renderer.render(scene, camera);
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      texture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="atmosphere" aria-hidden="true" />;
}
