/**
 * Pinata file pinning for Hermit meme durability.
 *
 * Creative-lane local helper — fetches a remote image/GIF and pins it via
 * Pinata `pinFileToIPFS`, then brands the public URL as `4626.fun/ipfs/<cid>`.
 */

import { resolveHermitGatewayUrl } from './policy.js'

declare const process: { env: Record<string, string | undefined> }

const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const DEFAULT_MAX_BYTES = 12 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000

export type PinataPinResult =
  | { ok: true; cid: string; url: string; filename: string; bytes: number }
  | { ok: false; error: string }

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function readPinataJwt(): string | null {
  const jwt = asTrimmed(process.env.PINATA_JWT)
  return jwt || null
}

function defaultPublicGatewayUrl(cid: string, filename: string): string {
  const branded = resolveHermitGatewayUrl(cid)
  if (branded) {
    const sep = branded.includes('?') ? '&' : '?'
    return `${branded}${sep}filename=${encodeURIComponent(filename)}`
  }
  return `https://4626.fun/ipfs/${cid}?filename=${encodeURIComponent(filename)}`
}

function guessFilename(sourceUrl: string, contentType: string | null): string {
  try {
    const parsed = new URL(sourceUrl)
    const fromQuery = asTrimmed(parsed.searchParams.get('filename'))
    if (fromQuery && /\.(gif|jpe?g|png|webp)$/i.test(fromQuery)) return fromQuery
    const baseName = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
    if (baseName && /\.(gif|jpe?g|png|webp)$/i.test(baseName)) return baseName
  } catch {
    // ignore
  }
  const mime = (contentType ?? '').toLowerCase()
  if (mime.includes('gif')) return 'hermit-meme.gif'
  if (mime.includes('png')) return 'hermit-meme.png'
  if (mime.includes('webp')) return 'hermit-meme.webp'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'hermit-meme.jpg'
  return 'hermit-meme.bin'
}

function isAllowedMediaContentType(contentType: string | null, filename: string): boolean {
  const mime = (contentType ?? '').toLowerCase()
  if (
    mime.includes('image/gif')
    || mime.includes('image/jpeg')
    || mime.includes('image/jpg')
    || mime.includes('image/png')
    || mime.includes('image/webp')
  ) {
    return true
  }
  return /\.(gif|jpe?g|png|webp)$/i.test(filename)
}

export async function pinRemoteMediaToPinata(params: {
  sourceUrl: string
  filenameHint?: string | null
  maxBytes?: number
  fetchImpl?: typeof fetch
}): Promise<PinataPinResult> {
  const sourceUrl = asTrimmed(params.sourceUrl)
  if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) {
    return { ok: false, error: 'source_url_must_be_https' }
  }

  const jwt = readPinataJwt()
  if (!jwt) return { ok: false, error: 'pinata_jwt_missing' }

  const fetchImpl = params.fetchImpl ?? fetch
  const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const upstream = await fetchImpl(sourceUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'image/*,*/*;q=0.8' },
    })
    if (!upstream.ok) {
      return { ok: false, error: `source_fetch_failed:${upstream.status}` }
    }

    const contentType = upstream.headers.get('content-type')
    const filename =
      asTrimmed(params.filenameHint)
      || guessFilename(sourceUrl, contentType)

    if (!isAllowedMediaContentType(contentType, filename)) {
      return { ok: false, error: 'unsupported_media_type' }
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    if (buffer.byteLength <= 0) return { ok: false, error: 'empty_media' }
    if (buffer.byteLength > maxBytes) {
      return { ok: false, error: `media_too_large:${buffer.byteLength}` }
    }

    const form = new FormData()
    const blob = new Blob([buffer], {
      type: contentType && contentType.startsWith('image/')
        ? contentType.split(';')[0]!.trim()
        : 'application/octet-stream',
    })
    form.append('file', blob, filename)
    form.append(
      'pinataMetadata',
      JSON.stringify({
        name: filename,
        keyvalues: { source: 'hermit-keep', app: '4626' },
      }),
    )
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

    const pinRes = await fetchImpl(PINATA_PIN_FILE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      signal: controller.signal,
    })

    const pinText = await pinRes.text()
    if (!pinRes.ok) {
      return {
        ok: false,
        error: `pinata_pin_failed:${pinRes.status}:${pinText.slice(0, 160)}`,
      }
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(pinText) as Record<string, unknown>
    } catch {
      return { ok: false, error: 'pinata_pin_invalid_json' }
    }

    const cid = asTrimmed(parsed.IpfsHash) || asTrimmed(parsed.ipfsHash)
    if (!cid) return { ok: false, error: 'pinata_pin_missing_cid' }

    return {
      ok: true,
      cid,
      url: defaultPublicGatewayUrl(cid, filename),
      filename,
      bytes: buffer.byteLength,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/abort/i.test(message)) return { ok: false, error: 'pinata_pin_timeout' }
    return { ok: false, error: `pinata_pin_error:${message.slice(0, 160)}` }
  } finally {
    clearTimeout(timer)
  }
}
