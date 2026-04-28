import type { VercelRequest } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_LOCAL_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://localhost:5174', // deploy dry-run dev server
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
])

function isLoopbackHostname(hostname: string): boolean {
  const value = String(hostname || '').trim().toLowerCase()
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]'
}

function normalizeOrigin(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    return u.origin
  } catch {
    return null
  }
}

function getAllowedOriginsFromEnv(): Set<string> {
  const raw = (process.env.CORS_ALLOWED_ORIGINS ?? '').trim()
  const out = new Set<string>()
  if (!raw) return out
  const parts = raw.split(/[\s,]+/g).filter(Boolean)
  // Explicit guard: CORS_ALLOWED_ORIGINS must never contain a bare wildcard.
  // A literal '*' would silently be dropped by normalizeOrigin (URL parser
  // rejects it), but we want an early, loud failure in production so a
  // misconfiguration surfaces before traffic hits protected endpoints.
  const hasWildcard = parts.some((p) => p === '*' || p === 'null')
  const isProd =
    (process.env.VERCEL_ENV ?? '').trim().toLowerCase() === 'production' ||
    (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production'
  if (hasWildcard && isProd) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS contains "*" or "null" in production; refuse to start.',
    )
  }
  for (const part of parts) {
    const n = normalizeOrigin(part)
    if (n) out.add(n)
  }
  return out
}

function getExplicitAppOrigin(): string | null {
  // Preferred explicit runtime origin for app/API security flows.
  return normalizeOrigin((process.env.APP_ORIGIN ?? '').trim())
}

function getExplicitErc8004PublicOrigin(): string | null {
  return (
    normalizeOrigin((process.env.ERC8004_PUBLIC_ORIGIN ?? '').trim()) ??
    normalizeOrigin((process.env.MARKETING_ORIGIN ?? '').trim()) ??
    normalizeOrigin((process.env.VITE_MARKETING_ORIGIN ?? '').trim()) ??
    normalizeOrigin('https://4626.fun')
  )
}

function getForwardedOrigin(req?: VercelRequest): string | null {
  if (!req) return null
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').toLowerCase()
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').trim()
  const safeProto = proto.startsWith('https') ? 'https' : 'http'
  if (!host) return null
  return normalizeOrigin(`${safeProto}://${host}`)
}

export function getCanonicalOrigin(req?: VercelRequest): string {
  const explicit = getExplicitAppOrigin()
  if (explicit) return explicit

  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const allow = new Set<string>([...DEFAULT_LOCAL_ORIGINS, ...getAllowedOriginsFromEnv()])

  const vercelUrl = (process.env.VERCEL_URL ?? '').trim()
  if (vercelUrl) {
    const candidate = normalizeOrigin(`https://${vercelUrl.replace(/\/+$/, '')}`)
    if (candidate) {
      const hostname = new URL(candidate).hostname
      // Local dev processes (including some sandbox/proxy flows) can inject
      // ephemeral localhost VERCEL_URL values (e.g. :64254). Do not pin
      // canonical origin to that random port; prefer explicit APP_ORIGIN or
      // trusted request-host allowlist resolution below.
      if (!(nodeEnv !== 'production' && isLoopbackHostname(hostname))) {
        return candidate
      }
    }
  }

  if (req && nodeEnv !== 'production') {
    const proto = String(req.headers['x-forwarded-proto'] ?? 'http').toLowerCase()
    const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').trim()
    const safeProto = proto.startsWith('https') ? 'https' : 'http'
    if (host) {
      const origin = `${safeProto}://${host}`
      if (allow.has(origin)) return origin
    }
  }

  throw new Error('missing_canonical_origin')
}

export function getCanonicalAppOrigin(req?: VercelRequest): string {
  return getCanonicalOrigin(req)
}

export function getErc8004PublicOrigin(_req?: VercelRequest): string {
  const explicit = getExplicitErc8004PublicOrigin()
  if ((process.env.ERC8004_PUBLIC_ORIGIN ?? '').trim()) return explicit as string
  if ((process.env.MARKETING_ORIGIN ?? '').trim()) return explicit as string
  if ((process.env.VITE_MARKETING_ORIGIN ?? '').trim()) return explicit as string

  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const forwardedOrigin = getForwardedOrigin(_req)
  if (nodeEnv !== 'production' && forwardedOrigin && DEFAULT_LOCAL_ORIGINS.has(forwardedOrigin)) {
    return forwardedOrigin
  }

  if (explicit) return explicit
  throw new Error('missing_erc8004_public_origin')
}

