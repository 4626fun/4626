import sharp from 'sharp'

import type { PremiumLayout, PremiumSubjectPlacement } from '../premium-classic/renderPremiumTokenIcon.js'
import { createPaddingSpillMask } from './paddingSpillMask.js'
import {
  extractDarkBackgroundPattern,
  type SubjectSegmentationMask,
} from './subjectGrade.js'
import type { SubjectSourceClass } from './subject.js'

const FIELD_PATTERN_ENABLED = process.env.TOKEN_ICON_V2_FIELD_PATTERN !== '0'
const FIELD_PATTERN_OPACITY = Number(process.env.TOKEN_ICON_V2_FIELD_PATTERN_OPACITY ?? 1)
const FIELD_PATTERN_BLUR_RATIO = Number(process.env.TOKEN_ICON_V2_FIELD_PATTERN_BLUR ?? 0.014)

async function applyOpacity(layer: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 0.999) return layer
  return sharp(layer)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer()
}

/**
 * Extends the same rembg-darkened background silhouette that reads inside the chamber
 * into the card padding outside the bezel — not offset ghost copies of the full subject.
 */
export async function renderV2ExtendedFieldPattern(params: {
  size: number
  layout: PremiumLayout
  heroLayer: Buffer
  sourceClass?: SubjectSourceClass
  segmentationMask: SubjectSegmentationMask | null
  placement: PremiumSubjectPlacement | null
}): Promise<Buffer | null> {
  if (!FIELD_PATTERN_ENABLED) return null
  const { size, layout, heroLayer, sourceClass, segmentationMask, placement } = params
  if (!segmentationMask || !placement) return null
  if (sourceClass === 'brightBadge') return null

  let pattern = await extractDarkBackgroundPattern({ layer: heroLayer, mask: segmentationMask })

  const blurPx = Math.max(0, FIELD_PATTERN_BLUR_RATIO) * size
  if (blurPx >= 0.35) {
    pattern = await sharp(pattern).blur(blurPx).png().toBuffer()
  }

  // Lift slightly so foliage / pixel bg pattern reads on the dark outer card.
  pattern = await sharp(pattern)
    .modulate({ brightness: 1.28, saturation: 0.95 })
    .png()
    .toBuffer()

  const paddingMask = await createPaddingSpillMask(layout)
  pattern = await sharp(pattern)
    .ensureAlpha()
    .composite([{ input: paddingMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const opacity = Number.isFinite(FIELD_PATTERN_OPACITY)
    ? Math.max(0, Math.min(1, FIELD_PATTERN_OPACITY))
    : 1
  return applyOpacity(pattern, opacity)
}
