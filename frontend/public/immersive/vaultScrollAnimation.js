// Scroll-driven vault open animation — ported from EthereumVaultHero.jsx
import * as THREE from 'three';

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Map window scroll to vault open progress (0 = sealed, 1 = fully open).
 */
export function getVaultOpenProgress() {
  const hero = document.querySelector('.hero');
  const reveal = document.querySelector('.reveal');
  const openStart = 0;
  const openEnd = reveal
    ? reveal.offsetTop + reveal.offsetHeight * 0.35
    : (hero ? hero.offsetTop + hero.offsetHeight : window.innerHeight);
  const range = Math.max(1, openEnd - window.innerHeight * 0.25);
  return clamp01((window.scrollY - openStart) / range);
}

export function cloneSceneWithUniqueMaterials(scene) {
  const clone = scene.clone(true);
  clone.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.frustumCulled = true;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        obj.material = mats.length === 1
          ? mats[0].clone()
          : mats.map((m) => m.clone());
        const tuned = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of tuned) mat.needsUpdate = true;
      }
      obj.userData.closedPosition = obj.position.clone();
      obj.userData.closedRotation = obj.rotation.clone();
      obj.userData.closedScale = obj.scale.clone();
    }
  });
  return clone;
}

export function retuneMaterial(material) {
  const name = (material.name || '').toLowerCase();
  const hasMaps = !!(material.map || material.emissiveMap || material.roughnessMap || material.metalnessMap);

  if (hasMaps) {
    if (name.includes('glass')) {
      material.transparent = true;
      material.opacity = Math.min(material.opacity || 0.42, 0.48);
      material.depthWrite = false;
      material.side = THREE.DoubleSide;
      material.envMapIntensity = 1.35;
    } else if (name.includes('glow') || name.includes('amber') || name.includes('vein')) {
      material.emissive = material.emissive || new THREE.Color('#b56a16');
      material.emissiveIntensity = Math.max(material.emissiveIntensity || 0, 0.12);
      material.envMapIntensity = 1.2;
    } else if (name.includes('chrome') || name.includes('bevel')) {
      material.metalness = 1.0;
      material.roughness = 0.14;
      material.envMapIntensity = 1.85;
    } else {
      material.metalness = Math.max(material.metalness || 0, 0.82);
      material.roughness = Math.min(material.roughness ?? 0.32, 0.36);
      material.envMapIntensity = 1.45;
    }
    if ('clearcoat' in material) {
      material.clearcoat = 0.92;
      material.clearcoatRoughness = 0.14;
    }
    material.needsUpdate = true;
    return;
  }

  if (name.includes('glass')) {
    material.color = new THREE.Color('#05070a');
    material.metalness = 0.0;
    material.roughness = 0.08;
    material.transparent = true;
    material.opacity = 0.42;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    material.envMapIntensity = 1.25;
  } else if (name.includes('glow') || name.includes('amber')) {
    material.color = new THREE.Color('#ba6f18');
    material.emissive = new THREE.Color('#b56a16');
    material.emissiveIntensity = 0.18;
    material.roughness = 0.18;
    material.metalness = 0.05;
  } else if (name.includes('vein')) {
    material.color = new THREE.Color('#7a4c18');
    material.emissive = new THREE.Color('#6e3e10');
    material.emissiveIntensity = 0.05;
    material.roughness = 0.24;
    material.metalness = 0.4;
  } else if (name.includes('chrome') || name.includes('bevel')) {
    material.color = new THREE.Color('#010103');
    material.metalness = 1.0;
    material.roughness = 0.16;
    material.envMapIntensity = 1.7;
  } else {
    material.color = new THREE.Color('#020204');
    material.metalness = 0.78;
    material.roughness = 0.30;
    material.envMapIntensity = 1.1;
  }

  if ('clearcoat' in material) {
    material.clearcoat = 0.95;
    material.clearcoatRoughness = 0.16;
  }

  material.needsUpdate = true;
}

export function collectMeshParts(root) {
  const parts = [];
  root.traverse((obj) => {
    if (obj.isMesh) parts.push(obj);
  });
  return parts;
}

const _targetCamera = new THREE.Vector3();

/**
 * Apply scroll-driven vault open state to named GLB meshes.
 */
export function applyVaultOpenState({
  parts,
  rootGroup,
  camera,
  progress,
  time,
  reducedMotion = false,
  pointerOffset = { x: 0, y: 0 },
  lightningBonus = 0,
  facetDrift = true,
}) {
  const raw = reducedMotion ? 0 : progress;
  const open = smoothstep(0.18, 0.78, raw);
  const reveal = smoothstep(0.36, 0.90, raw);
  const ceremony = reducedMotion ? 0 : Math.sin(time * 0.55) * 0.012;

  if (rootGroup) {
    rootGroup.rotation.y = lerp(0.5, 0.30, raw)
      + (reducedMotion ? 0 : Math.sin(time * 0.12) * 0.025)
      + pointerOffset.x * 0.04;
    rootGroup.rotation.x = lerp(-0.22, -0.04, raw) + pointerOffset.y * 0.025;
    rootGroup.position.y = ceremony + lerp(0.05, -0.06, raw);
    rootGroup.position.x = pointerOffset.x * 0.08;
    rootGroup.scale.setScalar(lerp(0.88, 1.08, smoothstep(0.10, 0.70, raw)));
  }

  if (camera) {
    _targetCamera.set(
      0,
      lerp(0.35, 0.55, raw),
      lerp(6.6, 4.85, smoothstep(0.06, 0.92, raw)),
    );
    camera.position.lerp(_targetCamera, 0.055);
    camera.lookAt(0, lerp(0.08, 0.22, raw), 0);
  }

  for (const obj of parts) {
    const name = obj.name.toLowerCase();
    const basePos = obj.userData.closedPosition;
    const baseRot = obj.userData.closedRotation;
    const baseScale = obj.userData.closedScale;

    if (basePos) obj.position.copy(basePos);
    if (baseRot) obj.rotation.copy(baseRot);
    if (baseScale) obj.scale.copy(baseScale);

    const isTop = name.startsWith('top_');
    const isBottom = name.startsWith('bottom_');
    const isLeft = name.includes('_left_') || name.startsWith('left_');
    const isRight = name.includes('_right_') || name.startsWith('right_');
    const isSeam = name.startsWith('seam_');
    const isCore = name.includes('inner_core');
    const isVein = name.includes('vein');

    if (isTop) {
      obj.position.y += open * 0.42;
      obj.position.z += open * 0.22;
      obj.rotation.x -= open * 0.055;
    }

    if (isBottom) {
      obj.position.y -= open * 0.42;
      obj.position.z += open * 0.22;
      obj.rotation.x += open * 0.055;
    }

    if (facetDrift && isLeft) {
      obj.position.x -= open * 0.08;
      obj.rotation.z += open * 0.035;
    }

    if (facetDrift && isRight) {
      obj.position.x += open * 0.08;
      obj.rotation.z -= open * 0.035;
    }

    if (isSeam) {
      obj.position.z += reveal * 0.09;
      obj.scale.x = lerp(1.0, 0.88, reveal);
    }

    if (isCore) {
      obj.position.z += reveal * 0.26;
      obj.scale.setScalar(lerp(0.35, 1.25, reveal));
    }

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || mat.emissiveIntensity === undefined) continue;
      if (isCore || isSeam) {
        mat.emissiveIntensity = lerp(0.08, 0.58, reveal)
          + (reducedMotion ? 0 : Math.sin(time * 1.4) * 0.025)
          + lightningBonus;
      } else if (isVein) {
        mat.emissiveIntensity = lerp(0.015, 0.075, reveal) + lightningBonus * 0.35;
      }
    }
  }
}
