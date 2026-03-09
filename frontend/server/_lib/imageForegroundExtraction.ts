import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import sharp from 'sharp'

const execFileAsync = promisify(execFile)

const FOREGROUND_EXTRACTION_CONFIG = {
  minForegroundCoverage: 0.03,
  rembgTimeoutMs: 30_000,
  rembgBin: process.env.REMBG_BIN || '/tmp/rembg-env/bin/rembg',
} as const

async function normalizeImageToPng(imageBytes: Uint8Array): Promise<Uint8Array> {
  const normalized = await sharp(Buffer.from(imageBytes))
    .rotate()
    .png()
    .toBuffer()

  return new Uint8Array(normalized)
}

async function refineForegroundCutout(foregroundBytes: Uint8Array): Promise<Uint8Array> {
  // Sharpen the alpha mask: threshold + slight blur to clean up jagged edges
  const alphaMask = await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .extractChannel('alpha')
    .threshold(24)
    .blur(1)
    .png()
    .toBuffer()

  // Apply the refined mask via dest-in blend (same pattern used by buildFrameOverlayLayer).
  // joinChannel does not reliably write the 4th channel as alpha in all sharp versions;
  // dest-in composite is the correct approach for masking.
  const refined = await sharp(Buffer.from(foregroundBytes))
    .ensureAlpha()
    .composite([{ input: alphaMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  return new Uint8Array(refined)
}

async function extractForeground(pngBytes: Uint8Array): Promise<Uint8Array | null> {
  const id = randomUUID()
  const inputPath = join(tmpdir(), `rembg-in-${id}.png`)
  const outputPath = join(tmpdir(), `rembg-out-${id}.png`)

  try {
    await writeFile(inputPath, Buffer.from(pngBytes))
    await execFileAsync(FOREGROUND_EXTRACTION_CONFIG.rembgBin, ['i', inputPath, outputPath], {
      timeout: FOREGROUND_EXTRACTION_CONFIG.rembgTimeoutMs,
    })
    const extracted = await readFile(outputPath)
    return new Uint8Array(extracted)
  } catch (error) {
    console.warn('[imagegen/foreground] rembg extraction failed (breakout disabled):', error instanceof Error ? error.message : String(error))
    return null
  } finally {
    await Promise.all([unlink(inputPath).catch(() => {}), unlink(outputPath).catch(() => {})])
  }
}

async function isForegroundUsable(foregroundBytes: Uint8Array): Promise<boolean> {
  const stats = await sharp(Buffer.from(foregroundBytes)).stats()
  const alphaMean = stats.channels[3]?.mean ?? 0
  return alphaMean > FOREGROUND_EXTRACTION_CONFIG.minForegroundCoverage * 255
}

async function extractForegroundFromImageBytes(imageBytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const normalizedImageBytes = await normalizeImageToPng(imageBytes)
    const extractedForegroundBytes = await extractForeground(normalizedImageBytes)
    if (!extractedForegroundBytes) {
      return null
    }

    if (!(await isForegroundUsable(extractedForegroundBytes))) {
      return null
    }

    return await refineForegroundCutout(extractedForegroundBytes)
  } catch (error) {
    console.warn('[imagegen/foreground] foreground preparation failed (breakout disabled):', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function extractForegroundFromSubjectImageBytes(subjectImageBytes: Uint8Array): Promise<Uint8Array | null> {
  return await extractForegroundFromImageBytes(subjectImageBytes)
}

export async function extractForegroundFromArtwork(artworkBytes: Uint8Array): Promise<Uint8Array | null> {
  return await extractForegroundFromImageBytes(artworkBytes)
}
