import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { head, put } from '@vercel/blob'

declare const process: { env: Record<string, string | undefined> }

export type BlobHead = { url: string; size: number; contentType: string | null }

type FetchBytesOptions = {
  maxBytes?: number
  timeoutMs?: number
  maxRedirects?: number
  requireImageContentType?: boolean
  allowPrivateNetwork?: boolean
}

const DEFAULT_FETCH_TIMEOUT_MS = 8_000
const DEFAULT_FETCH_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_FETCH_MAX_REDIRECTS = 3

export function requireBlobToken() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN ?? '').trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  return token
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function parseIpv4(octets: string[]): number[] | null {
  if (octets.length !== 4) return null
  const out: number[] = []
  for (const part of octets) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (!Number.isFinite(value) || value < 0 || value > 255) return null
    out.push(value)
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

async function isHostnameResolutionSafe(hostname: string): Promise<boolean> {
  if (isForbiddenHostname(hostname)) return false
  if (isIP(hostname) !== 0) return true
  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true })
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

function parseFetchUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('fetch_invalid_url')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('fetch_invalid_protocol')
  }
  return parsed
}

function readRedirectUrl(currentUrl: URL, locationHeader: string | null): URL | null {
  const location = String(locationHeader ?? '').trim()
  if (!location) return null
  try {
    const next = new URL(location, currentUrl)
    if (next.protocol !== 'http:' && next.protocol !== 'https:') return null
    return next
  } catch {
    return null
  }
}

async function readResponseBytesWithLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  const stream = response.body
  if (!stream) {
    const ab = await response.arrayBuffer()
    if (ab.byteLength > maxBytes) throw new Error('fetch_too_large')
    return new Uint8Array(ab)
  }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) throw new Error('fetch_too_large')
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export async function blobHeadOrNull(pathname: string): Promise<BlobHead | null> {
  try {
    const r: any = await head(pathname)
    const url = typeof r?.url === 'string' ? r.url : ''
    if (!url) return null
    const size = typeof r?.size === 'number' ? r.size : 0
    const contentType = typeof r?.contentType === 'string' ? r.contentType : null
    return { url, size, contentType }
  } catch {
    return null
  }
}

export async function fetchBytes(
  url: string,
  options: FetchBytesOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const maxBytes =
    Number.isFinite(options.maxBytes) && (options.maxBytes ?? 0) > 0
      ? Math.floor(options.maxBytes ?? DEFAULT_FETCH_MAX_BYTES)
      : DEFAULT_FETCH_MAX_BYTES
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
      ? Math.floor(options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS)
      : DEFAULT_FETCH_TIMEOUT_MS
  const maxRedirects =
    Number.isFinite(options.maxRedirects) && (options.maxRedirects ?? 0) >= 0
      ? Math.floor(options.maxRedirects ?? DEFAULT_FETCH_MAX_REDIRECTS)
      : DEFAULT_FETCH_MAX_REDIRECTS
  const allowPrivateNetwork = options.allowPrivateNetwork === true
  const requireImage = options.requireImageContentType === true

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let currentUrl = parseFetchUrl(url)
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (!allowPrivateNetwork) {
        const safeHost = await isHostnameResolutionSafe(currentUrl.hostname)
        if (!safeHost) throw new Error('fetch_forbidden_host')
      }

      const response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
      })

      if (response.status >= 300 && response.status < 400) {
        if (hop >= maxRedirects) throw new Error('fetch_too_many_redirects')
        const redirected = readRedirectUrl(currentUrl, response.headers.get('location'))
        if (!redirected) throw new Error('fetch_invalid_redirect')
        currentUrl = redirected
        continue
      }

      if (!response.ok) throw new Error(`fetch_failed(${response.status})`)

      const ctRaw = response.headers.get('content-type')
      const contentType = ctRaw && ctRaw.trim().length > 0 ? ctRaw.trim() : null
      if (requireImage && !(contentType ?? '').toLowerCase().startsWith('image/')) {
        throw new Error('fetch_content_type_invalid')
      }

      const lenHeader = response.headers.get('content-length')
      const contentLength = Number(lenHeader)
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error('fetch_too_large')
      }

      const bytes = await readResponseBytesWithLimit(response, maxBytes)
      return { bytes, contentType }
    }

    throw new Error('fetch_too_many_redirects')
  } finally {
    clearTimeout(timeout)
  }
}

export async function blobPutBytes(params: {
  pathname: string
  bytes: Uint8Array
  contentType: string
  cacheControlMaxAgeSeconds?: number
}): Promise<{ url: string }> {
  const token = requireBlobToken()
  const body = Buffer.from(params.bytes)
  const r: any = await put(params.pathname, body, {
    access: 'public',
    contentType: params.contentType,
    token,
    ...(typeof params.cacheControlMaxAgeSeconds === 'number'
      ? { cacheControlMaxAge: params.cacheControlMaxAgeSeconds }
      : null),
  } as any)
  const url = typeof r?.url === 'string' ? r.url : ''
  if (!url) throw new Error('blob_put_failed')
  return { url }
}
