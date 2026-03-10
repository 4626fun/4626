import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

type Rgba = {
  r: number
  g: number
  b: number
  a: number
}

async function createPngFromSvg(svg: string): Promise<Uint8Array> {
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

async function samplePixel(bytes: Uint8Array, x: number, y: number): Promise<Rgba> {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const index = (y * info.width + x) * info.channels

  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 0,
  }
}

async function createFrameBytes(): Promise<Uint8Array> {
  return await createPngFromSvg(`
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="transparent"/>
      <rect x="10" y="10" width="180" height="180" rx="28" ry="28" fill="none" stroke="#12d98e" stroke-width="12"/>
    </svg>
  `)
}

async function createOpaqueCenterFrameBytes(): Promise<Uint8Array> {
  return await createPngFromSvg(`
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#060606"/>
      <rect x="10" y="10" width="180" height="180" rx="28" ry="28" fill="none" stroke="#12d98e" stroke-width="12"/>
    </svg>
  `)
}

async function createArtworkBytes(): Promise<Uint8Array> {
  return await createPngFromSvg(`
    <svg width="120" height="80" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="80" fill="#101828"/>
      <circle cx="60" cy="40" r="30" fill="#f3a712"/>
    </svg>
  `)
}

async function createInteriorLayerBytes(): Promise<Uint8Array> {
  return await createPngFromSvg(`
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="transparent"/>
      <rect x="40" y="40" width="120" height="120" fill="#101828"/>
      <rect x="40" y="40" width="8" height="120" fill="#ff4d4f"/>
      <rect x="152" y="40" width="8" height="120" fill="#2f6bff"/>
      <circle cx="100" cy="100" r="18" fill="#f3a712"/>
    </svg>
  `)
}

async function createInteriorMarkerLayerBytes(): Promise<Uint8Array> {
  return await createPngFromSvg(`
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="transparent"/>
      <rect x="40" y="40" width="120" height="120" fill="#101828"/>
      <circle cx="100" cy="100" r="18" fill="#f3a712"/>
    </svg>
  `)
}

const DETECTED_RING_FRAME_CONTENT_BOX = {
  left: 16,
  top: 16,
  width: 168,
  height: 168,
} as const

describe('image compositor', () => {
  it('places artwork inside the fixed content box and preserves the supplied frame as the final overlay', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createPngFromSvg(`
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <rect x="10" y="10" width="180" height="180" rx="28" ry="28" fill="none" stroke="#12d98e" stroke-width="12"/>
      </svg>
    `)
    const redArtworkBytes = await createPngFromSvg(`
      <svg width="120" height="80" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#ff4d4f"/>
      </svg>
    `)
    const blueArtworkBytes = await createPngFromSvg(`
      <svg width="120" height="80" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="80" fill="#2f6bff"/>
      </svg>
    `)

    const redResult = await composeLockedFrameImage({
      artworkBytes: redArtworkBytes,
      frameBytes,
    })
    const blueResult = await composeLockedFrameImage({
      artworkBytes: blueArtworkBytes,
      frameBytes,
    })

    const redCenter = await samplePixel(redResult.imageBytes, 100, 100)
    const blueCenter = await samplePixel(blueResult.imageBytes, 100, 100)
    const sourceFramePixel = await samplePixel(frameBytes, 10, 100)
    const redFramePixel = await samplePixel(redResult.imageBytes, 10, 100)
    const blueFramePixel = await samplePixel(blueResult.imageBytes, 10, 100)

    expect(redResult.contentBox).toEqual(DETECTED_RING_FRAME_CONTENT_BOX)
    expect(redCenter.r).toBeGreaterThan(220)
    expect(redCenter.g).toBeLessThan(110)
    expect(redCenter.b).toBeLessThan(110)
    expect(blueCenter.b).toBeGreaterThan(220)
    expect(blueCenter.r).toBeLessThan(120)
    expect(sourceFramePixel).toEqual({ r: 18, g: 217, b: 142, a: 255 })
    expect(redFramePixel).toEqual(sourceFramePixel)
    expect(blueFramePixel).toEqual(sourceFramePixel)
  })

  it('produces deterministic output with a dark outer background and deterministic glow', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createPngFromSvg(`
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
      </svg>
    `)
    const artworkBytes = await createPngFromSvg(`
      <svg width="120" height="80" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="40" r="32" fill="#f3a712"/>
      </svg>
    `)

    const firstResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
    })
    const secondResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
    })

    const cornerPixel = await samplePixel(firstResult.imageBytes, 5, 5)
    const glowPixel = await samplePixel(firstResult.imageBytes, 30, 100)

    expect(Array.from(firstResult.imageBytes)).toEqual(Array.from(secondResult.imageBytes))
    expect(cornerPixel).toEqual({ r: 10, g: 12, b: 18, a: 255 })
    expect(glowPixel.b).toBeGreaterThan(cornerPixel.b)
    expect(glowPixel.r).toBeGreaterThan(cornerPixel.r)
  })

  it('accepts a pre-rendered full-frame interior layer and still preserves the supplied frame overlay', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const interiorLayerBytes = await createInteriorLayerBytes()

    const result = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
    })

    const leftMarkerPixel = await samplePixel(result.imageBytes, 44, 100)
    const rightMarkerPixel = await samplePixel(result.imageBytes, 155, 100)
    const centerPixel = await samplePixel(result.imageBytes, 100, 100)
    const sourceFramePixel = await samplePixel(frameBytes, 10, 100)
    const resultFramePixel = await samplePixel(result.imageBytes, 10, 100)

    expect(result.contentBox).toEqual(DETECTED_RING_FRAME_CONTENT_BOX)
    expect(leftMarkerPixel.r).toBeGreaterThan(220)
    expect(leftMarkerPixel.g).toBeLessThan(110)
    expect(leftMarkerPixel.b).toBeLessThan(110)
    expect(rightMarkerPixel.b).toBeGreaterThan(220)
    expect(rightMarkerPixel.r).toBeLessThan(120)
    expect(centerPixel.r).toBeGreaterThan(220)
    expect(resultFramePixel).toEqual(sourceFramePixel)
  })

  it('keeps the interior visible when the supplied frame asset has an opaque center', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createOpaqueCenterFrameBytes()
    const interiorLayerBytes = await createInteriorMarkerLayerBytes()

    const result = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
    })

    const sourceFrameCenterPixel = await samplePixel(frameBytes, 100, 100)
    const sourceFrameEdgePixel = await samplePixel(frameBytes, 10, 100)
    const resultCenterPixel = await samplePixel(result.imageBytes, 100, 100)
    const resultEdgePixel = await samplePixel(result.imageBytes, 10, 100)

    expect(sourceFrameCenterPixel.r).toBeLessThan(20)
    expect(sourceFrameCenterPixel.g).toBeLessThan(20)
    expect(sourceFrameCenterPixel.b).toBeLessThan(20)
    expect(resultCenterPixel.r).toBeGreaterThan(220)
    expect(resultCenterPixel.g).toBeGreaterThan(120)
    expect(resultCenterPixel.b).toBeLessThan(80)
    expect(resultEdgePixel).toEqual(sourceFrameEdgePixel)
  })

  it('rejects a pre-rendered interior layer when its dimensions do not match the frame', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const mismatchedInteriorLayerBytes = await createPngFromSvg(`
      <svg width="160" height="200" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="160" height="200" fill="#101828"/>
      </svg>
    `)

    await expect(
      composeLockedFrameImage({
        interiorLayerBytes: mismatchedInteriorLayerBytes,
        frameBytes,
      }),
    ).rejects.toThrow('Pre-rendered interior layer must match the frame dimensions.')
  })

  it('still allows breakout from the extracted cutout when using a pre-rendered interior layer', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const interiorLayerBytes = await createInteriorLayerBytes()
    const portraitForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="60" cy="24" r="18" fill="#f8fafc"/>
        <rect x="34" y="40" width="52" height="60" rx="22" ry="22" fill="#f8fafc"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
    })
    const breakoutResult = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
      extractedForegroundBytes: portraitForegroundBytes,
    })

    const baselineTopPixel = await samplePixel(baselineResult.imageBytes, 100, 28)
    const breakoutTopPixel = await samplePixel(breakoutResult.imageBytes, 100, 28)

    expect(breakoutResult.breakoutApplied).toBe(true)
    expect(breakoutTopPixel.r).toBeGreaterThan(baselineTopPixel.r + 80)
    expect(breakoutTopPixel.g).toBeGreaterThan(baselineTopPixel.g + 80)
    expect(Array.from(breakoutResult.imageBytes)).not.toEqual(Array.from(baselineResult.imageBytes))
  })

  it('falls back cleanly to the same fully in-frame output when a pre-rendered interior layer has no breakout-worthy cutout', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const interiorLayerBytes = await createInteriorLayerBytes()
    const weakForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="60" cy="48" r="7" fill="#ffffff"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
    })
    const result = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
      extractedForegroundBytes: weakForegroundBytes,
    })

    expect(Array.from(result.imageBytes)).toEqual(Array.from(baselineResult.imageBytes))
    expect(result.breakoutApplied).toBe(false)
  })

  it('skips breakout when extracted foreground coverage is too weak', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()
    const weakForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="60" cy="48" r="7" fill="#ffffff"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })
    const result = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      extractedForegroundBytes: weakForegroundBytes,
      layoutHint: 'contain',
    })

    expect(Array.from(result.imageBytes)).toEqual(Array.from(baselineResult.imageBytes))
    expect(result.breakoutApplied).toBe(false)
  })

  it('skips breakout when extracted foreground is fragmented', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()
    const fragmentedForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="28" cy="24" r="10" fill="#ffffff"/>
        <circle cx="60" cy="20" r="10" fill="#ffffff"/>
        <circle cx="92" cy="26" r="10" fill="#ffffff"/>
        <circle cx="38" cy="56" r="8" fill="#ffffff"/>
        <circle cx="82" cy="54" r="8" fill="#ffffff"/>
        <circle cx="60" cy="88" r="9" fill="#ffffff"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })
    const result = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      extractedForegroundBytes: fragmentedForegroundBytes,
      layoutHint: 'contain',
    })

    expect(Array.from(result.imageBytes)).toEqual(Array.from(baselineResult.imageBytes))
    expect(result.breakoutApplied).toBe(false)
  })

  it('skips breakout when extracted foreground looks logo-like', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()
    const logoLikeForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <rect x="18" y="36" width="84" height="28" rx="10" ry="10" fill="#ffffff"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })
    const result = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      extractedForegroundBytes: logoLikeForegroundBytes,
      layoutHint: 'contain',
    })

    expect(Array.from(result.imageBytes)).toEqual(Array.from(baselineResult.imageBytes))
    expect(result.breakoutApplied).toBe(false)
  })

  it('enables breakout only when the top-region silhouette quality is high', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()
    const portraitForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="60" cy="24" r="18" fill="#f8fafc"/>
        <rect x="34" y="40" width="52" height="60" rx="22" ry="22" fill="#f8fafc"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })
    const breakoutResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      extractedForegroundBytes: portraitForegroundBytes,
      layoutHint: 'contain',
    })

    const baselineTopPixel = await samplePixel(baselineResult.imageBytes, 100, 28)
    const breakoutTopPixel = await samplePixel(breakoutResult.imageBytes, 100, 28)

    expect(breakoutResult.breakoutApplied).toBe(true)
    expect(breakoutTopPixel.r).toBeGreaterThan(baselineTopPixel.r + 80)
    expect(breakoutTopPixel.g).toBeGreaterThan(baselineTopPixel.g + 80)
    expect(Array.from(breakoutResult.imageBytes)).not.toEqual(Array.from(baselineResult.imageBytes))
  })

  it('uses the configured lower fade zone instead of keeping the breakout fully solid until cutoff', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()
    const portraitForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="60" cy="24" r="18" fill="#f8fafc"/>
        <rect x="34" y="40" width="52" height="60" rx="22" ry="22" fill="#f8fafc"/>
      </svg>
    `)

    const baselineResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })
    const breakoutResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      extractedForegroundBytes: portraitForegroundBytes,
      layoutHint: 'contain',
    })

    const breakoutTopPixel = await samplePixel(breakoutResult.imageBytes, 100, 28)
    const fadeBottom = Math.min(breakoutResult.contentBox.top + 60, 199)
    const fadeSampleY = Math.min(breakoutResult.contentBox.top + 30, fadeBottom - 1)
    const baselineFadePixel = await samplePixel(baselineResult.imageBytes, 100, fadeSampleY)
    const breakoutFadePixel = await samplePixel(breakoutResult.imageBytes, 100, fadeSampleY)
    const baselineFadeEndPixel = await samplePixel(baselineResult.imageBytes, 100, fadeBottom)
    const breakoutFadeEndPixel = await samplePixel(breakoutResult.imageBytes, 100, fadeBottom)

    expect(breakoutResult.breakoutApplied).toBe(true)
    expect(breakoutFadePixel.r).toBeGreaterThan(baselineFadePixel.r + 10)
    expect(breakoutFadePixel.r).toBeLessThan(breakoutTopPixel.r - 40)
    expect(breakoutFadeEndPixel).toEqual(baselineFadeEndPixel)
  })

  it('falls back to the exact fully-in-frame composition without throwing when foreground processing fails', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()

    const baselineResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })

    await expect(
      composeLockedFrameImage({
        artworkBytes,
        frameBytes,
        extractedForegroundBytes: new Uint8Array([1, 2, 3, 4, 5]),
        layoutHint: 'contain',
      }),
    ).resolves.toMatchObject({
      contentBox: baselineResult.contentBox,
      breakoutApplied: false,
    })

    const fallbackResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      extractedForegroundBytes: new Uint8Array([1, 2, 3, 4, 5]),
      layoutHint: 'contain',
    })

    expect(Array.from(fallbackResult.imageBytes)).toEqual(Array.from(baselineResult.imageBytes))
  })

  it('auto-classifies an opaque artwork as cover and uses cover fit', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const opaqueArtworkBytes = await createPngFromSvg(`
      <svg width="300" height="200" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#2c3e50"/>
        <circle cx="150" cy="100" r="60" fill="#e67e22"/>
      </svg>
    `)

    const result = await composeLockedFrameImage({
      artworkBytes: opaqueArtworkBytes,
      frameBytes,
    })

    expect(result.layout).toBe('cover')
    expect(result.contentBox).toEqual(DETECTED_RING_FRAME_CONTENT_BOX)
  })

  it('auto-classifies a transparent cutout as contain', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const cutoutArtworkBytes = await createPngFromSvg(`
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="100" cy="50" r="30" fill="#f1c40f"/>
        <rect x="70" y="75" width="60" height="100" rx="16" fill="#f1c40f"/>
      </svg>
    `)

    const result = await composeLockedFrameImage({
      artworkBytes: cutoutArtworkBytes,
      frameBytes,
    })

    expect(result.layout).toBe('contain')
  })

  it('auto-classifies a circular badge as coin and places it smaller than contain', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const coinArtworkBytes = await createPngFromSvg(`
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="100" cy="100" r="80" fill="#3498db"/>
      </svg>
    `)

    const result = await composeLockedFrameImage({
      artworkBytes: coinArtworkBytes,
      frameBytes,
    })

    expect(result.layout).toBe('coin')
  })

  it('respects layoutHint and skips auto-classification', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const artworkBytes = await createArtworkBytes()

    const containResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'contain',
    })
    const coverResult = await composeLockedFrameImage({
      artworkBytes,
      frameBytes,
      layoutHint: 'cover',
    })

    expect(containResult.layout).toBe('contain')
    expect(coverResult.layout).toBe('cover')
    expect(Array.from(containResult.imageBytes)).not.toEqual(Array.from(coverResult.imageBytes))
  })

  it('disables breakout for coin layout even when foreground passes heuristics', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const coinArtworkBytes = await createPngFromSvg(`
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="transparent"/>
        <circle cx="100" cy="100" r="80" fill="#3498db"/>
      </svg>
    `)
    const portraitForegroundBytes = await createPngFromSvg(`
      <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="transparent"/>
        <circle cx="60" cy="24" r="18" fill="#f8fafc"/>
        <rect x="34" y="40" width="52" height="60" rx="22" ry="22" fill="#f8fafc"/>
      </svg>
    `)

    const result = await composeLockedFrameImage({
      artworkBytes: coinArtworkBytes,
      frameBytes,
      extractedForegroundBytes: portraitForegroundBytes,
    })

    expect(result.layout).toBe('coin')
    expect(result.breakoutApplied).toBe(false)
  })

  it('defaults to contain layout when using interiorLayerBytes without artworkBytes', async () => {
    const { composeLockedFrameImage } = await import('./imageCompositor.ts')

    const frameBytes = await createFrameBytes()
    const interiorLayerBytes = await createInteriorLayerBytes()

    const result = await composeLockedFrameImage({
      interiorLayerBytes,
      frameBytes,
    })

    expect(result.layout).toBe('contain')
  })
})