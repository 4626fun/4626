/**
 * Pinata file pinning for Hermit meme durability.
 *
 * Creative-lane local helper — fetches a remote image/GIF and pins it via
 * Pinata `pinFileToIPFS`, then brands the public URL as `4626.fun/ipfs/<cid>`.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { resolveHermitGatewayUrl } from './policy.js'

declare const process: { env: Record<string, string | undefined> }

const PINATA_PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const DEFAULT_MAX_BYTES = 12 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 3

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

function isAllowedMediaContentType(contentType: string | null): boolean {
  const mime = (contentType ?? '').toLowerCase().split(';')[0]?.trim() ?? ''
  if (!mime.startsWith('image/')) return false
  return (
    mime === 'image/gif'
    || mime === 'image/jpeg'
    || mime === 'image/jpg'
    || mime === 'image/png'
    || mime === 'image/webp'
  )
}

function parseIpv4(octets: string[]): number[] | null {
  if (octets.length !== 4) return null
  const out: number[] = []
  for (const part of octets) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (!Number.isFinite(n) || n < 0 || n > 255) return null
    out.push(n)
  }
  return out
}

function isPrivateIpv4(host: string): boolean {
  const octets = parseIpv4(host.split('.'))
  if (!octets) return false
  const [a, b] = octets
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(host: string): boolean {
  const value = host.toLowerCase()
  if (value.startsWith('::ffff:')) {
    return isPrivateIpv4(value.slice('::ffff:'.length))
  }
  if (value === '::1') return true
  if (value === '::') return true
  if (value.startsWith('fc') || value.startsWith('fd')) return true
  if (value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')) return true
  return false
}

function isForbiddenIpAddress(address: string): boolean {
  const ipVersion = isIP(address)
  if (ipVersion === 4) return isPrivateIpv4(address)
  if (ipVersion === 6) return isPrivateIpv6(address)
  return false
}

function isForbiddenHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '0.0.0.0') return true
  if (isForbiddenIpAddress(host)) return true
  return false
}

function parseSafeHttpsUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return null
    if (isForbiddenHostname(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

async function isHostnameResolutionSafeWithLookup(
  hostname: string,
  lookupImpl: typeof lookup,
): Promise<boolean> {
  if (isForbiddenHostname(hostname)) return false
  if (isIP(hostname) !== 0) return true
  try {
    const resolved = await lookupImpl(hostname, { all: true, verbatim: true })
    if (!Array.isArray(resolved) || resolved.length === 0) return false
    for (const row of resolved) {
      const address = String(row?.address ?? '').trim()
      if (!address || isForbiddenIpAddress(address)) return false
    }
    return true
  } catch {
    return false
  }
}

function readRedirectUrl(currentUrl: URL, locationHeader: string | null): URL | null {
  const location = String(locationHeader ?? '').trim()
  if (!location) return null
  try {
    const nextUrl = new URL(location, currentUrl)
    if (nextUrl.protocol !== 'https:') return null
    if (isForbiddenHostname(nextUrl.hostname)) return null
    return nextUrl
  } catch {
    return null
  }
}

async function fetchRemoteMedia(
  startUrl: URL,
  fetchImpl: typeof fetch,
  lookupImpl: typeof lookup,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: URL } | null> {
  let currentUrl = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const safeHost = await isHostnameResolutionSafeWithLookup(currentUrl.hostname, lookupImpl)
    if (!safeHost) return null

    const response = await fetchImpl(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: { Accept: 'image/*' },
    })

    if (response.status >= 300 && response.status < 400) {
      if (hop >= MAX_REDIRECTS) return null
      const redirectedUrl = readRedirectUrl(currentUrl, response.headers.get('location'))
      if (!redirectedUrl) return null
      currentUrl = redirectedUrl
      continue
    }

    return { response, finalUrl: currentUrl }
  }

  return null
}

export async function pinRemoteMediaToPinata(params: {
  sourceUrl: string
  filenameHint?: string | null
  maxBytes?: number
  fetchImpl?: typeof fetch
  lookupImpl?: typeof lookup
}): Promise<PinataPinResult> {
  const sourceUrl = asTrimmed(params.sourceUrl)
  if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) {
    return { ok: false, error: 'source_url_must_be_https' }
  }
  const parsedSourceUrl = parseSafeHttpsUrl(sourceUrl)
  if (!parsedSourceUrl) {
    return { ok: false, error: 'source_url_forbidden' }
  }

  const jwt = readPinataJwt()
  if (!jwt) return { ok: false, error: 'pinata_jwt_missing' }

  const fetchImpl = params.fetchImpl ?? fetch
  const lookupImpl = params.lookupImpl ?? lookup
  const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const remoteMedia = await fetchRemoteMedia(parsedSourceUrl, fetchImpl, lookupImpl, controller.signal)
    if (!remoteMedia) {
      return { ok: false, error: 'source_url_forbidden' }
    }

    const { response: upstream, finalUrl } = remoteMedia
    if (!upstream.ok) {
      return { ok: false, error: `source_fetch_failed:${upstream.status}` }
    }

    const contentType = upstream.headers.get('content-type')
    if (!String(contentType ?? '').toLowerCase().startsWith('image/')) {
      return { ok: false, error: 'unsupported_media_type' }
    }
    const filename =
      asTrimmed(params.filenameHint)
      || guessFilename(finalUrl.toString(), contentType)

    if (!isAllowedMediaContentType(contentType)) {
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
