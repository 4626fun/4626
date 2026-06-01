// 4626.fun — obsidian vault hero (GLB) with storm env, lightning sync (no bloom).
// Fallback: legacy chamfered iron cube if GLB fails to load.

import * as THREE from 'three';
import { setConsoleFunction } from 'three';

setConsoleFunction(() => {});

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VAULT_GLB_URL = 'assets/vault/ethereum_vault.glb';
const VAULT_POSTER_URL = 'assets/vault/ethereum_vault_poster.png';

const host = document.getElementById('vault-canvas');
if (host) init(host);

function makeChamferedCube(size = 1.7, bevel = 0.06, segs = 8) {
  const half = size / 2;
  const geo = new THREE.BoxGeometry(size, size, size, segs, segs, segs);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const inner = half - bevel;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = THREE.MathUtils.clamp(v.x, -inner, inner);
    const cy = THREE.MathUtils.clamp(v.y, -inner, inner);
    const cz = THREE.MathUtils.clamp(v.z, -inner, inner);
    const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0) {
      const k = bevel / len;
      pos.setXYZ(i, cx + dx * k, cy + dy * k, cz + dz * k);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Cool neutral studio equirect — reads obsidian facets without a color cast. */
function makeStudioEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#0c1018');
  base.addColorStop(0.5, '#060810');
  base.addColorStop(1, '#03040a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);

  const key = ctx.createRadialGradient(256, 56, 8, 256, 56, 240);
  key.addColorStop(0, 'rgba(210, 224, 255, 0.55)');
  key.addColorStop(0.5, 'rgba(120, 150, 210, 0.16)');
  key.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return envTex;
}

// --- Premium obsidian (mirrors src/marketing/vaultMaterial.ts) ---
function _hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function _vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = _hash2(xi, yi), b = _hash2(xi + 1, yi);
  const c = _hash2(xi, yi + 1), d = _hash2(xi + 1, yi + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v);
}
function _fbm(x, y, freqs, ridged) {
  let sum = 0, amp = 0.5, norm = 0;
  for (const f of freqs) {
    let n = _vnoise(x * f, y * f);
    if (ridged) n = 1 - Math.abs(2 * n - 1);
    sum += n * amp; norm += amp; amp *= 0.5;
  }
  return sum / norm;
}
function _worley(x, y, freq) {
  const fx = x * freq, fy = y * freq;
  const gx = Math.floor(fx), gy = Math.floor(fy);
  let f1 = Infinity, f2 = Infinity, cellId = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = cx + _hash2(cx, cy);
      const py = cy + _hash2(cx + 57.3, cy + 131.7);
      const dx = px - fx, dy = py - fy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; cellId = _hash2(cx * 1.7 + 0.3, cy * 2.3 + 0.7); }
      else if (d < f2) { f2 = d; }
    }
  }
  return { f1, f2, cellId };
}
function createObsidianDetailTextures(size = 1024) {
  const repeat = 3;
  const fineFreqs = [60, 120, 240, 480];
  const facetFreqA = 8, facetFreqB = 18;
  const heights = new Float32Array(size * size);
  const creases = new Float32Array(size * size);
  const tones = new Float32Array(size * size);
  const sheens = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * repeat, v = (y / size) * repeat;
      const big = _worley(u, v, facetFreqA);
      const med = _worley(u, v, facetFreqB);
      const edgeA = THREE.MathUtils.smoothstep(big.f2 - big.f1, 0, 0.045);
      const edgeB = THREE.MathUtils.smoothstep(med.f2 - med.f1, 0, 0.035);
      const crease = (1 - edgeA) * 0.62 + (1 - edgeB) * 0.38;
      const facetTone = big.cellId * 0.6 + med.cellId * 0.25;
      const micro = _fbm(u, v, fineFreqs, true);
      const idx = y * size + x;
      heights[idx] = THREE.MathUtils.clamp(facetTone * 0.5 + micro * 0.18 + crease * 0.46, 0, 1);
      creases[idx] = crease;
      tones[idx] = facetTone;
      sheens[idx] = big.cellId;
    }
  }
  const rc = document.createElement('canvas'); rc.width = rc.height = size;
  const rctx = rc.getContext('2d'); const rimg = rctx.createImageData(size, size);
  const vc = document.createElement('canvas'); vc.width = vc.height = size;
  const vctx = vc.getContext('2d'); const vimg = vctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const crease = creases[i], tone = tones[i], sheen = sheens[i];
    const r = THREE.MathUtils.clamp(0.34 + crease * 0.26 + (1 - tone) * 0.08 - sheen * 0.12, 0.24, 0.7);
    const rv = Math.round(r * 255);
    rimg.data[i * 4] = rv; rimg.data[i * 4 + 1] = rv; rimg.data[i * 4 + 2] = rv; rimg.data[i * 4 + 3] = 255;
    const vein = THREE.MathUtils.smoothstep(crease, 0.72, 0.96) * THREE.MathUtils.smoothstep(tone, 0.5, 0.85);
    const cv = Math.round(vein * 255);
    vimg.data[i * 4] = cv; vimg.data[i * 4 + 1] = cv; vimg.data[i * 4 + 2] = cv; vimg.data[i * 4 + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0); vctx.putImageData(vimg, 0, 0);
  const STRENGTH = 2.6;
  const nc = document.createElement('canvas'); nc.width = nc.height = size;
  const nctx = nc.getContext('2d'); const nimg = nctx.createImageData(size, size);
  const at = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH;
      const dy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      nimg.data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      nimg.data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      nimg.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const finish = (cv, srgb) => {
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };
  return { roughnessMap: finish(rc, false), normalMap: finish(nc, false), veinMap: finish(vc, true) };
}
function _meshVolume(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const s = box.getSize(new THREE.Vector3());
  return Math.max(s.x, 1e-4) * Math.max(s.y, 1e-4) * Math.max(s.z, 1e-4);
}
/** Re-skin GLB meshes as matte obsidian; returns { veinMat, accents }. */
function applyPremiumObsidianVanilla(root) {
  const detail = createObsidianDetailTextures();
  const makeBody = () => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0a0d14'), roughness: 1, roughnessMap: detail.roughnessMap,
    metalness: 0, normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
    clearcoat: 0.12, clearcoatRoughness: 0.5, reflectivity: 0.32, envMapIntensity: 0.85,
    emissive: new THREE.Color('#0052ff'), emissiveMap: detail.veinMap, emissiveIntensity: 0,
  });
  const makeAccent = () => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0a1022'), roughness: 0.5, roughnessMap: detail.roughnessMap,
    metalness: 0, normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.38, 0.38),
    clearcoat: 0.1, clearcoatRoughness: 0.5, envMapIntensity: 0.8,
    emissive: new THREE.Color('#3d7bff'), emissiveIntensity: 0.2,
  });
  const meshes = [];
  root.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
  let bodyIdx = 0, bodyVol = -1;
  meshes.forEach((mesh, i) => { const vol = _meshVolume(mesh); if (vol > bodyVol) { bodyVol = vol; bodyIdx = i; } });
  const veinMat = makeBody();
  const accents = [];
  meshes.forEach((mesh, i) => {
    if (i === bodyIdx) { mesh.material = veinMat; }
    else { const a = makeAccent(); accents.push(a); mesh.material = a; }
  });
  return { veinMat, accents };
}

function collectEmissiveMaterials(root) {
  const mats = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => mats.push(m));
    else if (mat) mats.push(mat);
  });
  return mats;
}

function fitVaultGroup(group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const target = 4.0;
  const scale = target / maxDim;
  group.scale.setScalar(scale);
  group.position.sub(center.multiplyScalar(scale));
}

function buildLegacyCube(renderer, cubeGroup) {
  const geo = makeChamferedCube(1.7, 0.07, 6);
  const texLoader = new THREE.TextureLoader();
  const setupTex = (tex, srgb = false) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  };
  const mat = new THREE.MeshPhysicalMaterial({
    map: setupTex(texLoader.load('assets/vault_basecolor.jpg'), true),
    normalMap: setupTex(texLoader.load('assets/vault_normal.jpg')),
    normalScale: new THREE.Vector2(2.2, 2.2),
    roughnessMap: setupTex(texLoader.load('assets/vault_roughness.jpg')),
    roughness: 0.92,
    metalness: 0.92,
    emissiveMap: setupTex(texLoader.load('assets/vault_emissive.jpg'), true),
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.7,
    envMapIntensity: 0.95,
    clearcoat: 0.85,
    clearcoatRoughness: 0.25,
    fog: false,
  });
  cubeGroup.add(new THREE.Mesh(geo, mat));
  return [mat];
}

function showReducedMotionPoster(host) {
  host.innerHTML = '';
  const img = document.createElement('img');
  img.src = VAULT_POSTER_URL;
  img.alt = '';
  img.decoding = 'async';
  img.className = 'hero__vault-poster';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.style.pointerEvents = 'none';
  host.appendChild(img);
  host.classList.add('is-ready');
}

function init(host) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    showReducedMotionPoster(host);
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = makeStudioEnv(renderer);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 100);
  camera.position.set(0, 0.35, 6.6);

  const key = new THREE.DirectionalLight(0xeef2ff, 1.45);
  key.position.set(2.5, 3.5, 2.5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fb4d8, 0.6);
  rim.position.set(-2.8, 0.8, -1.8);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x0d1018, 1.0));

  const vaultGroup = new THREE.Group();
  scene.add(vaultGroup);

  let obsidian = null;
  let legacyMats = [];

  const loader = new GLTFLoader();
  loader.load(
    VAULT_GLB_URL,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      vaultGroup.add(model);
      fitVaultGroup(vaultGroup);
      obsidian = applyPremiumObsidianVanilla(vaultGroup);
      host.classList.add('is-ready');
    },
    undefined,
    () => {
      legacyMats = buildLegacyCube(renderer, vaultGroup);
      host.classList.add('is-ready');
    },
  );

  // No bloom: bloom spread a soft glow ring around the crystal silhouette
  // (the "halo"). Keep a minimal RenderPass + OutputPass pipeline for correct
  // tone mapping / sRGB, but emit zero additive glow.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);

  let mx = 0, my = 0, cx = 0, cy = 0, hasMouse = false;
  let scrollY = 0;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
    hasMouse = true;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  }, { passive: true });

  let lightningBonus = 0;
  let lightningPeak = 0;
  let lightningStartedAt = 0;
  window.addEventListener('vault:lightning', (e) => {
    const intensity = (e.detail && e.detail.intensity) || 1;
    lightningPeak = Math.max(lightningPeak, intensity * 2.2);
    lightningStartedAt = performance.now();
  });

  const clock = new THREE.Clock();
  let baseRotY = 0.5, baseRotX = -0.12;

  function tick() {
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    // obsdn-style continuous turntable.
    baseRotY += dt * 0.14;

    const elapsed = (performance.now() - lightningStartedAt) / 1000;
    if (lightningPeak > 0) {
      const env = Math.exp(-elapsed * 5.5);
      lightningBonus = lightningPeak * env;
      if (env < 0.02) {
        lightningPeak = 0;
        lightningBonus = 0;
      }
    }

    if (obsidian) {
      // Veins dark at idle; blue glow only on lightning. Seam keeps a faint pulse.
      obsidian.veinMat.emissiveIntensity = Math.min(2.6, lightningBonus);
      const accentGlow = 0.18 + Math.sin(t * 0.9) * 0.04 + lightningBonus * 0.55;
      for (const a of obsidian.accents) a.emissiveIntensity = accentGlow;
    }
    for (const m of legacyMats) {
      if (!('emissiveIntensity' in m)) continue;
      m.emissiveIntensity = 0.7 + Math.sin(t * 1.6) * 0.15 + lightningBonus;
    }

    const tx = hasMouse ? mx * 0.28 : 0;
    const ty = hasMouse ? my * 0.16 : 0;
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;

    vaultGroup.rotation.y = baseRotY + cx;
    vaultGroup.rotation.x = baseRotX + cy;

    vaultGroup.position.y = -scrollY * 0.0005;
    vaultGroup.position.x = cx * 0.1;

    composer.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
