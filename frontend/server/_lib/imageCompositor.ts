import sharp from 'sharp'
import { classifyArtwork, type ArtworkLayout } from './imageClassifier.js'
import { getFixedContentBox, type FixedContentBox } from './imageContentBox.js'

export type ImageCompositorBox = FixedContentBox

export type ComposeLockedFrameImageParams = {
  artworkBytes?: Uint8Array
  interiorLayerBytes?: Uint8Array
  frameBytes: Uint8Array
  extractedForegroundBytes?: Uint8Array | null
  layoutHint?: ArtworkLayout
}

export type ComposeLockedFrameImageResult = {
  imageBytes: Uint8Array
  contentBox: ImageCompositorBox
  breakoutApplied: boolean
  layout: ArtworkLayout
}

const BACKGROUND = { r: 10, g: 12, b: 18, alpha: 1 }
const ALPHA_THRESHOLD = 24
const MIN_FOREGROUND_COVERAGE_RATIO = 0.08
const MIN_FOREGROUND_HEIGHT_RATIO = 0.42
const MAX_FOREGROUND_WIDTH_RATIO = 0.86
const MAX_FOREGROUND_ASPECT_RATIO = 1.35
const MIN_TOP_COVERAGE_RATIO = 0.06
const MIN_COHERENT_TOP_ROWS = 8
const MAX_FRAGMENTED_TOP_ROWS = 2
const BREAKOUT_RISE_RATIO = 0.15
const BREAKOUT_VISIBLE_BELOW_RATIO = 0.18
const BREAKOUT_FADE_BELOW_RATIO = 0.42
const COIN_INNER_SCALE = 0.82

function buildGlowSvg(width: number, height: number, contentBox: ImageCompositorBox): Buffer {
  const centerX = contentBox.left + contentBox.width / 2
  const centerY = contentBox.top + contentBox.height / 2
  const radiusX = Math.round(contentBox.width * 0.8)
  const radiusY = Math.round(contentBox.height * 0.8)

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="locked-frame-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(90, 122, 255, 0.34)" />
          <stop offset="58%" stop-color="rgba(90, 122, 255, 0.18)" />
          <stop offset="100%" stop-color="rgba(90, 122, 255, 0)" />
        </radialGradient>
      </defs>
      <ellipse cx="${centerX}" cy="${centerY}" rx="${radiusX}" ry="${radiusY}" fill="url(#locked-frame-glow)" />
    </svg>
  `)
}

type AlphaBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

async function renderForegroundLayer(foregroundBytes: Uint8Array, contentBox: ImageCompositorBox): Promise<Buffer> {
  return await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .resize(contentBox.width, contentBox.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

async function resizeArtworkForLayout(
  artworkBytes: Uint8Array,
  contentBox: ImageCompositorBox,
  layout: ArtworkLayout,
): Promise<Buffer> {
  if (layout === 'cover') {
    return await sharp(Buffer.from(artworkBytes))
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

    return await sharp(Buffer.from(artworkBytes))
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

  return await sharp(Buffer.from(artworkBytes))
    .resize(contentBox.width, contentBox.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

async function buildInteriorLayer(params: {
  width: number
  height: number
  contentBox: ImageCompositorBox
  artworkBytes?: Uint8Array
  interiorLayerBytes?: Uint8Array
  layout: ArtworkLayout
}): Promise<Buffer> {
  const { width, height, contentBox, artworkBytes, interiorLayerBytes, layout } = params

  if (interiorLayerBytes && interiorLayerBytes.length > 0) {
    const interiorLayerBuffer = Buffer.from(interiorLayerBytes)
    const interiorMetadata = await sharp(interiorLayerBuffer).metadata()

    if (interiorMetadata.width !== width || interiorMetadata.height !== height) {
      throw new Error('Pre-rendered interior layer must match the frame dimensions.')
    }

    return await sharp(interiorLayerBuffer).png().toBuffer()
  }

  if (artworkBytes && artworkBytes.length > 0) {
    const artworkLayer = await resizeArtworkForLayout(artworkBytes, contentBox, layout)

    return await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: artworkLayer, left: contentBox.left, top: contentBox.top }])
      .png()
      .toBuffer()
  }

  throw new Error('Locked frame composition requires artworkBytes or interiorLayerBytes.')
}

function buildFrameOverlayMaskSvg(width: number, height: number, contentBox: ImageCompositorBox): Buffer {
  const contentRight = contentBox.left + contentBox.width
  const contentBottom = contentBox.top + contentBox.height

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="white"
      fill-rule="evenodd"
      d="M0 0H${width}V${height}H0Z M${contentBox.left} ${contentBox.top}H${contentRight}V${contentBottom}H${contentBox.left}Z"
    />
  </svg>`)
}

async function buildFrameOverlayLayer(params: {
  width: number
  height: number
  contentBox: ImageCompositorBox
  frameBuffer: Buffer
}): Promise<Buffer> {
  const frameOverlayMask = await sharp(
    buildFrameOverlayMaskSvg(params.width, params.height, params.contentBox),
  )
    .png()
    .toBuffer()

  return await sharp(params.frameBuffer)
    .ensureAlpha()
    .composite([{ input: frameOverlayMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function getAlphaBounds(imageBytes: Buffer, threshold = ALPHA_THRESHOLD): Promise<AlphaBounds | null> {
  const { data, info } = await sharp(imageBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  let left = info.width
  let top = info.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if (alpha >= threshold) {
        if (x < left) left = x
        if (y < top) top = y
        if (x > right) right = x
        if (y > bottom) bottom = y
      }
    }
  }

  if (right < left || bottom < top) {
    return null
  }

  return { left, top, right, bottom }
}

async function shouldApplyBreakout(foregroundLayer: Buffer): Promise<boolean> {
  const bounds = await getAlphaBounds(foregroundLayer)
  if (!bounds) {
    return false
  }

  const { data, info } = await sharp(foregroundLayer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const boundsWidth = bounds.right - bounds.left + 1
  const boundsHeight = bounds.bottom - bounds.top + 1
  const coverageDenominator = info.width * info.height
  const topSliceHeight = Math.max(1, Math.round(info.height * 0.34))

  let opaquePixels = 0
  let topOpaquePixels = 0
  let coherentTopRows = 0
  let fragmentedTopRows = 0

  for (let y = 0; y < info.height; y += 1) {
    let segments = 0
    let rowOpaquePixels = 0
    let inOpaqueSegment = false

    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      const opaque = alpha >= ALPHA_THRESHOLD

      if (opaque) {
        opaquePixels += 1
        rowOpaquePixels += 1
        if (y < topSliceHeight) {
          topOpaquePixels += 1
        }
      }

      if (opaque && !inOpaqueSegment) {
        segments += 1
        inOpaqueSegment = true
      } else if (!opaque) {
        inOpaqueSegment = false
      }
    }

    if (y < topSliceHeight && rowOpaquePixels > 0) {
      if (segments <= 2 && rowOpaquePixels >= Math.round(info.width * 0.12)) {
        coherentTopRows += 1
      }
      if (segments > 2) {
        fragmentedTopRows += 1
      }
    }
  }

  const coverageRatio = opaquePixels / coverageDenominator
  const topCoverageRatio = topOpaquePixels / (info.width * topSliceHeight)
  const widthRatio = boundsWidth / info.width
  const heightRatio = boundsHeight / info.height
  const aspectRatio = boundsWidth / Math.max(1, boundsHeight)

  return (
    coverageRatio >= MIN_FOREGROUND_COVERAGE_RATIO &&
    heightRatio >= MIN_FOREGROUND_HEIGHT_RATIO &&
    widthRatio <= MAX_FOREGROUND_WIDTH_RATIO &&
    aspectRatio <= MAX_FOREGROUND_ASPECT_RATIO &&
    topCoverageRatio >= MIN_TOP_COVERAGE_RATIO &&
    coherentTopRows >= MIN_COHERENT_TOP_ROWS &&
    fragmentedTopRows <= MAX_FRAGMENTED_TOP_ROWS
  )
}

function buildBreakoutMaskSvg(width: number, height: number, contentBox: ImageCompositorBox): Buffer {
  const riseAboveFrame = Math.round(contentBox.height * BREAKOUT_RISE_RATIO)
  const visibleBelowFrame = Math.round(contentBox.height * BREAKOUT_VISIBLE_BELOW_RATIO)
  const fadeBelowFrame = Math.max(visibleBelowFrame + 1, Math.round(contentBox.height * BREAKOUT_FADE_BELOW_RATIO))
  const zoneTop = Math.max(0, contentBox.top - riseAboveFrame)
  const solidBottom = Math.min(height, contentBox.top + visibleBelowFrame)
  const fadeBottom = Math.min(height, contentBox.top + fadeBelowFrame)
  const zoneHeight = Math.max(1, fadeBottom - zoneTop)
  const gradientSolidEnd = Math.max(0, (solidBottom - zoneTop) / zoneHeight)

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="breakout-zone" gradientUnits="userSpaceOnUse" x1="0" y1="${zoneTop}" x2="0" y2="${fadeBottom}">
        <stop offset="0" stop-color="white" stop-opacity="1"/>
        <stop offset="${gradientSolidEnd}" stop-color="white" stop-opacity="1"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect
      x="${contentBox.left}"
      y="${zoneTop}"
      width="${contentBox.width}"
      height="${zoneHeight}"
      fill="url(#breakout-zone)"
    />
  </svg>`)
}

async function buildBreakoutLayer(params: {
  width: number
  height: number
  contentBox: ImageCompositorBox
  extractedForegroundBytes: Uint8Array
}): Promise<Buffer | null> {
  const { width, height, contentBox, extractedForegroundBytes } = params
  const renderedForeground = await renderForegroundLayer(extractedForegroundBytes, contentBox)
  const breakoutAllowed = await shouldApplyBreakout(renderedForeground)

  if (!breakoutAllowed) {
    return null
  }

  const riseAboveFrame = Math.round(contentBox.height * BREAKOUT_RISE_RATIO)
  const shiftedTop = Math.max(0, contentBox.top - riseAboveFrame)
  const shiftedForeground = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: renderedForeground, left: contentBox.left, top: shiftedTop }])
    .png()
    .toBuffer()

  const maskBuffer = await sharp(buildBreakoutMaskSvg(width, height, contentBox)).png().toBuffer()

  return await sharp(shiftedForeground)
    .ensureAlpha()
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

export async function composeLockedFrameImage(
  params: ComposeLockedFrameImageParams,
): Promise<ComposeLockedFrameImageResult> {
  const frameBuffer = Buffer.from(params.frameBytes)
  const frameMetadata = await sharp(frameBuffer).metadata()

  if (!frameMetadata.width || !frameMetadata.height) {
    throw new Error('Frame asset must include width and height.')
  }

  const width = frameMetadata.width
  const height = frameMetadata.height
  const contentBox = getFixedContentBox(width, height)

  const layout: ArtworkLayout = params.layoutHint ??
    (params.artworkBytes ? await classifyArtwork(params.artworkBytes) : 'contain')

  const frameOverlayLayer = await buildFrameOverlayLayer({
    width,
    height,
    contentBox,
    frameBuffer,
  })

  const interiorLayer = await buildInteriorLayer({
    width,
    height,
    contentBox,
    artworkBytes: params.artworkBytes,
    interiorLayerBytes: params.interiorLayerBytes,
    layout,
  })

  const glowLayer = await sharp(buildGlowSvg(width, height, contentBox)).png().toBuffer()
  let breakoutLayer: Buffer | null = null

  const breakoutAllowedForLayout = layout !== 'coin'

  if (breakoutAllowedForLayout && params.extractedForegroundBytes && params.extractedForegroundBytes.length > 0) {
    try {
      breakoutLayer = await buildBreakoutLayer({
        width,
        height,
        contentBox,
        extractedForegroundBytes: params.extractedForegroundBytes,
      })
    } catch {
      breakoutLayer = null
    }
  }

  const composites: sharp.OverlayOptions[] = [
    { input: glowLayer },
    { input: interiorLayer },
    { input: frameOverlayLayer },
  ]

  if (breakoutLayer) {
    composites.push({ input: breakoutLayer })
  }

  const imageBytes = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite(composites)
    .png()
    .toBuffer()

  return {
    imageBytes: new Uint8Array(imageBytes),
    contentBox,
    breakoutApplied: breakoutLayer !== null,
    layout,
  }
}
