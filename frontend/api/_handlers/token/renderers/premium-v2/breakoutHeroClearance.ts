import sharp from 'sharp'

import type { PremiumLayout } from '../premium-classic/renderPremiumTokenIcon.js'
import type { SubjectSourceClass } from './subject.js'

type BreakoutMaskKind = 'heroCutout' | 'sourceAlpha' | 'rembgCutout' | undefined

/** Matches `createBreakoutAboveFrameMask` keep/fade Y so hero clearance aligns with breakout overlap. */
export function resolveBreakoutOverlapKeepToY(params: {
  layout: PremiumLayout
  sourceClass?: SubjectSourceClass
  maskKind?: BreakoutMaskKind
}): { keepToY: number; fadeEndY: number } {
  const { size, layout } = params
  const isIllustration = params.sourceClass === 'illustration'
  const isRembgCutout = params.maskKind === 'rembgCutout'
  const isHeroCutout = params.maskKind === 'heroCutout'
  const isPreparedCutout = isRembgCutout || isHeroCutout

  const overlapIntoChamberPx = Math.max(
    1,
    Math.round(
      layout.frameStroke *
        (isPreparedCutout
          ? params.sourceClass === 'pixelArt'
            ? isHeroCutout
              ? 0.62
              : 0.38
            : isIllustration
              ? 0.42
              : isHeroCutout
                ? 0.42
                : 0.42
          : isIllustration
            ? 0.38
            : 0.05),
    ),
  )
  const edgeFeatherPx = Math.max(
    1,
    Math.round(
      layout.frameStroke *
        (isPreparedCutout
          ? params.sourceClass === 'pixelArt'
            ? isHeroCutout
              ? 1.18
              : 0.9
            : isIllustration
              ? 1.42
              : isHeroCutout
                ? 1.06
                : 1.06
          : isIllustration
            ? 0.74
            : 0.12),
    ),
  )
  const keepToY = Math.min(size, Math.max(0, layout.chamberY + overlapIntoChamberPx))
  const fadeEndY = Math.min(size, keepToY + edgeFeatherPx)
  return { keepToY, fadeEndY }
}

/**
 * Punch a band out of the chamber clip so the hero does not duplicate the breakout hat/face
 * that is painted again above the bezel.
 */
export async function createHeroBreakoutOverlapClearMask(params: {
  size: number
  layout: PremiumLayout
  sourceClass?: SubjectSourceClass
  maskKind?: BreakoutMaskKind
}): Promise<Buffer> {
  const { size, layout } = params
  const chamberSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${layout.chamberX}"
    y="${layout.chamberY}"
    width="${layout.chamberSize}"
    height="${layout.chamberSize}"
    rx="${layout.chamberRadius}"
    fill="white"
  />
</svg>`
  const chamber = await sharp(Buffer.from(chamberSvg)).png().toBuffer()

  const { fadeEndY } = resolveBreakoutOverlapKeepToY(params)
  const padX = Math.max(4, Math.round(layout.breakoutWidth * 0.14))
  const cutX = Math.max(layout.chamberX, layout.breakoutX - padX)
  const cutRight = Math.min(
    layout.chamberX + layout.chamberSize,
    layout.breakoutX + layout.breakoutWidth + padX,
  )
  const cutW = Math.max(1, cutRight - cutX)
  const cutY = layout.chamberY
  const cutH = Math.max(0, Math.min(layout.chamberY + layout.chamberSize - cutY, fadeEndY - cutY))
  if (cutH <= 0) return chamber

  const cutSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${cutX}" y="${cutY}" width="${cutW}" height="${cutH}" fill="white"/>
</svg>`
  const cut = await sharp(Buffer.from(cutSvg)).png().toBuffer()
  return sharp(chamber)
    .composite([{ input: cut, blend: 'dest-out' }])
    .png()
    .toBuffer()
}
