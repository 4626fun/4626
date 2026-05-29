import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tuneGlbMaterials } from './obsidianMaterials.js';
import { buildProceduralObsidianVault } from './obsidianProcedural.js';

/**
 * Load obsidian vault GLB; fall back to procedural on any error.
 * @param {string} url
 * @returns {Promise<THREE.Group>}
 */
export async function loadObsidianVault(url) {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene.clone(true);
    root.scale.setScalar(1.05);
    tuneGlbMaterials(root);
    root.name = 'obsidian_vault_glb';
    return root;
  } catch (err) {
    console.warn('[obsidian-vault] GLB load failed, using procedural fallback:', url, err);
    return buildProceduralObsidianVault();
  }
}
