import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { renderPremiumTokenIcon } from '../../../api/_handlers/token/_premiumTokenIconRenderer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const HERMIT_SOURCE_PATH = resolve(__dirname, 'assets/hermit-source.png')

const DEFAULT_SIZE = 512
const MIN_SIZE = 64
const MAX_SIZE = 1024
const DEFAULT_SIGNATURE = 'hermit'
const MAX_SIGNATURE_LENGTH = 24

export type HermitAvatarOptions = {
  size?: number
  signatureText?: string
}

let sourceBytesPromise: Promise<Uint8Array> | null = null

async function loadSourceBytes(): Promise<Uint8Array> {
  if (!sourceBytesPromise) {
    sourceBytesPromise = readFile(HERMIT_SOURCE_PATH).then((buf) => new Uint8Array(buf))
    sourceBytesPromise.catch(() => {
      sourceBytesPromise = null
    })
  }
  return sourceBytesPromise
}

const renderCache = new Map<string, Buffer>()

function clampSize(size: number | undefined): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) return DEFAULT_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)))
}

function normalizeSignature(raw: string | undefined): string {
  const cleaned = String(raw ?? '').trim().slice(0, MAX_SIGNATURE_LENGTH)
  return cleaned.length > 0 ? cleaned : DEFAULT_SIGNATURE
}

export async function renderHermitAvatarBuffer(opts: HermitAvatarOptions = {}): Promise<Buffer> {
  const size = clampSize(opts.size)
  const signatureText = normalizeSignature(opts.signatureText)
  const cacheKey = `${size}:${signatureText}`
  const cached = renderCache.get(cacheKey)
  if (cached) return cached
  const sourceBytes = await loadSourceBytes()
  const png = await renderPremiumTokenIcon({
    size,
    sourceImage: sourceBytes,
    symbol: signatureText,
    signatureText,
    suppressBreakout: true,
  })
  renderCache.set(cacheKey, png)
  return png
}

export async function renderHermitAvatarDataUrl(opts: HermitAvatarOptions = {}): Promise<string> {
  const buf = await renderHermitAvatarBuffer(opts)
  return `data:image/png;base64,${buf.toString('base64')}`
}

export const HERMIT_AVATAR_SIZE_BOUNDS = { min: MIN_SIZE, max: MAX_SIZE, default: DEFAULT_SIZE } as const
export const HERMIT_AVATAR_DEFAULT_SIGNATURE = DEFAULT_SIGNATURE
