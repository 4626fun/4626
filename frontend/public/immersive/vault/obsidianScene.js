import * as THREE from 'three';
import { setConsoleFunction } from 'three';
import { makeObsidianStudioEnv, addObsidianStudioLights } from './obsidianStudio.js';
import { buildProceduralObsidianVault } from './obsidianProcedural.js';
import { loadObsidianVault } from './obsidianGlb.js';
import { createObsidianComposer } from './obsidianPost.js';

setConsoleFunction(() => {});

const DEFAULT_GLB_URL = 'assets/models/obsidian-vault.glb';

function resolveDevicePixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const mobile = window.matchMedia('(max-width: 768px)').matches;
  return mobile ? Math.min(dpr, 1.75) : Math.min(dpr, 2);
}

/**
 * @param {HTMLElement} host
 * @param {{ mode?: 'procedural' | 'glb'; glbUrl?: string }} [options]
 */
export async function initObsidianVault(host, options = {}) {
  const mode = options.mode === 'glb' ? 'glb' : 'procedural';
  const glbUrl = options.glbUrl || DEFAULT_GLB_URL;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(resolveDevicePixelRatio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const envTex = makeObsidianStudioEnv(renderer);
  scene.environment = envTex;
  addObsidianStudioLights(scene);

  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 80);
  camera.position.set(0, 0.28, 5.7);

  const vaultGroup = new THREE.Group();
  scene.add(vaultGroup);

  const vaultObject =
    mode === 'glb'
      ? await loadObsidianVault(glbUrl)
      : buildProceduralObsidianVault();
  vaultGroup.add(vaultObject);

  let composer = createObsidianComposer(
    renderer,
    scene,
    camera,
    host.clientWidth || 640,
    host.clientHeight || 640,
  );

  const disposables = [];

  function collectDisposables(object) {
    object.traverse((child) => {
      if (child.geometry) disposables.push(child.geometry);
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        disposables.push(mat);
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && val.isTexture) disposables.push(val);
        }
      }
    });
  }
  collectDisposables(vaultObject);

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
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let mx = 0;
  let my = 0;
  let cx = 0;
  let cy = 0;
  let hasMouse = false;
  let scrollY = 0;

  const onMouseMove = (e) => {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
    hasMouse = true;
  };
  const onScroll = () => {
    scrollY = window.scrollY;
  };
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  let shimmerBonus = 0;
  let shimmerPeak = 0;
  let shimmerStartedAt = 0;
  const glowMeshes = [];
  vaultObject.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const name = `${child.name}`.toLowerCase();
    if (/glow|emission|seam|mark/.test(name)) glowMeshes.push(child);
  });

  const onLightning = (e) => {
    const intensity = (e.detail && e.detail.intensity) || 1;
    shimmerPeak = Math.max(shimmerPeak, intensity * 0.02);
    shimmerStartedAt = performance.now();
  };
  window.addEventListener('vault:lightning', onLightning);

  const clock = new THREE.Clock();
  let baseRotY = 0.62;
  let baseRotX = -0.22;
  let rafId = 0;
  let visible = true;

  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            visible = entries.some((e) => e.isIntersecting);
          },
          { threshold: 0.05 },
        )
      : null;
  io?.observe(host);

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (!visible) return;

    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    if (!reduce) baseRotY += dt * 0.045;

    const elapsed = (performance.now() - shimmerStartedAt) / 1000;
    if (shimmerPeak > 0) {
      const env = Math.exp(-elapsed * 6.5);
      shimmerBonus = shimmerPeak * env;
      if (env < 0.01) {
        shimmerPeak = 0;
        shimmerBonus = 0;
      }
    }

    for (const mesh of glowMeshes) {
      const mat = mesh.material;
      if (!mat || !('emissiveIntensity' in mat)) continue;
      const base = mat.userData?._baseEmissive ?? mat.emissiveIntensity ?? 0;
      if (mat.userData._baseEmissive == null) mat.userData._baseEmissive = base;
      mat.emissiveIntensity = base + shimmerBonus;
    }

    const tx = hasMouse ? mx * 0.09 : Math.sin(t * 0.32) * 0.04;
    const ty = hasMouse ? -my * 0.045 : Math.sin(t * 0.5) * 0.025;
    cx = THREE.MathUtils.damp(cx, tx, 2.8, dt);
    cy = THREE.MathUtils.damp(cy, ty, 2.8, dt);

    vaultGroup.rotation.y = baseRotY + cx;
    vaultGroup.rotation.x = baseRotX + cy;

    const bob = reduce ? 0 : Math.sin(t * 0.48) * 0.025;
    vaultGroup.position.y = bob - scrollY * 0.0004;
    vaultGroup.position.x = cx * 0.06;

    composer.render();
  }
  rafId = requestAnimationFrame(tick);
  requestAnimationFrame(() => host.classList.add('is-ready'));

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('vault:lightning', onLightning);
      composer.dispose();
      envTex.dispose();
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    },
  };
}
