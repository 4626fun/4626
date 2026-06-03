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
  base.addColorStop(0, '#1a2030');
  base.addColorStop(0.5, '#0c1018');
  base.addColorStop(1, '#05070e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 256);

  const key = ctx.createRadialGradient(256, 56, 8, 256, 56, 240);
  key.addColorStop(0, 'rgba(220, 232, 255, 0.85)');
  key.addColorStop(0.5, 'rgba(130, 162, 222, 0.24)');
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

// --- Premium onyx (mirrors src/marketing/vaultMaterial.ts) ---
// Real CC0 dark-onyx PBR scan (ambientCG Onyx013) for elegant fine veins.
const _TEX_BASE = './assets/vault/textures/';
const _TEX_REPEAT = 2;
function loadOnyxTextures() {
  const loader = new THREE.TextureLoader();
  const setup = (tex, srgb) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(_TEX_REPEAT, _TEX_REPEAT);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };
  return {
    colorMap: setup(loader.load(`${_TEX_BASE}onyx_color.jpg`), true),
    roughnessMap: setup(loader.load(`${_TEX_BASE}onyx_rough.jpg`), false),
    normalMap: setup(loader.load(`${_TEX_BASE}onyx_normal.jpg`), false),
  };
}
function _meshVolume(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const s = box.getSize(new THREE.Vector3());
  return Math.max(s.x, 1e-4) * Math.max(s.y, 1e-4) * Math.max(s.z, 1e-4);
}

/** Re-skin GLB meshes as matte onyx; returns { veinMat, accents }. */
function applyPremiumObsidianVanilla(root) {
  const tex = loadOnyxTextures();
  const makeBody = () => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.72, 0.76, 0.84), map: tex.colorMap,
    roughness: 1, roughnessMap: tex.roughnessMap,
    metalness: 0, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
    clearcoat: 0, reflectivity: 0.42, envMapIntensity: 0.9,
    emissive: new THREE.Color('#0052ff'), emissiveMap: tex.colorMap, emissiveIntensity: 0,
  });
  const makeAccent = () => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.52, 0.58, 0.7), map: tex.colorMap,
    roughness: 1, roughnessMap: tex.roughnessMap,
    metalness: 0, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
    clearcoat: 0, reflectivity: 0.42, envMapIntensity: 0.9,
    // Equator seam stays dark stone — a steady blue glow here reads as a halo.
    emissive: new THREE.Color('#3d7bff'), emissiveIntensity: 0,
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
  // Compress the tall 1.62:1 bipyramid into a balanced ~1.3:1 obsidian gem and
  // size a touch larger while staying fully framed (never crop → dark "box").
  const base = 2.05 / maxDim;
  const vSquash = 0.82;
  group.scale.set(base, base * vSquash, base);
  group.position.set(-center.x * base, -center.y * base * vSquash, -center.z * base);
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
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = makeStudioEnv(renderer);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 100);
  camera.position.set(0, 0.35, 6.6);

  const key = new THREE.DirectionalLight(0xeef2ff, 1.5);
  key.position.set(2.5, 3.5, 2.5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fb4d8, 0.65);
  rim.position.set(-2.8, 1.2, -1.4);
  scene.add(rim);

  // Cool fill from below so the lower pyramid reads as a solid converging
  // crystal instead of a black under-mass.
  const underFill = new THREE.DirectionalLight(0x7088b8, 0.55);
  underFill.position.set(0.0, -2.6, 1.8);
  scene.add(underFill);

  // Rim / back light — crisp luminous edge separating the silhouette from sky.
  // Near-neutral white: a saturated blue back light throws blue specular streaks
  // across the facets that read as an energy "force field" beam.
  const backRim = new THREE.DirectionalLight(0xe9eef6, 1.45);
  backRim.position.set(-1.4, 2.6, -3.8);
  scene.add(backRim);
  const backRim2 = new THREE.DirectionalLight(0xdde4f0, 0.8);
  backRim2.position.set(1.8, -1.0, -3.4);
  scene.add(backRim2);

  scene.add(new THREE.AmbientLight(0x1a2233, 0.8));

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
      // Pure obsidian stone — no emissive veins, no seam glow. Lightning lives in
      // the sky, never as a blue "force field" beam on the crystal itself.
      obsidian.veinMat.emissiveIntensity = 0;
      for (const a of obsidian.accents) a.emissiveIntensity = 0;
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
