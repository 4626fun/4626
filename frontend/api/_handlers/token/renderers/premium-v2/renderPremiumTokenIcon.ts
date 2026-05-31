import sharp from 'sharp'

import {
  buildPremiumSubjectStack,
  renderCreatorSignature,
  renderPremiumStackedUnderlay,
  type PremiumTokenIconParams,
} from '../premium-classic/renderPremiumTokenIcon.js'
import { renderV2BackgroundCard } from './background.js'
import { solidifyBreakoutLayer } from './breakout.js'
import { renderV2PremiumFrame } from './frame.js'
import { renderV2FrameBloom, renderV2OuterGlow } from './glow.js'
import {
  finishV2SubjectLayer,
  resolveV2SegmentationMaskForIcon,
  type SubjectSourceClass,
} from './subject.js'
import { gradeV2SourceParams } from './subjectGrade.js'

export type { PremiumTokenIconParams }

type BlendMode = NonNullable<sharp.OverlayOptions['blend']>

function compositeStep(input: Buffer, blend: BlendMode): sharp.OverlayOptions {
  return { input, blend }
}

/**
 * Premium v2: Fuji LUT, flat card, ghost stack across full card (silhouette spills into padding),
 * bezel-only glow, platinum frame.
 */
export async function renderPremiumTokenIcon(params: PremiumTokenIconParams): Promise<Buffer> {
  const gradedParams = await gradeV2SourceParams(params)
  const subject = await buildPremiumSubjectStack({
    ...gradedParams,
    stackUnderlayClip: 'chamber',
  })
  const {
    size,
    layout,
    heroCompositeLayer,
    breakoutLayer,
    stackedUnderlay: chamberUnderlay,
    analysis,
    subjectPlacement,
  } = subject
  const sourceClass = analysis?.sourceClass as SubjectSourceClass | undefined

  const segmentationMask = await resolveV2SegmentationMaskForIcon({
    sourceImage: gradedParams.sourceImage,
    sourceClass,
    size,
  })

  const stackedUnderlay =
    segmentationMask &&
    gradedParams.sourceImage?.length &&
    analysis &&
    subjectPlacement
      ? await renderPremiumStackedUnderlay({
          size,
          layout,
          sourceImage: Buffer.from(gradedParams.sourceImage),
          scale: subjectPlacement.renderScale,
          fit: subjectPlacement.fitMode,
          sourceClass: analysis.sourceClass,
          hasTransparency: analysis.hasTransparency,
          topBiasPx: subjectPlacement.topBiasPx,
          clipRegion: 'card',
          subjectAlphaMaskPng: segmentationMask.subjectMaskPng,
        })
      : chamberUnderlay

  const backgroundCard = await renderV2BackgroundCard({ size, layout })
  const outerGlow = await renderV2OuterGlow({ size, layout })
  const frameBloom = await renderV2FrameBloom({ size, layout })
  const premiumFrame = await renderV2PremiumFrame({ size, layout })

  const heroLayer = await finishV2SubjectLayer({
    layer: heroCompositeLayer,
    layout,
    sourceImage: gradedParams.sourceImage,
    sourceClass,
    size,
    segmentationMask,
    edgeVignette: true,
  })

  const overlays: sharp.OverlayOptions[] = []
  if (stackedUnderlay.rearLayerB) {
    overlays.push(compositeStep(stackedUnderlay.rearLayerB, 'over'))
  }
  if (stackedUnderlay.rearLayerA) {
    overlays.push(compositeStep(stackedUnderlay.rearLayerA, 'over'))
  }
  overlays.push(
    compositeStep(outerGlow, 'screen'),
    compositeStep(frameBloom, 'screen'),
    compositeStep(heroLayer, 'over'),
    compositeStep(premiumFrame, 'over'),
  )

  if (breakoutLayer) {
    const breakoutFinished = await finishV2SubjectLayer({
      layer: breakoutLayer,
      layout,
      sourceImage: gradedParams.sourceImage,
      sourceClass,
      size,
      segmentationMask,
      edgeVignette: false,
    })
    const breakout = await solidifyBreakoutLayer(breakoutFinished)
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

  return sharp(backgroundCard)
    .composite(overlays)
    .flatten({ background: '#010203' })
    .png()
    .toBuffer()
}
