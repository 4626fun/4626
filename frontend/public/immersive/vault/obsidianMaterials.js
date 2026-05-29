import * as THREE from 'three';

/** @typedef {'core' | 'shell' | 'seam' | 'glow' | 'mark'} ObsidianMaterialRole */

const COLORS = {
  core: '#010103',
  shell: '#000004',
  seam: '#020204',
  seamSubtle: '#010102',
  glow: '#080b10',
  mark: '#010102',
};

/**
 * @param {ObsidianMaterialRole | string} role
 * @param {{ envMapIntensity?: number; subtle?: boolean }} [opts]
 */
export function createObsidianMaterial(role, opts = {}) {
  const subtle = opts.subtle === true;

  if (role === 'shell') {
    return new THREE.MeshPhysicalMaterial({
      color: COLORS.shell,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      metalness: 0,
      roughness: 0.055,
      transmission: 0.2,
      thickness: 0.42,
      ior: 1.48,
      attenuationColor: new THREE.Color('#000003'),
      attenuationDistance: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      envMapIntensity: opts.envMapIntensity ?? 2.25,
      fog: false,
    });
  }

  if (role === 'seam') {
    return new THREE.MeshPhysicalMaterial({
      color: subtle ? COLORS.seamSubtle : COLORS.seam,
      metalness: subtle ? 0.25 : 0.94,
      roughness: subtle ? 0.44 : 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: subtle ? new THREE.Color('#05070a') : new THREE.Color('#000000'),
      emissiveIntensity: subtle ? 0.018 : 0,
      envMapIntensity: opts.envMapIntensity ?? 1.35,
      fog: false,
    });
  }

  if (role === 'glow') {
    return new THREE.MeshPhysicalMaterial({
      color: COLORS.core,
      emissive: new THREE.Color(COLORS.glow),
      emissiveIntensity: 0.025,
      roughness: 0.42,
      metalness: 0.55,
      clearcoat: 0.7,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.2,
      fog: false,
    });
  }

  if (role === 'mark') {
    return new THREE.MeshBasicMaterial({
      color: COLORS.mark,
      transparent: true,
      opacity: 0.34,
      toneMapped: false,
      fog: false,
    });
  }

  return new THREE.MeshPhysicalMaterial({
    color: COLORS.core,
    metalness: 0.88,
    roughness: 0.29,
    clearcoat: 0.95,
    clearcoatRoughness: 0.15,
    envMapIntensity: opts.envMapIntensity ?? 1.65,
    fog: false,
  });
}

/**
 * Retune GLB mesh materials by name / userData role.
 * @param {THREE.Object3D} root
 */
export function tuneGlbMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.geometry?.computeVertexNormals?.();

    const name = `${child.name || ''} ${child.userData?.role || ''}`.toLowerCase();
    const mats = Array.isArray(child.material) ? child.material : [child.material];

    for (const mat of mats) {
      if (!mat) continue;
      mat.fog = false;

      if (/shell|glass|smoked|outer/.test(name)) {
        applyShellTuning(mat);
      } else if (/emission|glow|hidden|mark/.test(name)) {
        applyGlowTuning(mat);
      } else if (/seam|bevel|chrome|frame|bar/.test(name)) {
        applySeamTuning(mat, /subtle|side|top|right/.test(name));
      } else {
        applyCoreTuning(mat);
      }
    }
  });
}

/** @param {THREE.Material} material */
function applyCoreTuning(material) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return;
  material.color.set(COLORS.core);
  material.metalness = 0.88;
  material.roughness = 0.29;
  material.clearcoat = 0.95;
  material.clearcoatRoughness = 0.15;
  material.envMapIntensity = 1.55;
  material.needsUpdate = true;
}

/** @param {THREE.Material} material */
function applyShellTuning(material) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return;
  material.transparent = true;
  material.opacity = 0.2;
  material.depthWrite = false;
  material.metalness = 0;
  material.roughness = 0.055;
  material.color.set(COLORS.shell);
  material.clearcoat = 1;
  material.clearcoatRoughness = 0.055;
  material.ior = 1.48;
  material.transmission = Math.min(material.transmission ?? 0.18, 0.22);
  material.thickness = 0.42;
  material.attenuationColor = new THREE.Color('#000003');
  material.attenuationDistance = 0.55;
  material.envMapIntensity = 2.25;
  material.needsUpdate = true;
}

/** @param {THREE.Material} material @param {boolean} subtle */
function applySeamTuning(material, subtle) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return;
  material.color.set(subtle ? COLORS.seamSubtle : COLORS.seam);
  material.metalness = subtle ? 0.25 : 0.94;
  material.roughness = subtle ? 0.44 : 0.18;
  material.clearcoat = 1;
  material.clearcoatRoughness = 0.12;
  material.emissive = new THREE.Color(subtle ? '#05070a' : '#000000');
  material.emissiveIntensity = subtle ? 0.018 : 0;
  material.envMapIntensity = 1.35;
  material.needsUpdate = true;
}

/** @param {THREE.Material} material */
function applyGlowTuning(material) {
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.color.set(COLORS.core);
    material.emissive = new THREE.Color(COLORS.glow);
    material.emissiveIntensity = 0.025;
    material.roughness = 0.42;
    material.needsUpdate = true;
  }
}

export { COLORS };
