import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import sharp from 'sharp'

const execFileP = promisify(execFile)

export type SegmentationModel =
  | 'bria-rmbg'
  | 'birefnet-general'
  | 'birefnet-portrait'
  | 'isnet-general-use'
  | 'isnet-anime'
  | 'u2net'
  | 'u2netp'
  | 'u2net_human_seg'
  | 'sam'

export type GenerateSegmentationMaskOptions = {
  model: SegmentationModel
  alphaMatting?: boolean
  maskOnly?: boolean
  timeoutMs?: number
  extraParamsJson?: string
  binCandidates?: string[]
}

export type SegmentationResult = {
  provider: 'rembg'
  model: SegmentationModel
  executable: string
  maskPngRgba: Buffer
  cutoutPng?: Buffer
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_REMBG_BIN_CANDIDATES = [
  process.env.REMBG_BIN,
  '/tmp/rembg-env/bin/rembg',
  '/usr/local/bin/rembg',
  '/usr/bin/rembg',
  'rembg',
]

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveBinCandidates(explicitCandidates?: string[]): string[] {
  const values = explicitCandidates ?? DEFAULT_REMBG_BIN_CANDIDATES
  const unique: string[] = []
  for (const value of values) {
    const candidate = toNonEmptyString(value)
    if (!candidate || unique.includes(candidate)) continue
    unique.push(candidate)
  }
  return unique
}

async function maskFromCutout(cutoutPng: Buffer): Promise<Buffer> {
  const alpha = await sharp(cutoutPng).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
  const px = alpha.info.width * alpha.info.height
  const rgba = Buffer.alloc(px * 4, 255)
  for (let i = 0; i < px; i += 1) {
    rgba[i * 4 + 3] = alpha.data[i] ?? 0
  }
  return sharp(rgba, { raw: { width: alpha.info.width, height: alpha.info.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function maskFromMaskOnlyOutput(maskOnlyPng: Buffer): Promise<Buffer> {
  const rawMask = await sharp(maskOnlyPng)
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })
  const px = rawMask.info.width * rawMask.info.height
  const rgba = Buffer.alloc(px * 4, 255)
  for (let i = 0; i < px; i += 1) {
    rgba[i * 4 + 3] = rawMask.data[i] ?? 0
  }
  return sharp(rgba, { raw: { width: rawMask.info.width, height: rawMask.info.height, channels: 4 } })
    .png()
    .toBuffer()
}

export async function generateSegmentationMask(
  pngBytes: Buffer,
  options: GenerateSegmentationMaskOptions,
): Promise<SegmentationResult | null> {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, Number(options.timeoutMs)) : DEFAULT_TIMEOUT_MS
  const candidates = resolveBinCandidates(options.binCandidates)
  if (candidates.length === 0) return null

  const id = randomUUID()
  const inPath = path.join(tmpdir(), `premium-seg-in-${id}.png`)
  const outPath = path.join(tmpdir(), `premium-seg-out-${id}.png`)
  const args: string[] = ['i', '-m', options.model]
  if (options.alphaMatting) args.push('-a')
  if (options.maskOnly) args.push('-om')
  const extraParamsJson = toNonEmptyString(options.extraParamsJson)
  if (extraParamsJson) args.push('-x', extraParamsJson)
  args.push(inPath, outPath)

  let lastError: unknown = null
  try {
    await fs.writeFile(inPath, pngBytes)
    for (const bin of candidates) {
      try {
        await execFileP(bin, args, { timeout: timeoutMs })
        const outputPng = await fs.readFile(outPath)
        if (options.maskOnly) {
          const maskPngRgba = await maskFromMaskOnlyOutput(outputPng)
          return {
            provider: 'rembg',
            model: options.model,
            executable: bin,
            maskPngRgba,
          }
        }
        const maskPngRgba = await maskFromCutout(outputPng)
        return {
          provider: 'rembg',
          model: options.model,
          executable: bin,
          maskPngRgba,
          cutoutPng: outputPng,
        }
      } catch (error) {
        lastError = error
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code ?? '')
            : ''
        if (code === 'ENOENT') continue
      }
    }
  } catch (error) {
    lastError = error
  } finally {
    await Promise.allSettled([
      fs.unlink(inPath),
      fs.unlink(outPath),
    ])
  }

  void lastError
  return null
}
