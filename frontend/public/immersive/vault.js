// 4626.fun — obsidian vault hero (GLB) with storm env, bloom, lightning sync.
// Fallback: legacy chamfered iron cube if GLB fails to load.

import * as THREE from 'three';
import { setConsoleFunction } from 'three';

setConsoleFunction(() => {});

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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

/** Purple storm equirect — harmonizes with hero_loop.mp4 + lightning. */
function makePurpleStormEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#030208';
  ctx.fillRect(0, 0, 512, 256);

  let g = ctx.createRadialGradient(256, 80, 8, 256, 80, 220);
  g.addColorStop(0, 'rgba(90, 40, 160, 0.55)');
  g.addColorStop(0.45, 'rgba(40, 18, 80, 0.22)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  g = ctx.createRadialGradient(100, 40, 5, 100, 40, 140);
  g.addColorStop(0, 'rgba(120, 160, 255, 0.25)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
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
  const target = 1.75;
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
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = makePurpleStormEnv(renderer);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 100);
  camera.position.set(0, 0.35, 6.6);

  const key = new THREE.DirectionalLight(0xc8b0ff, 1.35);
  key.position.set(2.5, 3.5, 2.5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6b5ce0, 0.75);
  rim.position.set(-2.5, -0.5, 0.5);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x080612, 1.0));

  const vaultGroup = new THREE.Group();
  scene.add(vaultGroup);

  let emissiveMaterials = [];

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
      emissiveMaterials = collectEmissiveMaterials(vaultGroup);
      for (const m of emissiveMaterials) {
        if (m.emissive) m.emissive.multiplyScalar(1.0);
        if ('emissiveIntensity' in m) m.emissiveIntensity = Math.max(m.emissiveIntensity ?? 0, 0.5);
      }
      host.classList.add('is-ready');
    },
    undefined,
    () => {
      emissiveMaterials = buildLegacyCube(renderer, vaultGroup);
      host.classList.add('is-ready');
    },
  );

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 64),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.05;
  shadow.scale.set(1.3, 1, 0.5);
  scene.add(shadow);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.22, 0.55, 0.82);
  composer.addPass(bloom);
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
  let baseRotY = 0.5, baseRotX = -0.22;

  function tick() {
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    baseRotY += dt * 0.1;

    const elapsed = (performance.now() - lightningStartedAt) / 1000;
    if (lightningPeak > 0) {
      const env = Math.exp(-elapsed * 5.5);
      lightningBonus = lightningPeak * env;
      if (env < 0.02) {
        lightningPeak = 0;
        lightningBonus = 0;
      }
    }

    for (const m of emissiveMaterials) {
      if (!('emissiveIntensity' in m)) continue;
      const breath = 0.85 + Math.sin(t * 1.6) * 0.18 + Math.sin(t * 5.2) * 0.06;
      m.emissiveIntensity = breath + lightningBonus;
    }

    const tx = hasMouse ? mx * 0.6 : Math.sin(t * 0.32) * 0.1;
    const ty = hasMouse ? my * 0.36 : Math.sin(t * 0.5) * 0.06;
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;

    vaultGroup.rotation.y = baseRotY + cx;
    vaultGroup.rotation.x = baseRotX + cy;

    const bob = Math.sin(t * 0.7) * 0.04;
    vaultGroup.position.y = bob - scrollY * 0.0006;
    vaultGroup.position.x = cx * 0.16;

    composer.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
