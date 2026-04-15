import sharp from 'sharp'

import { classifyArtwork, type ArtworkLayout } from './imageClassifier.js'
import { getFixedContentBox, type FixedContentBox } from './imageContentBox.js'

export type LiteralSubjectContentBox = FixedContentBox

export type RenderLiteralSubjectLayerParams = {
  subjectBytes: Uint8Array
  width: number
  height: number
  layoutHint?: ArtworkLayout
}

export type RenderLiteralSubjectLayerResult = {
  interiorLayerBytes: Uint8Array
  contentBox: LiteralSubjectContentBox
  layout: ArtworkLayout
}

const INNER_BACKGROUND = { r: 10, g: 12, b: 18, alpha: 1 }
const COIN_INNER_SCALE = 0.82

async function resizeSubjectForLayout(
  subjectBytes: Uint8Array,
  contentBox: FixedContentBox,
  layout: ArtworkLayout,
): Promise<Buffer> {
  if (layout === 'cover') {
    return await sharp(Buffer.from(subjectBytes))
      .resize(contentBox.width, contentBox.height, {
        fit: 'cover',
        position: 'centre',
      })
      .png()
      .toBuffer()
  }

  if (layout === 'coin') {
    const innerW = Math.round(contentBox.width * COIN_INNER_SCALE)
    const innerH = Math.round(contentBox.height * COIN_INNER_SCALE)
    const padX = Math.round((contentBox.width - innerW) / 2)
    const padY = Math.round((contentBox.height - innerH) / 2)

    return await sharp(Buffer.from(subjectBytes))
      .resize(innerW, innerH, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: padY,
        bottom: contentBox.height - innerH - padY,
        left: padX,
        right: contentBox.width - innerW - padX,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
  }

  return await sharp(Buffer.from(subjectBytes))
    .resize(contentBox.width, contentBox.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

export async function renderLiteralSubjectLayer(
  params: RenderLiteralSubjectLayerParams,
): Promise<RenderLiteralSubjectLayerResult> {
  const contentBox = getFixedContentBox(params.width, params.height)

  const layout: ArtworkLayout = params.layoutHint ??
    await classifyArtwork(params.subjectBytes)

  const subjectLayer = await resizeSubjectForLayout(params.subjectBytes, contentBox, layout)

  const contentLayer = await sharp({
    create: {
      width: contentBox.width,
      height: contentBox.height,
      channels: 4,
      background: INNER_BACKGROUND,
    },
  })
    .composite([{ input: subjectLayer }])
    .png()
    .toBuffer()

  const interiorLayerBytes = await sharp({
    create: {
      width: params.width,
      height: params.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: contentLayer, left: contentBox.left, top: contentBox.top }])
    .png()
    .toBuffer()

  return {
    interiorLayerBytes: new Uint8Array(interiorLayerBytes),
    contentBox,
    layout,
  }
}
