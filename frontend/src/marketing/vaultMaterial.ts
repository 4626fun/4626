import * as THREE from 'three'

/**
 * Premium obsidian look for the marketing vault hero.
 *
 * Goal: a dense, finely-grained matte obsidian crystal (obsdn.trade vibe) — not
 * glossy plastic, not kintsugi gold. Veins are deliberately sparse and stay dark
 * at idle, only glowing Base-blue on lightning beats.
 */

const BODY_COLOR = '#0a0d14'
const ACCENT_COLOR = '#0a1022'
const VEIN_EMISSIVE = '#0052ff'
const ACCENT_EMISSIVE = '#3d7bff'

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v)
}

/** Fractal noise. `ridged` produces sharp mineral creases instead of soft blobs. */
function fbm(x: number, y: number, freqs: number[], ridged: boolean): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (const f of freqs) {
    let n = valueNoise(x * f, y * f)
    if (ridged) n = 1 - Math.abs(2 * n - 1)
    sum += n * amp
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}

/**
 * Cellular (Worley) noise. Returns the nearest (`f1`) and second-nearest (`f2`)
 * feature-point distances plus a stable per-cell id. `f2 - f1` is small along
 * cell borders, which we use to fake obsidian's sharp conchoidal-fracture facets.
 */
function worley(x: number, y: number, freq: number): { f1: number; f2: number; cellId: number } {
  const fx = x * freq
  const fy = y * freq
  const gx = Math.floor(fx)
  const gy = Math.floor(fy)
  let f1 = Infinity
  let f2 = Infinity
  let cellId = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i
      const cy = gy + j
      const px = cx + hash2(cx, cy)
      const py = cy + hash2(cx + 57.3, cy + 131.7)
      const dx = px - fx
      const dy = py - fy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < f1) {
        f2 = f1
        f1 = d
        cellId = hash2(cx * 1.7 + 0.3, cy * 2.3 + 0.7)
      } else if (d < f2) {
        f2 = d
      }
    }
  }
  return { f1, f2, cellId }
}

type DetailTextures = {
  roughnessMap: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  veinMap: THREE.CanvasTexture
}

/**
 * Super-detailed obsidian surface. Instead of pure high-frequency noise (which
 * reads as gritty sandpaper), we layer two scales of crystalline facets
 * (Worley) for the cut-glass conchoidal look, then add a fine ridged micro-grain
 * on top. Facet interiors stay smooth for elegant reflections; only the crease
 * lines are rough, and only the brightest facet borders carry sparse blue veins.
 */
function createObsidianDetailTextures(size = 1024): DetailTextures {
  const repeat = 3
  const fineFreqs = [60, 120, 240, 480]
  const facetFreqA = 8
  const facetFreqB = 18

  const heights = new Float32Array(size * size)
  const creases = new Float32Array(size * size)
  const tones = new Float32Array(size * size)
  const sheens = new Float32Array(size * size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * repeat
      const v = (y / size) * repeat
      const big = worley(u, v, facetFreqA)
      const med = worley(u, v, facetFreqB)
      // Tighter smoothstep windows → crisper, cleaner facet edges (cut crystal,
      // not melted blobs).
      const edgeA = THREE.MathUtils.smoothstep(big.f2 - big.f1, 0, 0.045)
      const edgeB = THREE.MathUtils.smoothstep(med.f2 - med.f1, 0, 0.035)
      const crease = (1 - edgeA) * 0.62 + (1 - edgeB) * 0.38
      const facetTone = big.cellId * 0.6 + med.cellId * 0.25
      const micro = fbm(u, v, fineFreqs, true)
      const idx = y * size + x
      heights[idx] = THREE.MathUtils.clamp(facetTone * 0.5 + micro * 0.18 + crease * 0.46, 0, 1)
      creases[idx] = crease
      tones[idx] = facetTone
      // Per-large-facet value: drives subtle facet-to-facet sheen variation so
      // the crystal catches light like cut stone, not a uniform matte shell.
      sheens[idx] = big.cellId
    }
  }

  // --- Roughness: smooth, reflective facets; rougher only along crease lines. ---
  const rc = document.createElement('canvas')
  rc.width = rc.height = size
  const rctx = rc.getContext('2d')!
  const rimg = rctx.createImageData(size, size)
  // --- Vein emissive: sparse cracks along the strongest, brightest facet borders. ---
  const vc = document.createElement('canvas')
  vc.width = vc.height = size
  const vctx = vc.getContext('2d')!
  const vimg = vctx.createImageData(size, size)

  for (let i = 0; i < size * size; i++) {
    const crease = creases[i] ?? 0
    const tone = tones[i] ?? 0
    const sheen = sheens[i] ?? 0
    // Matte, elegant obsidian: mid-high roughness (not glossy). Crease lines are
    // rougher; some large facets read slightly smoother for a cut-stone sheen.
    const r = THREE.MathUtils.clamp(0.34 + crease * 0.26 + (1 - tone) * 0.08 - sheen * 0.12, 0.24, 0.7)
    const rv = Math.round(r * 255)
    rimg.data[i * 4] = rv
    rimg.data[i * 4 + 1] = rv
    rimg.data[i * 4 + 2] = rv
    rimg.data[i * 4 + 3] = 255

    const vein =
      THREE.MathUtils.smoothstep(crease, 0.72, 0.96) * THREE.MathUtils.smoothstep(tone, 0.5, 0.85)
    const cv = Math.round(vein * 255)
    vimg.data[i * 4] = cv
    vimg.data[i * 4 + 1] = cv
    vimg.data[i * 4 + 2] = cv
    vimg.data[i * 4 + 3] = 255
  }
  rctx.putImageData(rimg, 0, 0)
  vctx.putImageData(vimg, 0, 0)

  // --- Normal map from height gradient: crisp facet edges, subtle micro-grain. ---
  const STRENGTH = 2.6
  const nc = document.createElement('canvas')
  nc.width = nc.height = size
  const nctx = nc.getContext('2d')!
  const nimg = nctx.createImageData(size, size)
  const at = (x: number, y: number) =>
    heights[((y + size) % size) * size + ((x + size) % size)] ?? 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH
      const dy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH
      const nz = 1
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + nz * nz)
      const i = (y * size + x) * 4
      nimg.data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255)
      nimg.data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255)
      nimg.data[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255)
      nimg.data[i + 3] = 255
    }
  }
  nctx.putImageData(nimg, 0, 0)

  const finish = (c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    tex.anisotropy = 8
    tex.needsUpdate = true
    return tex
  }

  return {
    roughnessMap: finish(rc, false),
    normalMap: finish(nc, false),
    veinMap: finish(vc, true),
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
 * Re-skin every mesh in the GLB scene with the premium obsidian material.
 * The largest mesh becomes the body (vein glow); smaller meshes (equator seam)
 * become subtle blue accents.
 */
export function applyPremiumObsidian(scene: THREE.Object3D): PremiumObsidianResult {
  const detail = createObsidianDetailTextures()

  const makeBody = (): THREE.MeshPhysicalMaterial =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(BODY_COLOR),
      roughness: 1,
      roughnessMap: detail.roughnessMap,
      metalness: 0,
      normalMap: detail.normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      reflectivity: 0.32,
      envMapIntensity: 0.85,
      emissive: new THREE.Color(VEIN_EMISSIVE),
      emissiveMap: detail.veinMap,
      emissiveIntensity: 0,
    })

  const makeAccent = (): THREE.MeshPhysicalMaterial =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(ACCENT_COLOR),
      roughness: 0.5,
      roughnessMap: detail.roughnessMap,
      metalness: 0,
      normalMap: detail.normalMap,
      normalScale: new THREE.Vector2(0.38, 0.38),
      clearcoat: 0.1,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.8,
      emissive: new THREE.Color(ACCENT_EMISSIVE),
      emissiveIntensity: 0.2,
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

  // Edge case: single merged mesh — give it a faint accent companion-free glow.
  return {
    veinMat,
    accents,
    dispose: () => {
      detail.roughnessMap.dispose()
      detail.normalMap.dispose()
      detail.veinMap.dispose()
      veinMat.dispose()
      accents.forEach((a) => a.dispose())
    },
  }
}
