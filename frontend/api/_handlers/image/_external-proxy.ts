import type { VercelRequest, VercelResponse } from '@vercel/node'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { handleOptions, setCors } from '../../../packages/server-core/src/index.js'

const FETCH_TIMEOUT_MS = 8_000
const MAX_IMAGE_BYTES = 2_000_000
const MAX_REDIRECTS = 3
const CACHE_CONTROL_VALUE = 'public, max-age=3600, stale-while-revalidate=86400'

function firstQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
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

function parseExternalImageUrl(raw: string): URL | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (isForbiddenHostname(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
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

function readRedirectUrl(currentUrl: URL, locationHeader: string | null): URL | null {
  const location = String(locationHeader ?? '').trim()
  if (!location) return null
  try {
    const nextUrl = new URL(location, currentUrl)
    if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') return null
    if (isForbiddenHostname(nextUrl.hostname)) return null
    return nextUrl
  } catch {
    return null
  }
}

async function fetchUpstreamImage(startUrl: URL, signal: AbortSignal): Promise<Response | null> {
  let currentUrl = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const safeHost = await isHostnameResolutionSafe(currentUrl.hostname)
    if (!safeHost) return null

    const response = await fetch(currentUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'image/*' },
      signal,
      redirect: 'manual',
    })

    if (response.status >= 300 && response.status < 400) {
      if (hop >= MAX_REDIRECTS) return null
      const redirectedUrl = readRedirectUrl(currentUrl, response.headers.get('location'))
      if (!redirectedUrl) return null
      currentUrl = redirectedUrl
      continue
    }

    return response
  }

  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const rawUrl = firstQueryString(req.query.url as string | string[] | undefined)
  const externalUrl = parseExternalImageUrl(rawUrl)
  if (!externalUrl) {
    return res.status(400).json({ success: false, error: 'Invalid image URL' })
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)

  try {
    const upstream = await fetchUpstreamImage(externalUrl, ctrl.signal)
    if (!upstream) {
      return res.status(400).json({ success: false, error: 'Invalid image URL' })
    }

    if (!upstream.ok) {
      return res.status(502).json({ success: false, error: 'Failed to fetch image' })
    }

    const contentType = String(upstream.headers.get('content-type') || '').trim().toLowerCase()
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ success: false, error: 'Upstream did not return an image' })
    }

    const lenHeader = upstream.headers.get('content-length')
    const contentLength = Number(lenHeader)
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ success: false, error: 'Image too large' })
    }

    const bytes = Buffer.from(await upstream.arrayBuffer())
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return res.status(413).json({ success: false, error: 'Image too large' })
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', CACHE_CONTROL_VALUE)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).send(bytes)
  } catch {
    return res.status(504).json({ success: false, error: 'Image fetch timed out' })
  } finally {
    clearTimeout(timeout)
  }
}
