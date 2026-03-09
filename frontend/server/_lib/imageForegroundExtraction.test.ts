import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  execFileMock,
  writeFileMock,
  readFileMock,
  unlinkMock,
  randomUUIDMock,
} = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  readFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  randomUUIDMock: vi.fn(() => 'foreground-test-id'),
}))

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

vi.mock('node:fs/promises', () => ({
  writeFile: writeFileMock,
  readFile: readFileMock,
  unlink: unlinkMock,
}))

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto')
  return {
    ...actual,
    randomUUID: randomUUIDMock,
  }
})

async function createJpegFromSvg(svg: string): Promise<Uint8Array> {
  return await sharp(Buffer.from(svg)).jpeg().toBuffer()
}

async function createPngFromSvg(svg: string): Promise<Uint8Array> {
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

async function createPngFromRawRgba(width: number, height: number, rgba: Uint8Array): Promise<Uint8Array> {
  return await sharp(Buffer.from(rgba), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()
}

async function independentlyRefineForegroundCutout(foregroundBytes: Uint8Array): Promise<Uint8Array> {
  const alphaMask = await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(24)
    .blur(1)
    .png()
    .toBuffer()

  const rgbForeground = await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .removeAlpha()
    .png()
    .toBuffer()

  return await sharp(Buffer.from(rgbForeground))
    .joinChannel(alphaMask)
    .png()
    .toBuffer()
}

describe('image foreground extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unlinkMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
  })

  it('normalizes artwork to png, runs rembg with the production timeout, and returns a refined cutout when extraction succeeds', async () => {
    const artworkBytes = await createJpegFromSvg(`
      <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="#111827"/>
        <circle cx="40" cy="40" r="22" fill="#f8fafc"/>
      </svg>
    `)
    const extractedBytes = await createPngFromSvg(`
      <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="transparent"/>
        <circle cx="40" cy="40" r="22" fill="#ffffff"/>
        <circle cx="10" cy="10" r="3" fill="rgba(255,255,255,0.08)"/>
      </svg>
    `)
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''))
    readFileMock.mockResolvedValue(Buffer.from(extractedBytes))

    const { extractForegroundFromArtwork } = await import('./imageForegroundExtraction.ts')
    const result = await extractForegroundFromArtwork(artworkBytes)

    expect(result).not.toBeNull()
    expect(execFileMock).toHaveBeenCalledWith(
      '/tmp/rembg-env/bin/rembg',
      ['i', expect.stringContaining('rembg-in-foreground-test-id.png'), expect.stringContaining('rembg-out-foreground-test-id.png')],
      expect.objectContaining({ timeout: 30_000 }),
      expect.any(Function),
    )

    const normalizedInput = writeFileMock.mock.calls[0]?.[1]
    const normalizedMetadata = await sharp(Buffer.from(normalizedInput)).metadata()
    const resultMetadata = await sharp(Buffer.from(result ?? new Uint8Array())).metadata()

    expect(normalizedMetadata.format).toBe('png')
    expect(resultMetadata.format).toBe('png')
    expect(resultMetadata.width).toBe(80)
    expect(resultMetadata.height).toBe(80)
    expect(unlinkMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when rembg extraction fails', async () => {
    const artworkBytes = await createPngFromSvg(`
      <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="#111827"/>
      </svg>
    `)
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(new Error('rembg failed')))

    const { extractForegroundFromArtwork } = await import('./imageForegroundExtraction.ts')

    await expect(extractForegroundFromArtwork(artworkBytes)).resolves.toBeNull()
    expect(readFileMock).not.toHaveBeenCalled()
    expect(unlinkMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when the extracted foreground is too weak to use', async () => {
    const artworkBytes = await createPngFromSvg(`
      <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="#111827"/>
      </svg>
    `)
    const weakForegroundBytes = await createPngFromSvg(`
      <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="transparent"/>
        <circle cx="40" cy="40" r="4" fill="#ffffff"/>
      </svg>
    `)
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''))
    readFileMock.mockResolvedValue(Buffer.from(weakForegroundBytes))

    const { extractForegroundFromArtwork } = await import('./imageForegroundExtraction.ts')

    await expect(extractForegroundFromArtwork(artworkBytes)).resolves.toBeNull()
  })

  it('accepts uploaded subject image bytes directly and returns the refined rembg cutout for literal composite mode', async () => {
    const subjectImageBytes = await createJpegFromSvg(`
      <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
        <rect width="96" height="96" fill="#0f172a"/>
        <ellipse cx="48" cy="52" rx="28" ry="24" fill="#f8fafc"/>
      </svg>
    `)
    const rawExtractedPixels = new Uint8Array(96 * 96 * 4)
    for (let y = 24; y < 72; y += 1) {
      for (let x = 24; x < 72; x += 1) {
        const offset = (y * 96 + x) * 4
        rawExtractedPixels[offset] = 255
        rawExtractedPixels[offset + 1] = 255
        rawExtractedPixels[offset + 2] = 255
        rawExtractedPixels[offset + 3] = 255
      }
    }
    const lowAlphaPixelOffset = (12 * 96 + 12) * 4
    rawExtractedPixels[lowAlphaPixelOffset] = 255
    rawExtractedPixels[lowAlphaPixelOffset + 1] = 255
    rawExtractedPixels[lowAlphaPixelOffset + 2] = 255
    rawExtractedPixels[lowAlphaPixelOffset + 3] = 12
    const rawExtractedBytes = await createPngFromRawRgba(96, 96, rawExtractedPixels)
    const expectedRefinedBytes = await independentlyRefineForegroundCutout(rawExtractedBytes)
    expect(Buffer.from(expectedRefinedBytes).equals(Buffer.from(rawExtractedBytes))).toBe(false)
    execFileMock.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''))
    readFileMock.mockResolvedValue(Buffer.from(rawExtractedBytes))

    const { extractForegroundFromSubjectImageBytes } = await import('./imageForegroundExtraction.ts')
    const result = await extractForegroundFromSubjectImageBytes(subjectImageBytes)

    expect(result).not.toBeNull()
    expect(Buffer.from(result ?? new Uint8Array()).equals(Buffer.from(rawExtractedBytes))).toBe(false)
    expect(Buffer.from(result ?? new Uint8Array()).equals(Buffer.from(expectedRefinedBytes))).toBe(true)
    expect(execFileMock).toHaveBeenCalledWith(
      '/tmp/rembg-env/bin/rembg',
      ['i', expect.stringContaining('rembg-in-foreground-test-id.png'), expect.stringContaining('rembg-out-foreground-test-id.png')],
      expect.objectContaining({ timeout: 30_000 }),
      expect.any(Function),
    )

    const normalizedInput = writeFileMock.mock.calls[0]?.[1]
    const normalizedMetadata = await sharp(Buffer.from(normalizedInput)).metadata()

    expect(normalizedMetadata.format).toBe('png')
    expect(unlinkMock).toHaveBeenCalledTimes(2)
  })
})
