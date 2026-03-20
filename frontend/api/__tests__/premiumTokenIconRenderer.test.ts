import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { __testables, renderPremiumTokenIcon } from '../_handlers/token/_premiumTokenIconRenderer.js'

async function createSource(params: {
  width: number
  height: number
}): Promise<Uint8Array> {
  const { width, height } = params
  const layer = await sharp({
    create: {
      width: Math.round(width * 0.5),
      height: Math.round(height * 0.4),
      channels: 4,
      background: { r: 32, g: 146, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer()

  const base = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 217, g: 84, b: 68, alpha: 1 },
    },
  })
    .composite([
      {
        input: layer,
        top: Math.round(height * 0.05),
        left: Math.round(width * 0.24),
      },
    ])
    .png()
    .toBuffer()

  return new Uint8Array(base)
}

async function createPreparedHeroCutout(params: {
  width: number
  height: number
}): Promise<Uint8Array> {
  const { width, height } = params
  const centerX = Math.round(width * 0.5)
  const hero = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: Math.round(width * 0.18),
            height: Math.round(height * 0.14),
            channels: 4,
            background: { r: 235, g: 240, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: centerX - Math.round(width * 0.09),
        top: Math.round(height * 0.07),
      },
      {
        input: await sharp({
          create: {
            width: Math.round(width * 0.28),
            height: Math.round(height * 0.22),
            channels: 4,
            background: { r: 68, g: 190, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: centerX - Math.round(width * 0.14),
        top: Math.round(height * 0.15),
      },
    ])
    .png()
    .toBuffer()
  return new Uint8Array(hero)
}

async function createTransparentSource(params: {
  width: number
  height: number
}): Promise<Uint8Array> {
  const { width, height } = params
  const centerX = Math.round(width * 0.5)
  const source = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: Math.round(width * 0.32),
            height: Math.round(height * 0.2),
            channels: 4,
            background: { r: 24, g: 188, b: 202, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: centerX - Math.round(width * 0.16),
        top: Math.round(height * 0.10),
      },
      {
        input: await sharp({
          create: {
            width: Math.round(width * 0.46),
            height: Math.round(height * 0.36),
            channels: 4,
            background: { r: 30, g: 132, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: centerX - Math.round(width * 0.23),
        top: Math.round(height * 0.26),
      },
      {
        input: await sharp({
          create: {
            width: Math.round(width * 0.28),
            height: Math.round(height * 0.12),
            channels: 4,
            background: { r: 4, g: 30, b: 84, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: centerX - Math.round(width * 0.14),
        top: Math.round(height * 0.34),
      },
    ])
    .png()
    .toBuffer()
  return new Uint8Array(source)
}

async function readRgbPixel(buffer: Buffer, x: number, y: number): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const clampedX = Math.max(0, Math.min(info.width - 1, x))
  const clampedY = Math.max(0, Math.min(info.height - 1, y))
  const idx = (clampedY * info.width + clampedX) * info.channels
  return {
    r: data[idx] ?? 0,
    g: data[idx + 1] ?? 0,
    b: data[idx + 2] ?? 0,
  }
}

async function countRegionRgbDifference(params: {
  a: Buffer
  b: Buffer
  x0: number
  y0: number
  x1: number
  y1: number
  threshold?: number
}): Promise<number> {
  const { a, b } = params
  const threshold = params.threshold ?? 24
  const [aRaw, bRaw] = await Promise.all([
    sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ])
  const width = Math.min(aRaw.info.width, bRaw.info.width)
  const height = Math.min(aRaw.info.height, bRaw.info.height)
  const x0 = Math.max(0, Math.min(width - 1, params.x0))
  const y0 = Math.max(0, Math.min(height - 1, params.y0))
  const x1 = Math.max(x0 + 1, Math.min(width, params.x1))
  const y1 = Math.max(y0 + 1, Math.min(height, params.y1))
  let diffCount = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const base = (y * width + x) * aRaw.info.channels
      const dr = Math.abs((aRaw.data[base] ?? 0) - (bRaw.data[base] ?? 0))
      const dg = Math.abs((aRaw.data[base + 1] ?? 0) - (bRaw.data[base + 1] ?? 0))
      const db = Math.abs((aRaw.data[base + 2] ?? 0) - (bRaw.data[base + 2] ?? 0))
      if (dr + dg + db >= threshold) diffCount += 1
    }
  }
  return diffCount
}

describe('premium token icon renderer', () => {
  it('renders fallback symbol card when source is missing', async () => {
    const png = await renderPremiumTokenIcon({
      size: 512,
      symbol: 'AKITA',
    })
    const meta = await sharp(png).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  }, 12_000)

  it('renders premium icon for provided source image', async () => {
    const source = await createSource({ width: 900, height: 1200 })
    const png = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: source,
      symbol: 'AKITA',
    })
    const meta = await sharp(png).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  }, 12_000)

  it('is deterministic for the same source and size', async () => {
    const source = await createSource({ width: 512, height: 512 })
    const a = await renderPremiumTokenIcon({
      size: 480,
      sourceImage: source,
      symbol: 'AKITA',
    })
    const b = await renderPremiumTokenIcon({
      size: 480,
      sourceImage: source,
      symbol: 'AKITA',
    })
    expect(Buffer.compare(a, b)).toBe(0)
  })

  it('prefers prepared hero cutout breakout source when available', () => {
    const sourceKind = __testables.resolveBreakoutSourceKind({
      sourceAlphaBreakoutAllowed: false,
      preparedHeroCutoutAvailable: true,
      preparedHeroCutoutBreakoutAllowed: true,
    })
    expect(sourceKind).toBe('heroCutout')
  })

  it('falls back to source-alpha breakout when prepared hero cutout is absent', () => {
    const sourceKind = __testables.resolveBreakoutSourceKind({
      sourceAlphaBreakoutAllowed: true,
      preparedHeroCutoutAvailable: false,
      preparedHeroCutoutBreakoutAllowed: false,
    })
    expect(sourceKind).toBe('sourceAlpha')
  })

  it('suppresses breakout when neither prepared hero cutout nor source alpha is eligible', () => {
    const sourceKind = __testables.resolveBreakoutSourceKind({
      sourceAlphaBreakoutAllowed: false,
      preparedHeroCutoutAvailable: false,
      preparedHeroCutoutBreakoutAllowed: false,
    })
    expect(sourceKind).toBe('none')
  })

  it('keeps chamber rendering sourced from artwork when hero cutout is provided', async () => {
    const source = await createSource({ width: 900, height: 1200 })
    const heroCutout = await createPreparedHeroCutout({ width: 900, height: 1200 })
    const contained = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: source,
      symbol: 'AKITA',
    })
    const withPreparedCutout = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: source,
      heroCutoutSourceImage: heroCutout,
      symbol: 'AKITA',
    })

    const centerContained = await readRgbPixel(contained, 256, 286)
    const centerPrepared = await readRgbPixel(withPreparedCutout, 256, 286)
    const centerDelta = Math.abs(centerContained.r - centerPrepared.r)
      + Math.abs(centerContained.g - centerPrepared.g)
      + Math.abs(centerContained.b - centerPrepared.b)
    expect(centerDelta).toBeLessThan(30)
  })

  it('falls back to source-alpha breakout when hero cutout is absent', async () => {
    const transparentSource = await createTransparentSource({ width: 900, height: 1200 })
    const opaqueSource = new Uint8Array(
      await sharp(Buffer.from(transparentSource))
        .flatten({ background: { r: 22, g: 24, b: 30 } })
        .png()
        .toBuffer(),
    )

    const transparentRender = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: transparentSource,
      symbol: 'AKITA',
    })
    const opaqueRender = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: opaqueSource,
      symbol: 'AKITA',
    })

    const topDiff = await countRegionRgbDifference({
      a: opaqueRender,
      b: transparentRender,
      x0: 198,
      y0: 56,
      x1: 314,
      y1: 150,
      threshold: 28,
    })
    expect(topDiff).toBeGreaterThan(40)
  })

  it('gracefully ignores invalid hero cutout bytes and keeps contained rendering', async () => {
    const source = await createSource({ width: 900, height: 1200 })
    const contained = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: source,
      symbol: 'AKITA',
    })
    const invalidCutout = await renderPremiumTokenIcon({
      size: 512,
      sourceImage: source,
      heroCutoutSourceImage: new Uint8Array([1, 2, 3, 4, 5]),
      symbol: 'AKITA',
    })
    expect(Buffer.compare(contained, invalidCutout)).toBe(0)
  })

  it('suppresses source-alpha breakout when caller flags prepared hero cutout load failure', () => {
    expect(
      __testables.resolveSourceAlphaBreakoutAllowed({
        allowBreakout: true,
        suppressBreakout: true,
      }),
    ).toBe(false)
    expect(
      __testables.resolveSourceAlphaBreakoutAllowed({
        allowBreakout: true,
        suppressBreakout: false,
      }),
    ).toBe(true)
  })
})

