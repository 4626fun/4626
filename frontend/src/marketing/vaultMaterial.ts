import * as THREE from 'three'

/**
 * Premium obsidian look for the marketing vault hero.
 *
 * Uses a real CC0 dark-onyx PBR scan (ambientCG "Onyx013" — black/dark, fine
 * flowing veins) for an elegant, modern, finely-detailed surface — NOT a glossy
 * plastic shell. The stone reads matte-satin; sparse Base-blue glow rides the
 * natural bright veins and only spikes on lightning beats.
 */

const TEX_BASE = '/immersive/assets/vault/textures/'
// Cool multiply tint over the onyx albedo: keeps a dark obsidian-blue read but
// stays bright enough that the fine veins are actually visible (a near-black
// tint buries the detail and the crystal reads as a muddy blob).
const BODY_TINT = new THREE.Color(0.72, 0.76, 0.84)
const ACCENT_TINT = new THREE.Color(0.52, 0.58, 0.7)
const VEIN_EMISSIVE = '#0052ff'
const ACCENT_EMISSIVE = '#3d7bff'
// Higher repeat → finer veins; the onyx scan is seamless so tiling is clean.
const TEX_REPEAT = 2

type OnyxTextures = {
  colorMap: THREE.Texture
  roughnessMap: THREE.Texture
  normalMap: THREE.Texture
  dispose: () => void
}

function loadOnyxTextures(): OnyxTextures {
  const loader = new THREE.TextureLoader()
  const setup = (tex: THREE.Texture, srgb: boolean): THREE.Texture => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(TEX_REPEAT, TEX_REPEAT)
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }
  const colorMap = setup(loader.load(`${TEX_BASE}onyx_color.jpg`), true)
  const roughnessMap = setup(loader.load(`${TEX_BASE}onyx_rough.jpg`), false)
  const normalMap = setup(loader.load(`${TEX_BASE}onyx_normal.jpg`), false)
  return {
    colorMap,
    roughnessMap,
    normalMap,
    dispose: () => {
      colorMap.dispose()
      roughnessMap.dispose()
      normalMap.dispose()
    },
  }
}

export type PremiumObsidianResult = {
  /** Body material — veins glow blue, driven by lightning. */
  veinMat: THREE.MeshPhysicalMaterial
  /** Seam / accent materials — subtle steady blue glow. */
  accents: THREE.MeshPhysicalMaterial[]
  dispose: () => void
}

function meshVolume(mesh: THREE.Mesh): number {
  const box = new THREE.Box3().setFromObject(mesh)
  const s = box.getSize(new THREE.Vector3())
  return Math.max(s.x, 1e-4) * Math.max(s.y, 1e-4) * Math.max(s.z, 1e-4)
}

/**
 * Re-skin every mesh in the GLB scene with the premium onyx material.
 * The largest mesh becomes the body (vein glow); smaller meshes (equator seam)
 * become subtle blue accents.
 */
export function applyPremiumObsidian(scene: THREE.Object3D): PremiumObsidianResult {
  const tex = loadOnyxTextures()

  const makeBody = (): THREE.MeshPhysicalMaterial =>
    new THREE.MeshPhysicalMaterial({
      color: BODY_TINT.clone(),
      map: tex.colorMap,
      // Use the scan's own roughness — matte-satin stone, not a glossy mirror.
      roughness: 1,
      roughnessMap: tex.roughnessMap,
      metalness: 0,
      normalMap: tex.normalMap,
      // Real, fine vein relief from the scan.
      normalScale: new THREE.Vector2(0.7, 0.7),
      // No clearcoat: the bright glossy blob came from a smooth coat. Keep a
      // quiet matte stone, but give it enough environment response that the
      // facets catch light and read as polished stone, not flat charcoal.
      clearcoat: 0,
      reflectivity: 0.42,
      envMapIntensity: 0.9,
      emissive: new THREE.Color(VEIN_EMISSIVE),
      // Bright onyx veins act as the emissive mask → they light up blue on
      // lightning beats; dark at idle.
      emissiveMap: tex.colorMap,
      emissiveIntensity: 0,
    })

  const makeAccent = (): THREE.MeshPhysicalMaterial =>
    new THREE.MeshPhysicalMaterial({
      color: ACCENT_TINT.clone(),
      map: tex.colorMap,
      roughness: 1,
      roughnessMap: tex.roughnessMap,
      metalness: 0,
      normalMap: tex.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      clearcoat: 0,
      reflectivity: 0.42,
      envMapIntensity: 0.9,
      // No emissive: the equator seam stays dark stone. A steady blue glow here
      // reads as a "halo" ring around the gem's waist — keep it off.
      emissive: new THREE.Color(ACCENT_EMISSIVE),
      emissiveIntensity: 0,
    })

  const meshes: THREE.Mesh[] = []
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) meshes.push(mesh)
  })

  let bodyIdx = 0
  let bodyVol = -1
  meshes.forEach((mesh, i) => {
    const vol = meshVolume(mesh)
    if (vol > bodyVol) {
      bodyVol = vol
      bodyIdx = i
    }
  })

  const veinMat = makeBody()
  const accents: THREE.MeshPhysicalMaterial[] = []

  meshes.forEach((mesh, i) => {
    if (i === bodyIdx) {
      mesh.material = veinMat
    } else {
      const accent = makeAccent()
      accents.push(accent)
      mesh.material = accent
    }
  })

  return {
    veinMat,
    accents,
    dispose: () => {
      tex.dispose()
      veinMat.dispose()
      accents.forEach((a) => a.dispose())
    },
  }
}
