import sharp from 'sharp'

import {
  generateSegmentationMask,
  type SegmentationModel,
} from '../../_segmentation.js'
import {
  applyLut3dToPngBuffer,
  loadDefaultLut3d,
} from '../../../../../server/_lib/image/lut3dGrade.js'
import type { PremiumTokenIconParams } from '../premium-classic/renderPremiumTokenIcon.js'
import type { SubjectSourceClass } from './subject.js'

/** Fuji Classic Chrome — same LUT family as fujilab. */
export function resolveV2LutIntensity(): number {
  const raw = Number(process.env.TOKEN_ICON_V2_LUT_INTENSITY ?? 0.36)
  return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.36
}

let cachedDefaultLut: Awaited<ReturnType<typeof loadDefaultLut3d>> | null = null

async function getV2Lut() {
  if (!cachedDefaultLut) cachedDefaultLut = await loadDefaultLut3d()
  return cachedDefaultLut
}

/**
 * Fuji grade on a subject layer only (hero / breakout). Skips transparent pixels so
 * bezel and padding are not tinted; keeps hero/cutout alignment vs pre-compose LUT.
 */
export async function applyV2SubjectLut(layer: Buffer): Promise<Buffer> {
  const intensity = resolveV2LutIntensity()
  if (intensity <= 0) return layer

  const { data: orig, info } = await sharp(layer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const px = info.width * info.height
  const lut = await getV2Lut()
  const graded = await applyLut3dToPngBuffer(layer, lut, { intensity })
  const { data: out } = await sharp(graded)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < px; i += 1) {
    const o = i * 4
    const a = orig[o + 3] ?? 0
    if (a < 10) {
      out[o] = orig[o]
      out[o + 1] = orig[o + 1]
      out[o + 2] = orig[o + 2]
      out[o + 3] = a
      continue
    }
    out[o + 3] = a
  }

  return sharp(Buffer.from(out), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

/** @deprecated Prefer applyV2SubjectLut on hero/breakout layers before chrome composite. */
export async function applyV2PostComposeLut(png: Buffer): Promise<Buffer> {
  const intensity = resolveV2LutIntensity()
  if (intensity <= 0) return png
  const lut = await getV2Lut()
  return applyLut3dToPngBuffer(png, lut, { intensity })
}

const BACKGROUND_DARKEN_ENABLED = process.env.TOKEN_ICON_V2_BACKGROUND_DARKEN !== '0'
const BACKGROUND_BRIGHTNESS = Number(process.env.TOKEN_ICON_V2_BACKGROUND_BRIGHTNESS ?? 0.72)
const BACKGROUND_SATURATION = Number(process.env.TOKEN_ICON_V2_BACKGROUND_SATURATION ?? 0.92)

function resolveSegmentationModel(sourceClass: SubjectSourceClass | undefined): SegmentationModel {
  switch (sourceClass) {
    case 'portraitPhoto':
      return 'bria-rmbg'
    case 'pixelArt':
      return 'u2netp'
    default:
      return 'isnet-general-use'
  }
}

export type SubjectSegmentationMask = {
  width: number
  height: number
  subjectMaskPng: Buffer
}

/** One rembg pass per icon — reused for hero + breakout background darken. */
export async function resolveSubjectSegmentationMask(params: {
  sourceImage?: Uint8Array
  sourceClass?: SubjectSourceClass
  width: number
  height: number
}): Promise<SubjectSegmentationMask | null> {
  const { sourceImage, sourceClass, width, height } = params
  if (!BACKGROUND_DARKEN_ENABLED) return null
  if (!sourceImage?.length || sourceClass === 'brightBadge') return null
  if (process.env.TOKEN_PREMIUM_REMBG === '0') return null

  const segmentation = await generateSegmentationMask(Buffer.from(sourceImage), {
    model: resolveSegmentationModel(sourceClass),
    alphaMatting: sourceClass === 'portraitPhoto',
    maskOnly: true,
    timeoutMs: Number(process.env.TOKEN_PREMIUM_REMBG_TIMEOUT_MS ?? 30_000),
  })
  if (!segmentation?.maskPngRgba) return null

  const maskAlpha = await sharp(segmentation.maskPngRgba)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const px = width * height
  const subjectMaskRgba = Buffer.alloc(px * 4, 255)
  for (let i = 0; i < px; i += 1) {
    subjectMaskRgba[i * 4 + 3] = maskAlpha.data[i] ?? 0
  }
  const subjectMaskPng = await sharp(subjectMaskRgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()

  return { width, height, subjectMaskPng }
}

/** Reuse the rembg mask from `buildPremiumSubjectStack` so hero darken aligns with breakout cutout. */
export async function subjectSegmentationMaskFromRgba(
  maskPngRgba: Buffer,
  width: number,
  height: number,
): Promise<SubjectSegmentationMask> {
  const maskAlpha = await sharp(maskPngRgba)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const px = width * height
  const subjectMaskRgba = Buffer.alloc(px * 4, 255)
  for (let i = 0; i < px; i += 1) {
    subjectMaskRgba[i * 4 + 3] = maskAlpha.data[i] ?? 0
  }
  const subjectMaskPng = await sharp(subjectMaskRgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()

  return { width, height, subjectMaskPng }
}

/**
 * v2 applies Fuji on the flattened composite (see applyV2PostComposeLut), not on raw source bytes,
 * so prepared hero cutouts stay aligned with the in-frame subject.
 */
export async function gradeV2SourceParams(
  params: PremiumTokenIconParams,
): Promise<PremiumTokenIconParams> {
  return params
}

export async function darkenLayerBackgroundWithMask(params: {
  layer: Buffer
  mask: SubjectSegmentationMask
}): Promise<Buffer> {
  const { layer, mask } = params
  const { width, height, subjectMaskPng } = mask

  const subjectOnly = await sharp(layer)
    .ensureAlpha()
    .composite([{ input: subjectMaskPng, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const brightness = Number.isFinite(BACKGROUND_BRIGHTNESS)
    ? Math.max(0.5, Math.min(1, BACKGROUND_BRIGHTNESS))
    : 0.72
  const saturation = Number.isFinite(BACKGROUND_SATURATION)
    ? Math.max(0.5, Math.min(1.2, BACKGROUND_SATURATION))
    : 0.92

  const darkened = await sharp(layer)
    .modulate({ brightness, saturation })
    .png()
    .toBuffer()

  const maskAlpha = await sharp(subjectMaskPng).extractChannel('alpha').raw().toBuffer({
    resolveWithObject: true,
  })
  const px = width * height
  const invMaskRgba = Buffer.alloc(px * 4, 255)
  for (let i = 0; i < px; i += 1) {
    invMaskRgba[i * 4 + 3] = 255 - (maskAlpha.data[i] ?? 0)
  }
  const invMaskPng = await sharp(invMaskRgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()

  const backgroundOnly = await sharp(darkened)
    .ensureAlpha()
    .composite([{ input: invMaskPng, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return sharp(backgroundOnly)
    .composite([{ input: subjectOnly, blend: 'over' }])
    .png()
    .toBuffer()
}

/** Darkened non-subject pixels only — the in-frame “pattern” v2 can spill into outer padding. */
export async function extractDarkBackgroundPattern(params: {
  layer: Buffer
  mask: SubjectSegmentationMask
}): Promise<Buffer> {
  const { layer, mask } = params
  const { width, height, subjectMaskPng } = mask

  const brightness = Number.isFinite(BACKGROUND_BRIGHTNESS)
    ? Math.max(0.5, Math.min(1, BACKGROUND_BRIGHTNESS))
    : 0.72
  const saturation = Number.isFinite(BACKGROUND_SATURATION)
    ? Math.max(0.5, Math.min(1.2, BACKGROUND_SATURATION))
    : 0.92

  const darkened = await sharp(layer)
    .modulate({ brightness, saturation })
    .png()
    .toBuffer()

  const maskAlpha = await sharp(subjectMaskPng).extractChannel('alpha').raw().toBuffer({
    resolveWithObject: true,
  })
  const px = width * height
  const invMaskRgba = Buffer.alloc(px * 4, 255)
  for (let i = 0; i < px; i += 1) {
    invMaskRgba[i * 4 + 3] = 255 - (maskAlpha.data[i] ?? 0)
  }
  const invMaskPng = await sharp(invMaskRgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()

  return sharp(darkened)
    .ensureAlpha()
    .composite([{ input: invMaskPng, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** @deprecated Use resolveSubjectSegmentationMask + darkenLayerBackgroundWithMask */
export async function darkenPhotoBackgroundWithSegmentation(params: {
  heroLayer: Buffer
  sourceImage?: Uint8Array
  sourceClass?: SubjectSourceClass
  size: number
}): Promise<Buffer> {
  const heroMeta = await sharp(params.heroLayer).metadata()
  const width = heroMeta.width ?? params.size
  const height = heroMeta.height ?? params.size
  const mask = await resolveSubjectSegmentationMask({
    sourceImage: params.sourceImage,
    sourceClass: params.sourceClass,
    width,
    height,
  })
  if (!mask) return params.heroLayer
  return darkenLayerBackgroundWithMask({ layer: params.heroLayer, mask })
}
