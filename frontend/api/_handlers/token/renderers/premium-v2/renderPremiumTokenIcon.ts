import sharp from 'sharp'

import {
  buildPremiumSubjectStack,
  renderCreatorSignature,
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
 * Premium v2: Fuji LUT, masked bg darken, flat dark card, extended ghost stack, platinum bezel, hybrid glow.
 * Hero and breakout share the same subject grade so ears do not mismatch the body.
 */
export async function renderPremiumTokenIcon(params: PremiumTokenIconParams): Promise<Buffer> {
  const gradedParams = await gradeV2SourceParams({
    ...params,
    stackUnderlayClip: params.stackUnderlayClip ?? 'extended',
  })
  const subject = await buildPremiumSubjectStack(gradedParams)
  const {
    size,
    layout,
    heroCompositeLayer,
    breakoutLayer,
    stackedUnderlay,
    analysis,
  } = subject
  const sourceClass = analysis?.sourceClass as SubjectSourceClass | undefined

  const segmentationMask = await resolveV2SegmentationMaskForIcon({
    sourceImage: gradedParams.sourceImage,
    sourceClass,
    size,
  })

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

  const overlays: sharp.OverlayOptions[] = [
    compositeStep(outerGlow, 'screen'),
    compositeStep(frameBloom, 'screen'),
  ]
  if (stackedUnderlay.rearLayerB) {
    overlays.push(compositeStep(stackedUnderlay.rearLayerB, 'over'))
  }
  if (stackedUnderlay.rearLayerA) {
    overlays.push(compositeStep(stackedUnderlay.rearLayerA, 'over'))
  }
  overlays.push(
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
