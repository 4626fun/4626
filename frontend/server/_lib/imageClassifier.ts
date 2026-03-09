import sharp from 'sharp'

export type ArtworkLayout = 'cover' | 'contain' | 'coin'

const ALPHA_OPAQUE_THRESHOLD = 128
const EDGE_SAMPLE_DEPTH = 2
const MIN_CLASSIFIABLE_DIMENSION = 4

const COVER_MAX_TRANSPARENCY = 0.05
const COVER_MAX_EDGE_TRANSPARENCY = 0.15
const COIN_MIN_TRANSPARENCY = 0.15
const COIN_MAX_ASPECT_DEVIATION = 0.18
const COIN_MAX_CENTER_DRIFT = 0.12
const COIN_MIN_TRANSPARENT_CORNERS = 3

/**
 * Classifies source artwork into a layout strategy via transparency + shape analysis.
 *
 * cover   - full-bleed opaque image (photos, paintings, opaque rectangles)
 * contain - transparent background with non-circular content (logos, cutout mascots, vectors)
 * coin    - circular/badge-like content centered on a transparent background
 */
export async function classifyArtwork(imageBytes: Uint8Array): Promise<ArtworkLayout> {
  const { data, info } = await sharp(Buffer.from(imageBytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info

  if (width < MIN_CLASSIFIABLE_DIMENSION || height < MIN_CLASSIFIABLE_DIMENSION) {
    return 'contain'
  }

  const totalPixels = width * height
  let transparentPixels = 0
  let edgeTransparentPixels = 0
  let edgePixelCount = 0
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3]
      const isTransparent = alpha < ALPHA_OPAQUE_THRESHOLD
      const isEdge =
        x < EDGE_SAMPLE_DEPTH ||
        x >= width - EDGE_SAMPLE_DEPTH ||
        y < EDGE_SAMPLE_DEPTH ||
        y >= height - EDGE_SAMPLE_DEPTH

      if (isTransparent) {
        transparentPixels++
      } else {
        if (x < left) left = x
        if (y < top) top = y
        if (x > right) right = x
        if (y > bottom) bottom = y
      }

      if (isEdge) {
        edgePixelCount++
        if (isTransparent) edgeTransparentPixels++
      }
    }
  }

  const transparencyRatio = transparentPixels / totalPixels
  const edgeTransparencyRatio = edgePixelCount > 0 ? edgeTransparentPixels / edgePixelCount : 0

  if (transparencyRatio <= COVER_MAX_TRANSPARENCY && edgeTransparencyRatio <= COVER_MAX_EDGE_TRANSPARENCY) {
    return 'cover'
  }

  if (transparencyRatio >= COIN_MIN_TRANSPARENCY && right >= left && bottom >= top) {
    const boundsW = right - left + 1
    const boundsH = bottom - top + 1
    const aspect = boundsW / Math.max(1, boundsH)
    const isSquarish = Math.abs(aspect - 1) <= COIN_MAX_ASPECT_DEVIATION

    const imgCx = width / 2
    const imgCy = height / 2
    const bndCx = (left + right) / 2
    const bndCy = (top + bottom) / 2
    const isCentered =
      Math.abs(imgCx - bndCx) < width * COIN_MAX_CENTER_DRIFT &&
      Math.abs(imgCy - bndCy) < height * COIN_MAX_CENTER_DRIFT

    if (isSquarish && isCentered) {
      const corners: [number, number][] = [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ]
      let transparentCornerCount = 0
      for (const [cx, cy] of corners) {
        if (data[(cy * width + cx) * channels + 3] < ALPHA_OPAQUE_THRESHOLD) {
          transparentCornerCount++
        }
      }

      if (transparentCornerCount >= COIN_MIN_TRANSPARENT_CORNERS) {
        return 'coin'
      }
    }
  }

  return 'contain'
}
