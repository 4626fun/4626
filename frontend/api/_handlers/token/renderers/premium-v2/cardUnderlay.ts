import type { SubjectSourceClass } from './subject.js'

/** Minimal analysis fields needed for v2 card-spill / hero-grade decisions. */
export type V2SourceAnalysisSlice = {
  lowResolution: boolean
  hasTransparency: boolean
  sourceClass: string
}

/**
 * Opaque NFT-style avatars (e.g. Jesse CryptoPunk) — not true photos.
 * Two illustration stack offsets read as duplicate frames in padding spill.
 */
export function isOpaqueAvatarCoin(analysis: V2SourceAnalysisSlice): boolean {
  if (analysis.hasTransparency) return false
  if (analysis.sourceClass === 'brightBadge') return false
  if (analysis.sourceClass === 'pixelArt') return true
  if (analysis.sourceClass === 'illustration' && analysis.lowResolution) return true
  return false
}

export function resolveV2CardUnderlaySourceClass(
  analysis: V2SourceAnalysisSlice,
): SubjectSourceClass {
  if (isOpaqueAvatarCoin(analysis)) return 'pixelArt'
  return analysis.sourceClass as SubjectSourceClass
}

export function resolveV2SegmentationSourceClass(
  analysis: V2SourceAnalysisSlice,
  heroSourceClass?: SubjectSourceClass,
): SubjectSourceClass | undefined {
  if (isOpaqueAvatarCoin(analysis)) return 'pixelArt'
  return heroSourceClass
}

export function shouldSkipV2HeroBackgroundDarken(analysis: V2SourceAnalysisSlice): boolean {
  return isOpaqueAvatarCoin(analysis)
}

/**
 * Ghost stack stays inside the chamber only. Padding outside the bezel uses
 * `fieldPattern` + `paddingSilhouette` (one rembg-shaped spill — no offset ghost copies).
 */
export function resolveV2StackClipRegion(): 'chamber' {
  return 'chamber'
}
