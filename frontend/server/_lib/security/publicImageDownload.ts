import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const DEFAULT_MAX_REDIRECTS = 3

export type PublicImageDownloadResult =
  | {
      ok: true
      bytes: Uint8Array
      contentType: string
      finalUrl: URL
    }
  | { ok: false; error: string; status?: number }

function parseIpv4(value: string): number[] | null {
  const parts = value.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN))
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? octets
    : null
}

function isForbiddenIpv4(value: string): boolean {
  const octets = parseIpv4(value)
  if (!octets) return false
  const [a, b] = octets
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  )
}

function isForbiddenIp(value: string): boolean {
  const version = isIP(value)
  if (version === 4) return isForbiddenIpv4(value)
  if (version !== 6) return false
  const normalized = value.toLowerCase()
  if (normalized.startsWith('::ffff:')) return isForbiddenIpv4(normalized.slice(7))
  return (
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
  )
}

function parsePublicHttpsUrl(raw: string, base?: URL): URL | null {
  try {
    const parsed = base ? new URL(raw, base) : new URL(raw)
    const hostname = parsed.hostname.trim().toLowerCase()
    if (parsed.protocol !== 'https:' || !hostname) return null
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || isForbiddenIp(hostname)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function resolvesOnlyToPublicAddresses(
  hostname: string,
  lookupImpl: typeof lookup,
): Promise<boolean> {
  if (isIP(hostname)) return !isForbiddenIp(hostname)
  try {
    const addresses = await lookupImpl(hostname, { all: true, verbatim: true })
    return addresses.length > 0 && addresses.every(({ address }) => !isForbiddenIp(address))
  } catch {
    return false
  }
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('media size limit exceeded')
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (total === 0) return new Uint8Array()
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function downloadPublicHttpsImage(params: {
  sourceUrl: string
  maxBytes: number
  timeoutMs: number
  maxRedirects?: number
  fetchImpl?: typeof fetch
  lookupImpl?: typeof lookup
  headers?: Record<string, string>
}): Promise<PublicImageDownloadResult> {
  let currentUrl = parsePublicHttpsUrl(params.sourceUrl)
  if (!currentUrl) return { ok: false, error: 'source_url_forbidden' }

  const fetchImpl = params.fetchImpl ?? fetch
  const lookupImpl = params.lookupImpl ?? lookup
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    for (let hop = 0; hop <= (params.maxRedirects ?? DEFAULT_MAX_REDIRECTS); hop += 1) {
      if (!(await resolvesOnlyToPublicAddresses(currentUrl.hostname, lookupImpl))) {
        return { ok: false, error: 'source_url_forbidden' }
      }
      const response = await fetchImpl(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: params.headers ?? { accept: 'image/*' },
      })
      if (response.status >= 300 && response.status < 400) {
        if (hop >= (params.maxRedirects ?? DEFAULT_MAX_REDIRECTS)) {
          return { ok: false, error: 'too_many_redirects' }
        }
        const nextUrl = parsePublicHttpsUrl(response.headers.get('location') ?? '', currentUrl)
        if (!nextUrl) return { ok: false, error: 'source_url_forbidden' }
        currentUrl = nextUrl
        continue
      }
      if (!response.ok) return { ok: false, error: 'source_fetch_failed', status: response.status }

      const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0]!.trim().toLowerCase()
      if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(contentType)) {
        return { ok: false, error: 'unsupported_media_type' }
      }
      const bytes = await readBodyWithLimit(response, params.maxBytes)
      if (bytes === null) return { ok: false, error: 'media_too_large' }
      if (bytes.byteLength === 0) return { ok: false, error: 'empty_media' }
      return {
        ok: true,
        bytes,
        contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType,
        finalUrl: currentUrl,
      }
    }
    return { ok: false, error: 'too_many_redirects' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: /abort/i.test(message) ? 'source_fetch_timeout' : 'source_fetch_error' }
  } finally {
    clearTimeout(timer)
  }
}
