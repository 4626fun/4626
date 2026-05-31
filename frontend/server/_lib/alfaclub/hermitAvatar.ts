import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { renderPremiumTokenIcon } from '../token/renderPremiumTokenIcon.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const HERMIT_SOURCE_PATH = resolve(__dirname, 'assets/hermit-source.png')
const HERMIT_CUTOUT_PATH = resolve(__dirname, 'assets/hermit-cutout.png')

const DEFAULT_SIZE = 512
const MIN_SIZE = 64
const MAX_SIZE = 1024
const DEFAULT_SIGNATURE = 'Agent Hermit 4626'
const MAX_SIGNATURE_LENGTH = 24

// renderBackgroundCard uses cardRadius = round(size * 0.16); we mirror it so
// the rounded-corner mask we apply lines up exactly with the rendered card.
const CARD_RADIUS_RATIO = 0.16

export type HermitAvatarOptions = {
  size?: number
  signatureText?: string
}

let sourceBytesPromise: Promise<Uint8Array> | null = null
let cutoutBytesPromise: Promise<Uint8Array | null> | null = null

async function loadSourceBytes(): Promise<Uint8Array> {
  if (!sourceBytesPromise) {
    sourceBytesPromise = readFile(HERMIT_SOURCE_PATH).then((buf) => new Uint8Array(buf))
    sourceBytesPromise.catch(() => {
      sourceBytesPromise = null
    })
  }
  return sourceBytesPromise
}

async function loadCutoutBytes(): Promise<Uint8Array | null> {
  if (!cutoutBytesPromise) {
    cutoutBytesPromise = readFile(HERMIT_CUTOUT_PATH)
      .then((buf) => new Uint8Array(buf) as Uint8Array | null)
      .catch((err) => {
        console.warn('[alfa/hermit-avatar] cutout load failed; breakout disabled this render:', err)
        return null
      })
  }
  return cutoutBytesPromise
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

async function makeRoundedAlphaMask(size: number, radius: number): Promise<Buffer> {
  const r = Math.max(0, Math.min(Math.floor(size / 2), Math.round(radius)))
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#ffffff" />
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function applyTransparentCorners(opaquePng: Buffer, size: number): Promise<Buffer> {
  const radius = Math.round(size * CARD_RADIUS_RATIO)
  const mask = await makeRoundedAlphaMask(size, radius)
  return sharp(opaquePng)
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

export async function renderHermitAvatarBuffer(opts: HermitAvatarOptions = {}): Promise<Buffer> {
  const size = clampSize(opts.size)
  const signatureText = normalizeSignature(opts.signatureText)
  const cacheKey = `${size}:${signatureText}`
  const cached = renderCache.get(cacheKey)
  if (cached) return cached
  const [sourceBytes, cutoutBytes] = await Promise.all([loadSourceBytes(), loadCutoutBytes()])
  // Pass the opaque source for chamber composition AND the hand-curated alpha
  // cutout as the heroCutout source. The opt-in flag bypasses the pixelArt-only
  // gate in renderBreakoutLayer so the hat pokes above the bezel for the 3D
  // effect this avatar is built around. Existing token icon callers don't pass
  // this flag and stay on the conservative path.
  const opaque = await renderPremiumTokenIcon({
    size,
    sourceImage: sourceBytes,
    heroCutoutSourceImage: cutoutBytes ?? undefined,
    allowHeroCutoutBreakoutForNonPixelArt: true,
    symbol: signatureText,
    signatureText,
  })
  // Mask the rounded-card corners so the avatar blends onto chart backgrounds
  // instead of carrying a square black backdrop.
  const transparent = await applyTransparentCorners(opaque, size)
  renderCache.set(cacheKey, transparent)
  return transparent
}

export async function renderHermitAvatarDataUrl(opts: HermitAvatarOptions = {}): Promise<string> {
  const buf = await renderHermitAvatarBuffer(opts)
  return `data:image/png;base64,${buf.toString('base64')}`
}

export const HERMIT_AVATAR_SIZE_BOUNDS = { min: MIN_SIZE, max: MAX_SIZE, default: DEFAULT_SIZE } as const
export const HERMIT_AVATAR_DEFAULT_SIGNATURE = DEFAULT_SIGNATURE
