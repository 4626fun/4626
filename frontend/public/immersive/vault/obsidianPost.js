import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as THREE from 'three';

/**
 * Restrained post stack — tiny glint bloom only.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {number} width
 * @param {number} height
 */
export function createObsidianComposer(renderer, scene, camera, width, height) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomSize = new THREE.Vector2(
    Math.min(width, 1024),
    Math.min(height, 1024),
  );
  const bloom = new UnrealBloomPass(bloomSize, 0.075, 0.35, 0.965);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return composer;
}
