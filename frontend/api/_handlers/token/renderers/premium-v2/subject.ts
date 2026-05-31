import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'
import type { SubjectSegmentationMask } from './subjectGrade.js'
import {
  darkenLayerBackgroundWithMask,
  resolveSubjectSegmentationMask,
} from './subjectGrade.js'

export type SubjectSourceClass =
  | 'brightBadge'
  | 'portraitPhoto'
  | 'illustration'
  | 'pixelArt'
  | 'generic'

async function applyOpacity(layer: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 0.999) return layer
  return sharp(layer)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer()
}

/** Classic Chrome LUT + light polish on pixel/badge lanes. */
export async function applyPremiumHeroPresentation(
  layer: Buffer,
  sourceClass: SubjectSourceClass | undefined,
  _size: number,
): Promise<Buffer> {
  if (sourceClass === 'pixelArt') {
    return sharp(layer).modulate({ brightness: 1.03, saturation: 1.04 }).png().toBuffer()
  }
  if (sourceClass === 'brightBadge') {
    return sharp(layer).modulate({ brightness: 1.03, saturation: 1.05 }).png().toBuffer()
  }
  return sharp(layer).modulate({ brightness: 1.02, saturation: 1.03 }).png().toBuffer()
}

/** Edge-only chamber darken — masked to background so the subject does not get crushed. */
export async function applyPremiumChamberVignette(
  layer: Buffer,
  layout: PremiumLayout,
  mask: SubjectSegmentationMask | null,
): Promise<Buffer> {
  const { size } = layout
  const vignetteSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="chVig" cx="50%" cy="48%" r="72%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="70%" stop-color="rgba(0,0,0,0.12)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.42)"/>
    </radialGradient>
  </defs>
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="url(#chVig)"
  />
</svg>`
  let vignette = await sharp(Buffer.from(vignetteSvg)).png().toBuffer()

  if (mask) {
    const maskAlpha = await sharp(mask.subjectMaskPng)
      .extractChannel('alpha')
      .raw()
      .toBuffer({ resolveWithObject: true })
    const px = mask.width * mask.height
    const invMaskRgba = Buffer.alloc(px * 4, 255)
    for (let i = 0; i < px; i += 1) {
      invMaskRgba[i * 4 + 3] = 255 - (maskAlpha.data[i] ?? 0)
    }
    const invMaskPng = await sharp(invMaskRgba, {
      raw: { width: mask.width, height: mask.height, channels: 4 },
    })
      .png()
      .toBuffer()
    vignette = await sharp(vignette)
      .ensureAlpha()
      .composite([{ input: invMaskPng, blend: 'dest-in' }])
      .png()
      .toBuffer()
  }

  return sharp(layer)
    .composite([{ input: await applyOpacity(vignette, 0.55), blend: 'multiply' }])
    .png()
    .toBuffer()
}

/** Shared grade/darken for hero and breakout so ears match in-frame subject. */
export async function finishV2SubjectLayer(params: {
  layer: Buffer
  layout: PremiumLayout
  sourceImage?: Uint8Array
  sourceClass?: SubjectSourceClass
  size: number
  segmentationMask: SubjectSegmentationMask | null
  /** Breakout sits above frame — skip edge vignette to avoid double-darkening. */
  edgeVignette: boolean
}): Promise<Buffer> {
  let out = await applyPremiumHeroPresentation(params.layer, params.sourceClass, params.size)

  if (params.segmentationMask) {
    out = await darkenLayerBackgroundWithMask({
      layer: out,
      mask: params.segmentationMask,
    })
  }

  if (params.edgeVignette) {
    out = await applyPremiumChamberVignette(out, params.layout, params.segmentationMask)
  }

  return out
}

export async function resolveV2SegmentationMaskForIcon(params: {
  sourceImage?: Uint8Array
  sourceClass?: SubjectSourceClass
  size: number
}): Promise<SubjectSegmentationMask | null> {
  return resolveSubjectSegmentationMask({
    sourceImage: params.sourceImage,
    sourceClass: params.sourceClass,
    width: params.size,
    height: params.size,
  })
}
