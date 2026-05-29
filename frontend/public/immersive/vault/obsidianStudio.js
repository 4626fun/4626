import * as THREE from 'three';

/**
 * Near-black studio PMREM — cool rim strips only, no warm gold softbox.
 * @param {THREE.WebGLRenderer} renderer
 */
export function makeObsidianStudioEnv(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#000001';
  ctx.fillRect(0, 0, 512, 256);

  // Thin cool rim from upper back-left
  let g = ctx.createRadialGradient(96, 48, 2, 96, 48, 140);
  g.addColorStop(0, 'rgba(210, 225, 255, 0.55)');
  g.addColorStop(0.35, 'rgba(120, 140, 180, 0.12)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Secondary cool strip upper-right
  g = ctx.createRadialGradient(420, 70, 2, 420, 70, 100);
  g.addColorStop(0, 'rgba(100, 120, 160, 0.18)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Very subtle warm floor edge (low right)
  g = ctx.createLinearGradient(300, 200, 512, 256);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(0.6, 'rgba(60, 48, 36, 0.08)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTex = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return envTex;
}

/**
 * Restrained black-studio lights.
 * @param {THREE.Scene} scene
 */
export function addObsidianStudioLights(scene) {
  scene.add(new THREE.AmbientLight(0x050609, 0.015));

  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.45);
  rim.position.set(-3.2, 2.2, -2.6);
  scene.add(rim);

  const warmEdge = new THREE.DirectionalLight(0x8a7158, 0.12);
  warmEdge.position.set(2.6, -1.1, 2.8);
  scene.add(warmEdge);
}
