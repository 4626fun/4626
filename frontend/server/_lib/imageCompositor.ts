import sharp from 'sharp'
import { classifyArtwork, type ArtworkLayout } from './imageClassifier.js'
import { getFixedContentBox, getContentBoxInnerRadius, type FixedContentBox } from './imageContentBox.js'

export type ImageCompositorBox = FixedContentBox

export type ComposeLockedFrameImageParams = {
  artworkBytes?: Uint8Array
  interiorLayerBytes?: Uint8Array
  frameBytes: Uint8Array
  extractedForegroundBytes?: Uint8Array | null
  layoutHint?: ArtworkLayout
  /** Skip heuristic subject-detection and always render the breakout layer. */
  forceBreakout?: boolean
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
const BREAKOUT_RISE_RATIO = 0.10
const COIN_INNER_SCALE = 0.82

function buildGlowSvg(width: number, height: number, contentBox: ImageCompositorBox): Buffer {
  const cx = contentBox.left + contentBox.width / 2
  const cy = contentBox.top + contentBox.height / 2
  // Large ellipse — radius covers the full canvas for a dramatic bloom
  const rx = Math.round(width * 0.54)
  const ry = Math.round(height * 0.54)

  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs>` +
      `<radialGradient id="g" cx="${cx}" cy="${cy}" r="${Math.max(rx, ry)}" fx="${cx}" fy="${cy}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0%"   stop-color="#507fff" stop-opacity="0.75"/>` +
      `<stop offset="28%"  stop-color="#4070ee" stop-opacity="0.46"/>` +
      `<stop offset="60%"  stop-color="#3060cc" stop-opacity="0.20"/>` +
      `<stop offset="100%" stop-color="#2050aa" stop-opacity="0"/>` +
      `</radialGradient></defs>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#g)"/>` +
      `</svg>`,
  )
}

type AlphaBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

async function renderForegroundLayer(
  foregroundBytes: Uint8Array,
  contentBox: ImageCompositorBox,
  layout: ArtworkLayout = 'contain',
  /** Match the interior artwork's target height so both layers share the same
   *  scale. Pass artworkVerticalShift here when the interior uses an extended
   *  target box to fill the bottom. */
  extraHeight = 0,
): Promise<Buffer> {
  const targetH = contentBox.height + extraHeight
  // For cover layouts the foreground must match the artwork's scale and crop so
  // the head above the frame aligns with the head shown inside the frame.
  // Use 'top' position so the ears (top of the trimmed source) are never cropped;
  // only the bottom overflows when the source is taller than the target ratio.
  if (layout === 'cover') {
    return await sharp(Buffer.from(foregroundBytes))
      .ensureAlpha()
      .resize(contentBox.width, targetH, {
        fit: 'cover',
        position: 'top',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
  }

  return await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .resize(contentBox.width, targetH, {
      fit: 'contain',
      position: 'top',
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
    // Use 'top' so the subject's head (top of the source) is always preserved
    // and only the bottom overflows. This keeps the interior artwork aligned
    // with the breakout foreground layer which also uses position: 'top'.
    return await sharp(Buffer.from(artworkBytes))
      .resize(contentBox.width, contentBox.height, {
        fit: 'cover',
        position: 'top',
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

function buildRoundedClipSvg(
  width: number,
  height: number,
  contentBox: ImageCompositorBox,
  rx: number,
): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="${contentBox.left}" y="${contentBox.top}" width="${contentBox.width}" height="${contentBox.height}" rx="${rx}" ry="${rx}" fill="white"/>` +
      `</svg>`,
  )
}

async function buildInteriorLayer(params: {
  width: number
  height: number
  contentBox: ImageCompositorBox
  artworkBytes?: Uint8Array
  interiorLayerBytes?: Uint8Array
  layout: ArtworkLayout
  /** Shift artwork up this many px so the interior starts at the same subject row
   *  that the breakout foreground shows at the frame boundary — eliminates the
   *  double-subject discontinuity when a large rise is used. */
  artworkVerticalShift?: number
}): Promise<Buffer> {
  const { width, height, contentBox, artworkBytes, interiorLayerBytes, layout, artworkVerticalShift = 0 } = params

  if (interiorLayerBytes && interiorLayerBytes.length > 0) {
    const interiorLayerBuffer = Buffer.from(interiorLayerBytes)
    const interiorMetadata = await sharp(interiorLayerBuffer).metadata()

    if (interiorMetadata.width !== width || interiorMetadata.height !== height) {
      throw new Error('Pre-rendered interior layer must match the frame dimensions.')
    }

    return await sharp(interiorLayerBuffer).png().toBuffer()
  }

  if (artworkBytes && artworkBytes.length > 0) {
    // When shifting the artwork up, resize to a taller target box so that real
    // photo/artwork content fills the bottom rows instead of dark fill.
    // artworkLayer will be (contentBox.width × (contentBox.height + shift)) of
    // actual source content; no dark extension required.
    // Extend the target height so real photo content fills the bottom rows
    // instead of dark fill. Clamp to canvas height so the composite never fails.
    const targetBox =
      artworkVerticalShift > 0
        ? { ...contentBox, height: Math.min(contentBox.height + artworkVerticalShift, height) }
        : contentBox
    const artworkLayerFinal = await resizeArtworkForLayout(artworkBytes, targetBox, layout)

    const canvas = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      // Shift artwork up by artworkVerticalShift so at the frame top the artwork
      // and the breakout foreground both show the same pixel row of the subject.
      .composite([{ input: artworkLayerFinal, left: contentBox.left, top: Math.max(0, contentBox.top - artworkVerticalShift) }])
      .png()
      .toBuffer()

    // Clip to the frame's actual inner rounded rectangle so the artwork
    // has matching corner geometry instead of hard rectangular corners.
    const rx = getContentBoxInnerRadius(contentBox)
    const clipMask = await sharp(buildRoundedClipSvg(width, height, contentBox, rx)).png().toBuffer()
    return await sharp(canvas)
      .composite([{ input: clipMask, blend: 'dest-in' }])
      .png()
      .toBuffer()
  }

  throw new Error('Locked frame composition requires artworkBytes or interiorLayerBytes.')
}

function buildFrameOverlayMaskSvg(width: number, height: number, contentBox: ImageCompositorBox): Buffer {
  const rx = getContentBoxInnerRadius(contentBox)
  // Outer fill covers the whole canvas; inner rounded rect punches the hole so
  // frame ring pixels that arc INTO the content area are correctly preserved.
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${width}" height="${height}" fill="white"/>` +
      `<rect x="${contentBox.left}" y="${contentBox.top}" width="${contentBox.width}" height="${contentBox.height}" rx="${rx}" ry="${rx}" fill="black"/>` +
      `</svg>`,
  )
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
  const zoneTop = Math.max(0, contentBox.top - riseAboveFrame)
  // Top zone: solid above the frame, fades into the frame interior over 60px.
  // A wider fade makes any sub-pixel RGB mismatch between the breakout and
  // interior layers imperceptible — critical for flat/horizontal shapes like
  // hat brims that cross the frame boundary.
  const topFadeBottom = Math.min(contentBox.top + 60, height)
  const topZoneHeight = Math.max(1, topFadeBottom - zoneTop)
  const topSolidEnd = Math.max(0, (contentBox.top - zoneTop) / topZoneHeight)

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="breakout-top" gradientUnits="userSpaceOnUse" x1="0" y1="${zoneTop}" x2="0" y2="${topFadeBottom}">
        <stop offset="0"           stop-color="white" stop-opacity="1"/>
        <stop offset="${topSolidEnd}" stop-color="white" stop-opacity="1"/>
        <stop offset="1"           stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="${contentBox.left}" y="${zoneTop}" width="${contentBox.width}" height="${topZoneHeight}" fill="url(#breakout-top)"/>
  </svg>`)
}


async function buildBreakoutLayer(params: {
  width: number
  height: number
  contentBox: ImageCompositorBox
  extractedForegroundBytes: Uint8Array
  layout: ArtworkLayout
  forceBreakout?: boolean
}): Promise<Buffer | null> {
  const { width, height, contentBox, extractedForegroundBytes, layout, forceBreakout } = params
  const riseAboveFrame = Math.round(contentBox.height * BREAKOUT_RISE_RATIO)
  // Render at the same extended target height as the interior artwork so both
  // layers share an identical scale — eliminates the proportion mismatch at the
  // frame top boundary.
  const renderedForeground = await renderForegroundLayer(
    extractedForegroundBytes,
    contentBox,
    layout,
    riseAboveFrame,
  )
  const breakoutAllowed = forceBreakout ? true : await shouldApplyBreakout(renderedForeground)

  if (!breakoutAllowed) {
    return null
  }

  const shiftedTop = Math.max(0, contentBox.top - riseAboveFrame)
  const shiftedForeground = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
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

/**
 * Detect the inner content box of a frame PNG by scanning inward from the
 * image center until opaque ring pixels are hit on each axis. Falls back to
 * the hardcoded SVG-geometry values when the frame is transparent at the center.
 */
async function detectFrameContentBox(
  frameBuffer: Buffer,
  width: number,
  height: number,
): Promise<ImageCompositorBox> {
  try {
    const { data, info } = await sharp(frameBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const ch = info.channels
    const cx = Math.floor(width / 2)
    const cy = Math.floor(height / 2)
    const OPAQUE = 32

    const alpha = (x: number, y: number) => data[(y * width + x) * ch + 3]

    // Scan from center outward on each axis to find the ring's inner edge.
    // Use a high threshold (200) to skip glow spill pixels (which peak at
    // ~155–237 alpha inside the ring) and land on the solid stroke itself.
    const SOLID = 200
    let leftEdge = 0, rightEdge = width - 1, topEdge = 0, bottomEdge = height - 1
    for (let x = cx; x >= 0; x--) { if (alpha(x, cy) >= SOLID) { leftEdge = x + 1; break } }
    for (let x = cx; x < width; x++) { if (alpha(x, cy) >= SOLID) { rightEdge = x - 1; break } }
    for (let y = cy; y >= 0; y--) { if (alpha(cx, y) >= SOLID) { topEdge = y + 1; break } }
    for (let y = cy; y < height; y++) { if (alpha(cx, y) >= SOLID) { bottomEdge = y - 1; break } }

    // Symmetrize: take the largest margin on each axis so the box is centered
    const marginH = Math.max(leftEdge, width - 1 - rightEdge)
    const marginV = Math.max(topEdge, height - 1 - bottomEdge)
    const left = marginH, top = marginV
    const boxWidth = width - 2 * marginH
    const boxHeight = height - 2 * marginV
    if (boxWidth < 32 || boxHeight < 32) throw new Error('Degenerate content box detected')

    return { left, top, width: boxWidth, height: boxHeight }
  } catch {
    return getFixedContentBox(width, height)
  }
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
  const contentBox = await detectFrameContentBox(frameBuffer, width, height)

  const layout: ArtworkLayout = params.layoutHint ??
    (params.artworkBytes ? await classifyArtwork(params.artworkBytes) : 'contain')

  const frameOverlayLayer = await buildFrameOverlayLayer({
    width,
    height,
    contentBox,
    frameBuffer,
  })

  // Pre-compute the breakout rise so the interior artwork can be shifted by the
  // same amount — this ensures both layers show the same subject pixel row at the
  // frame boundary, eliminating the double-subject discontinuity.
  const breakoutAllowedForLayout = layout !== 'coin'
  const willBreakout =
    breakoutAllowedForLayout &&
    (params.forceBreakout || false) &&
    !!params.extractedForegroundBytes?.length
  const riseAboveFrame = willBreakout ? Math.round(contentBox.height * BREAKOUT_RISE_RATIO) : 0

  const interiorLayer = await buildInteriorLayer({
    width,
    height,
    contentBox,
    artworkBytes: params.artworkBytes,
    interiorLayerBytes: params.interiorLayerBytes,
    layout,
    artworkVerticalShift: riseAboveFrame,
  })

  const glowLayer = await sharp(buildGlowSvg(width, height, contentBox)).png().toBuffer()
  let breakoutLayer: Buffer | null = null

  if (breakoutAllowedForLayout && params.extractedForegroundBytes && params.extractedForegroundBytes.length > 0) {
    try {
      breakoutLayer = await buildBreakoutLayer({
        width,
        height,
        contentBox,
        extractedForegroundBytes: params.extractedForegroundBytes,
        layout,
        forceBreakout: params.forceBreakout,
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
