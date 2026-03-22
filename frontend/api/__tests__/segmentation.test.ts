import fs from 'node:fs/promises'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function createOpaqueSourcePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 4,
      background: { r: 28, g: 46, b: 66, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

async function readAlphaAt(buffer: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const clampedX = Math.max(0, Math.min(info.width - 1, x))
  const clampedY = Math.max(0, Math.min(info.height - 1, y))
  const idx = (clampedY * info.width + clampedX) * info.channels
  return data[idx + 3] ?? 0
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('segmentation helper', () => {
  it('returns null when no rembg candidate binary can run', async () => {
    const { generateSegmentationMask } = await import('../_handlers/token/_segmentation.js')
    const source = await createOpaqueSourcePng()
    const result = await generateSegmentationMask(source, {
      model: 'u2netp',
      timeoutMs: 500,
      binCandidates: ['/definitely-missing/rembg'],
    })
    expect(result).toBeNull()
  })

  it('derives an RGBA alpha mask from cutout output', async () => {
    const cutout = await sharp({
      create: {
        width: 36,
        height: 36,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 18,
              height: 16,
              channels: 4,
              background: { r: 220, g: 235, b: 255, alpha: 1 },
            },
          }).png().toBuffer(),
          left: 9,
          top: 9,
        },
      ])
      .png()
      .toBuffer()

    const execFileMock = vi.fn(
      (_bin: string, args: string[], _options: unknown, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        const outPath = args[args.length - 1]
        void fs.writeFile(outPath, cutout)
          .then(() => callback(null, '', ''))
          .catch((error) => callback(error as Error))
      },
    )
    vi.doMock('node:child_process', () => ({ execFile: execFileMock }))

    const { generateSegmentationMask } = await import('../_handlers/token/_segmentation.js')
    const source = await createOpaqueSourcePng()
    const result = await generateSegmentationMask(source, {
      model: 'isnet-general-use',
      binCandidates: ['mock-rembg'],
      timeoutMs: 2_000,
    })

    expect(result).not.toBeNull()
    expect(result?.provider).toBe('rembg')
    expect(result?.model).toBe('isnet-general-use')
    expect(result?.cutoutPng).toBeTruthy()

    const centerAlpha = await readAlphaAt(result!.maskPngRgba, 18, 18)
    const edgeAlpha = await readAlphaAt(result!.maskPngRgba, 2, 2)
    expect(centerAlpha).toBeGreaterThan(200)
    expect(edgeAlpha).toBeLessThan(20)
  })

  it('converts mask-only output into RGBA alpha mask', async () => {
    const maskOnly = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 14,
              height: 12,
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          }).png().toBuffer(),
          left: 9,
          top: 10,
        },
      ])
      .png()
      .toBuffer()

    const execFileMock = vi.fn(
      (_bin: string, args: string[], _options: unknown, callback: (error: Error | null, stdout?: string, stderr?: string) => void) => {
        const outPath = args[args.length - 1]
        void fs.writeFile(outPath, maskOnly)
          .then(() => callback(null, '', ''))
          .catch((error) => callback(error as Error))
      },
    )
    vi.doMock('node:child_process', () => ({ execFile: execFileMock }))

    const { generateSegmentationMask } = await import('../_handlers/token/_segmentation.js')
    const source = await createOpaqueSourcePng()
    const result = await generateSegmentationMask(source, {
      model: 'isnet-general-use',
      maskOnly: true,
      binCandidates: ['mock-rembg'],
      timeoutMs: 2_000,
    })

    expect(result).not.toBeNull()
    expect(result?.cutoutPng).toBeUndefined()
    const centerAlpha = await readAlphaAt(result!.maskPngRgba, 16, 16)
    const edgeAlpha = await readAlphaAt(result!.maskPngRgba, 1, 1)
    expect(centerAlpha).toBeGreaterThan(200)
    expect(edgeAlpha).toBeLessThan(20)
  })
})
