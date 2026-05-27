// 4626.fun — minimal-luxury cube hero
// Pure dark studio, the cube IS the page. Real HDRI environment for studio
// reflections, chamfered geometry, edge highlights, slow rotation, mouse
// parallax, scroll parallax. Apple keynote energy.

import * as THREE from 'three';
import { setConsoleFunction } from 'three';

// Marketing homepage: keep DevTools clean (ANGLE/HLSL program-info noise, etc.).
setConsoleFunction(() => {});

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const host = document.getElementById('vault-canvas');
if (host) init(host);

// ---------- Chamfered cube geometry ----------
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

// ---------- Build a procedural studio HDR environment ----------
// We construct a small canvas-based environment map: dark with one warm
// softbox above and a subtle rim glow. Used as scene.environment so the cube
// gets real reflections on its bevels.
function makeStudioEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');

  // Pure black base
  ctx.fillStyle = '#020203';
  ctx.fillRect(0, 0, 512, 256);

  // Warm overhead softbox (top center, fades down)
  let g = ctx.createRadialGradient(256, 30, 5, 256, 30, 200);
  g.addColorStop(0, 'rgba(255, 200, 130, 0.85)');
  g.addColorStop(0.4, 'rgba(255, 170, 90, 0.32)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Cool secondary fill from upper-left
  g = ctx.createRadialGradient(80, 60, 5, 80, 60, 160);
  g.addColorStop(0, 'rgba(150, 175, 230, 0.4)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Faint warm horizon line at ~70% height (suggests floor reflection)
  g = ctx.createLinearGradient(0, 180, 0, 220);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(80, 60, 40, 0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 180, 512, 40);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return envTex;
}

function init(host) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  // Sharp high-DPI rendering. Cap at 2x for cost reasons but use full pixelRatio
  // when available so brushed-metal micro-detail and cross filigree stay crisp.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = makeStudioEnv(renderer);

  // No scene fog. The cube must be crystal clear and fully opaque — fog
  // would tint cube faces toward the sky color and reduce material clarity.
  // Background composition handled by CSS/video, not renderer fog.

  // Pull camera back and narrow FOV so the cube sits in the middle of the
  // canvas with breathing room on every side — no visible canvas edge.
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 100);
  camera.position.set(0, 0.35, 6.6);

  // ---------- lighting ----------
  // The HDRI environment carries most of the look; lights add directional bite.
  // Warm gold key from upper-right (matches the god rays in the backdrop)
  const key = new THREE.DirectionalLight(0xffd6a0, 1.5);
  key.position.set(2.5, 3.5, 2.5);
  scene.add(key);

  // Cool blue rim from below-left (atmospheric haze bouncing back)
  const rim = new THREE.DirectionalLight(0x6b8de0, 0.6);
  rim.position.set(-2.5, -0.5, 0.5);
  scene.add(rim);

  // Faint warm bottom fill (gold horizon glow)
  const fill = new THREE.DirectionalLight(0xc88450, 0.4);
  fill.position.set(0, -2.5, 1.0);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0x05060a, 1.0));

  // ---------- cube with full PBR texture set ----------
  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const geo = makeChamferedCube(1.7, 0.07, 6);

  // Load PBR maps
  const texLoader = new THREE.TextureLoader();
  const setupTex = (tex, srgb = false) => {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  };
  const baseColorMap = setupTex(texLoader.load('assets/vault_basecolor.jpg'), true);
  const normalMap    = setupTex(texLoader.load('assets/vault_normal.jpg'));
  const roughnessMap = setupTex(texLoader.load('assets/vault_roughness.jpg'));
  const emissiveMap  = setupTex(texLoader.load('assets/vault_emissive.jpg'), true);

  // Premium PBR material — crystal clear, fully opaque, every channel pumped
  // for finest detail. The brushed iron base reads sharply, the gold cross +
  // blue lightning veins glow with controlled bloom, and the clearcoat lacquer
  // gives a museum-display sheen.  Emissive is RESTRAINED so the iron
  // substrate — the rivets, hammered patina, edge frame — stays the hero of
  // the surface; the glow is an accent, not the dominant feature.
  const mat = new THREE.MeshPhysicalMaterial({
    map: baseColorMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(2.2, 2.2),  // sharp surface micro-detail
    roughnessMap: roughnessMap,
    roughness: 0.92,
    metalness: 0.92,             // richly metallic
    metalnessMap: roughnessMap,
    emissiveMap: emissiveMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.7,      // restrained glow — substrate stays visible
    envMapIntensity: 0.95,       // strong environment reflection
    clearcoat: 0.85,             // strong gloss lacquer
    clearcoatRoughness: 0.25,    // mirror-like clearcoat finish
    reflectivity: 0.6,
    fog: false,
  });
  const cube = new THREE.Mesh(geo, mat);
  cubeGroup.add(cube);

  // Soft elliptical floor shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 64),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.05;
  shadow.scale.set(1.3, 1, 0.5);
  scene.add(shadow);

  // ---------- post: stronger bloom for the glowing seams ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Bloom on the gold cross + blue lightning emissive seams. Tuned so the
  // seams glow but the brushed iron substrate stays the dominant material.
  // Bloom is the main culprit behind the visible rectangular halo around
  // the canvas: it spreads bright pixels across the whole canvas, and the
  // canvas edge becomes visible as a hard rectangle when the bloom dies.
  // Keep bloom very subtle — the CSS .hero__cube-halo behind the canvas
  // provides most of the visible "glow bleeding into the scene" effect.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.18, 0.55, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- resize ----------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);

  // ---------- interaction ----------
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mx = 0, my = 0, cx = 0, cy = 0, hasMouse = false;
  let scrollY = 0;

  document.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5);
    my = (e.clientY / window.innerHeight - 0.5);
    hasMouse = true;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  }, { passive: true });

  // ---------- lightning sympathetic flash ----------
  // The page fires a 'vault:lightning' event when a bolt strikes.
  // We keep a lightning bonus that decays over ~700ms, added on top of
  // the breathing emissive intensity so the cube's seams flare with the sky.
  let lightningBonus = 0;
  let lightningPeak = 0;
  let lightningStartedAt = 0;
  window.addEventListener('vault:lightning', (e) => {
    const intensity = (e.detail && e.detail.intensity) || 1;
    lightningPeak = Math.max(lightningPeak, intensity * 1.8);
    lightningStartedAt = performance.now();
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  // Start at a satisfying 3/4 hero angle (OBSDN-style)
  let baseRotY = 0.5, baseRotX = -0.22;

  function tick() {
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    // Slow elegant rotation — more contemplative than spinny
    if (!reduce) baseRotY += dt * 0.10;

    // Compute lightning bonus envelope (fast attack, slow decay)
    const elapsed = (performance.now() - lightningStartedAt) / 1000;
    if (lightningPeak > 0) {
      // Two-phase envelope: spike then decay
      const env = Math.exp(-elapsed * 5.5);
      lightningBonus = lightningPeak * env;
      if (env < 0.02) { lightningPeak = 0; lightningBonus = 0; }
    }

    // Pulse emissive intensity to make the seams breathe + react to lightning
    if (mat) {
      const breath = 1.15 + Math.sin(t * 1.6) * 0.22 + Math.sin(t * 5.2) * 0.08;
      mat.emissiveIntensity = breath + lightningBonus;
    }

    const tx = hasMouse ? mx * 0.6 : Math.sin(t * 0.32) * 0.10;
    const ty = hasMouse ? my * 0.36 : Math.sin(t * 0.5) * 0.06;
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;

    cubeGroup.rotation.y = baseRotY + cx;
    cubeGroup.rotation.x = baseRotX + cy;

    const bob = reduce ? 0 : Math.sin(t * 0.7) * 0.04;
    cubeGroup.position.y = bob - scrollY * 0.0006;
    cubeGroup.position.x = cx * 0.16;

    composer.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  requestAnimationFrame(() => host.classList.add('is-ready'));
}
