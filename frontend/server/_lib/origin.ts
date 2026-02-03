import type { VercelRequest } from '@vercel/node'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_LOCAL_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
])

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
  for (const part of raw.split(/[\s,]+/g)) {
    const n = normalizeOrigin(part)
    if (n) out.add(n)
  }
  return out
}

export function getCanonicalOrigin(req?: VercelRequest): string {
  const raw = (process.env.CANONICAL_ORIGIN ?? '').trim()
  const explicit = normalizeOrigin(raw)
  if (explicit) return explicit

  const vercelUrl = (process.env.VERCEL_URL ?? '').trim()
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, '')}`

  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const allow = new Set<string>([...DEFAULT_LOCAL_ORIGINS, ...getAllowedOriginsFromEnv()])

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

