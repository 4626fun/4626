import sharp from 'sharp'

import {
  buildPremiumSubjectStack,
  renderBackgroundCard,
  renderCreatorSignature,
  renderFrameBloom,
  renderOuterGlow,
  renderPremiumFrame,
  type PremiumTokenIconParams,
} from '../premium-classic/renderPremiumTokenIcon.js'
import { renderV2BackgroundCard } from './background.js'
import { solidifyBreakoutLayer } from './breakout.js'
import { renderV2PremiumFrame } from './frame.js'
import { renderV2FrameBloom, renderV2OuterGlow } from './glow.js'
import {
  applyPremiumHeroPresentation,
  finishV2SubjectLayer,
  resolveV2SegmentationMaskForIcon,
  type SubjectSourceClass,
} from './subject.js'
import {
  resolveV2CardUnderlaySourceClass,
  resolveV2SegmentationSourceClass,
  shouldSkipV2HeroBackgroundDarken,
} from './cardUnderlay.js'
import { renderV2ExtendedFieldPattern } from './fieldPattern.js'
import { renderV2PaddingSilhouetteBleed } from './paddingSilhouette.js'
import { applyV2SubjectLut } from './subjectGrade.js'

export type { PremiumTokenIconParams }

type BlendMode = NonNullable<sharp.OverlayOptions['blend']>

function compositeStep(input: Buffer, blend: BlendMode): sharp.OverlayOptions {
  return { input, blend }
}

/**
 * Premium v2: Fuji on subject layers only, v2 card + platinum frame for standard coins.
 * Prepared hero cutouts use classic background/chrome (blue bezel + padding atmosphere) so
 * the hat breakout matches production; subject still gets Fuji via applyV2SubjectLut.
 */
export async function renderPremiumTokenIcon(params: PremiumTokenIconParams): Promise<Buffer> {
  const preparedHeroCutoutBreakout = Boolean(params.heroCutoutSourceImage?.length)
  const subject = await buildPremiumSubjectStack(params)
  const {
    size,
    layout,
    heroCompositeLayer,
    breakoutLayer,
    analysis,
    subjectPlacement,
  } = subject
  const sourceClass = analysis?.sourceClass as SubjectSourceClass | undefined
  const skipHeroBackgroundDarken = analysis ? shouldSkipV2HeroBackgroundDarken(analysis) : false
  const segmentationSourceClass = analysis
    ? resolveV2SegmentationSourceClass(analysis, sourceClass)
    : sourceClass

  const segmentationMask = preparedHeroCutoutBreakout
    ? null
    : await resolveV2SegmentationMaskForIcon({
        sourceImage: params.sourceImage,
        sourceClass: segmentationSourceClass,
        size,
      })

  const stackSourceClass =
    analysis && subjectPlacement ? resolveV2CardUnderlaySourceClass(analysis) : sourceClass

  const paddingSpillParams =
    !preparedHeroCutoutBreakout &&
    segmentationMask &&
    subjectPlacement &&
    stackSourceClass
      ? {
          size,
          layout,
          sourceClass: stackSourceClass,
          segmentationMask,
          placement: subjectPlacement,
        }
      : null

  const [paddingFieldPattern, paddingSilhouette] = paddingSpillParams
    ? await Promise.all([
        renderV2ExtendedFieldPattern({
          ...paddingSpillParams,
          heroLayer: heroCompositeLayer,
        }),
        renderV2PaddingSilhouetteBleed(paddingSpillParams),
      ])
    : [null, null]

  const [backgroundCard, outerGlow, frameBloom, premiumFrame] = preparedHeroCutoutBreakout
    ? await Promise.all([
        renderBackgroundCard({ size, layout, omitBottomRightAura: true }),
        renderOuterGlow({ size, layout, omitBottomRightAura: true }),
        renderFrameBloom({ size, layout }),
        renderPremiumFrame({ size, layout }),
      ])
    : await Promise.all([
        renderV2BackgroundCard({ size, layout }),
        renderV2OuterGlow({ size, layout }),
        renderV2FrameBloom({ size, layout }),
        renderV2PremiumFrame({ size, layout }),
      ])

  const heroBase = preparedHeroCutoutBreakout
    ? await applyPremiumHeroPresentation(heroCompositeLayer, sourceClass, size)
    : await finishV2SubjectLayer({
        layer: heroCompositeLayer,
        layout,
        sourceImage: params.sourceImage,
        sourceClass,
        size,
        segmentationMask,
        edgeVignette: true,
        skipBackgroundDarken: skipHeroBackgroundDarken,
      })
  const heroLayer = await applyV2SubjectLut(heroBase)

  const overlays: sharp.OverlayOptions[] = [
    compositeStep(outerGlow, 'screen'),
    compositeStep(frameBloom, 'screen'),
  ]
  if (paddingFieldPattern) {
    overlays.push(compositeStep(paddingFieldPattern, 'over'))
  }
  if (paddingSilhouette) {
    overlays.push(compositeStep(paddingSilhouette, 'over'))
  }
  overlays.push(
    compositeStep(heroLayer, 'over'),
    compositeStep(premiumFrame, 'over'),
  )

  if (breakoutLayer) {
    const breakoutBase = preparedHeroCutoutBreakout
      ? await applyPremiumHeroPresentation(breakoutLayer, sourceClass, size)
      : await solidifyBreakoutLayer(
          await finishV2SubjectLayer({
            layer: breakoutLayer,
            layout,
            sourceImage: params.sourceImage,
            sourceClass,
            size,
            segmentationMask,
            edgeVignette: false,
            skipBackgroundDarken: skipHeroBackgroundDarken,
          }),
        )
    const breakout = await applyV2SubjectLut(breakoutBase)
    overlays.push(compositeStep(breakout, 'over'))
  }

  const signatureText = (params.signatureText ?? params.symbol ?? '').trim()
  if (signatureText) {
    const signature = await renderCreatorSignature({
      size,
      layout,
      signatureText,
      backgroundLayer: heroCompositeLayer,
    })
    overlays.push(compositeStep(signature, 'over'))
  }

  const flattenBg = preparedHeroCutoutBreakout ? '#000000' : '#010203'

  return sharp(backgroundCard)
    .composite(overlays)
    .flatten({ background: flattenBg })
    .png()
    .toBuffer()
}
