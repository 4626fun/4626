/** Shared obsidian vault hero tokens (R3F + docs). */

export const OBSIDIAN_COLORS = {
  core: '#010103',
  shell: '#000004',
  seam: '#020204',
  seamSubtle: '#010102',
  glow: '#080b10',
  mark: '#010102',
} as const

export const OBSIDIAN_MATERIAL = {
  core: {
    color: OBSIDIAN_COLORS.core,
    metalness: 0.88,
    roughness: 0.29,
    clearcoat: 0.95,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.65,
  },
  shell: {
    color: OBSIDIAN_COLORS.shell,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    metalness: 0,
    roughness: 0.055,
    transmission: 0.2,
    thickness: 0.42,
    ior: 1.48,
    attenuationColor: '#000003',
    attenuationDistance: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    envMapIntensity: 2.25,
  },
  seam: {
    color: OBSIDIAN_COLORS.seam,
    metalness: 0.94,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
  },
} as const

export const OBSIDIAN_CAMERA = {
  position: [0, 0.28, 5.7] as const,
  fov: 22,
  near: 0.05,
  far: 80,
}

export const OBSIDIAN_BLOOM = {
  intensity: 0.075,
  luminanceThreshold: 0.965,
  luminanceSmoothing: 0.08,
  radius: 0.16,
} as const

export const OBSIDIAN_VIGNETTE = {
  offset: 0.12,
  darkness: 0.76,
} as const

export const OBSIDIAN_DPR: [number, number] = [1, 1.75]

export const OBSIDIAN_GLB_DEFAULT = '/immersive/assets/models/obsidian-vault.glb'

export type VaultHeroMode = 'procedural' | 'glb'
