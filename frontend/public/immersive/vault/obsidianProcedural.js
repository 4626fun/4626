import * as THREE from 'three';
import { createObsidianMaterial } from './obsidianMaterials.js';

/**
 * Chamfered cube with rounded edges.
 * @param {number} size
 * @param {number} bevel
 * @param {number} segs
 */
export function makeChamferedCube(size = 1.72, bevel = 0.115, segs = 12) {
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
    const dx = v.x - cx;
    const dy = v.y - cy;
    const dz = v.z - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0) {
      const k = bevel / len;
      pos.setXYZ(i, cx + dx * k, cy + dy * k, cz + dz * k);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * @param {'front' | 'right' | 'top'} face
 * @param {boolean} subtle
 */
function createFaceFrame(face, subtle = false) {
  const group = new THREE.Group();
  const z = 0.895;
  const inset = 0.52;
  const length = 1.06;
  const thick = 0.018;
  const depth = 0.012;
  const bars = [
    { p: [0, inset, z], s: [length, thick, depth] },
    { p: [0, -inset, z], s: [length, thick, depth] },
    { p: [inset, 0, z], s: [thick, length, depth] },
    { p: [-inset, 0, z], s: [thick, length, depth] },
  ];

  const transforms = {
    front: {
      r: [0, 0, 0],
      map: ([x, y, zz]) => [x, y, zz],
      scale: ([x, y, zz]) => [x, y, zz],
    },
    right: {
      r: [0, Math.PI / 2, 0],
      map: ([x, y, zz]) => [zz, y, -x],
      scale: ([x, y, zz]) => [zz, y, x],
    },
    top: {
      r: [-Math.PI / 2, 0, 0],
      map: ([x, y, zz]) => [x, zz, -y],
      scale: ([x, y, zz]) => [x, zz, y],
    },
  }[face];

  const mat = createObsidianMaterial('seam', { subtle });
  for (const bar of bars) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...transforms.map(bar.p));
    mesh.scale.set(...transforms.scale(bar.s));
    mesh.rotation.set(...transforms.r);
    group.add(mesh);
  }
  return group;
}

function createHiddenMarkTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(8, 10, 14, 0.55)';
  ctx.font = '600 72px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('4626', size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @returns {THREE.Group} */
export function buildProceduralObsidianVault() {
  const root = new THREE.Group();
  root.name = 'obsidian_vault_procedural';

  const coreGeo = makeChamferedCube(1.72, 0.115, 12);
  const core = new THREE.Mesh(coreGeo, createObsidianMaterial('core'));
  core.name = 'obsidian_vault_core';
  root.add(core);

  root.add(createFaceFrame('front', false));
  root.add(createFaceFrame('right', true));
  root.add(createFaceFrame('top', true));

  const markTex = createHiddenMarkTexture();
  const markGeo = new THREE.PlaneGeometry(0.42, 0.16);
  const mark = new THREE.Mesh(markGeo, createObsidianMaterial('mark'));
  mark.material.map = markTex;
  mark.material.transparent = true;
  mark.material.opacity = 0.34;
  mark.position.set(0, -0.03, 0.905);
  mark.name = 'hidden_4626_mark';
  root.add(mark);

  const shellGeo = makeChamferedCube(1.84, 0.145, 14);
  const shell = new THREE.Mesh(shellGeo, createObsidianMaterial('shell'));
  shell.name = 'smoked_glass_outer_shell';
  shell.renderOrder = 1;
  root.add(shell);

  return root;
}
