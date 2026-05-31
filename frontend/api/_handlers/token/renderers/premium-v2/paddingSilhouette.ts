import sharp from 'sharp'

import type { PremiumLayout, PremiumSubjectPlacement } from '../premium-classic/renderPremiumTokenIcon.js'
import type { SubjectSegmentationMask } from './subjectGrade.js'
import type { SubjectSourceClass } from './subject.js'

const PADDING_SILHOUETTE_ENABLED = process.env.TOKEN_ICON_V2_PADDING_SILHOUETTE !== '0'
const PADDING_SILHOUETTE_OPACITY = Number(process.env.TOKEN_ICON_V2_PADDING_SILHOUETTE_OPACITY ?? 0.64)
const PADDING_SILHOUETTE_BLUR_RATIO = Number(process.env.TOKEN_ICON_V2_PADDING_SILHOUETTE_BLUR ?? 0.032)

async function applyOpacity(layer: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 0.999) return layer
  return sharp(layer)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer()
}

async function createPaddingOutsideFrameMask(layout: PremiumLayout): Promise<Buffer> {
  const { size } = layout
  const cardSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${layout.cardRadius}" fill="white"/>
</svg>`
  const frameHoleSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.frameX}"
    y="${layout.frameY}"
    width="${layout.frameSize}"
    height="${layout.frameSize}"
    rx="${layout.frameRadius}"
    fill="#000"
  />
</svg>`
  const [card, hole] = await Promise.all([
    sharp(Buffer.from(cardSvg)).png().toBuffer(),
    sharp(Buffer.from(frameHoleSvg)).png().toBuffer(),
  ])
  return sharp(card)
    .composite([{ input: hole, blend: 'dest-out' }])
    .png()
    .toBuffer()
}

/**
 * Soft dark subject shape in card padding — same silhouette read as in-chamber ghosts,
 * without offset copies that look like a second frame.
 */
export async function renderV2PaddingSilhouetteBleed(params: {
  size: number
  layout: PremiumLayout
  sourceClass?: SubjectSourceClass
  segmentationMask: SubjectSegmentationMask | null
  placement: PremiumSubjectPlacement | null
}): Promise<Buffer | null> {
  if (!PADDING_SILHOUETTE_ENABLED) return null
  const { size, layout, sourceClass, segmentationMask, placement } = params
  if (!segmentationMask || !placement) return null
  if (sourceClass === 'brightBadge') return null

  // Full-card rembg mask — breakout ears sit above the placed art box.
  const blurPx = Math.max(1.2, PADDING_SILHOUETTE_BLUR_RATIO * size)
  let silhouette = await sharp(segmentationMask.subjectMaskPng)
    .ensureAlpha()
    .extractChannel('alpha')
    .toColourspace('b-w')
    .png()
    .toBuffer()

  silhouette = await sharp(silhouette)
    .modulate({ brightness: 0.28, saturation: 0 })
    .blur(blurPx)
    .png()
    .toBuffer()

  const paddingMask = await createPaddingOutsideFrameMask(layout)
  silhouette = await sharp(silhouette)
    .ensureAlpha()
    .composite([{ input: paddingMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const opacity = Number.isFinite(PADDING_SILHOUETTE_OPACITY)
    ? Math.max(0, Math.min(1, PADDING_SILHOUETTE_OPACITY))
    : 0.52
  return applyOpacity(silhouette, opacity)
}
