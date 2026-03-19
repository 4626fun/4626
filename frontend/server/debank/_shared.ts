import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors as setCorsAllowlist } from '../auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

export function setCors(req: VercelRequest, res: VercelResponse) {
  setCorsAllowlist(req, res)
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCors(req, res)
    res.status(200).end()
    return true
  }
  return false
}

export function setCache(res: VercelResponse, seconds: number = 300) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

export function requireDebankAccessKey(): string | null {
  const key = process.env.DEBANK_ACCESS_KEY
  if (!key) return null
  return key
}

export function getStringQuery(req: VercelRequest, key: string): string | null {
  const val = req.query?.[key]
  if (typeof val === 'string' && val.trim().length > 0) return val.trim()
  return null
}

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === 'string' && entry.trim().length > 0)?.trim() ?? ''
  }
  return typeof value === 'string' ? value.trim() : ''
}

function extractFirstIp(value: string): string {
  const first = value.split(',')[0]?.trim() ?? ''
  return first
}

/**
 * Resolve the client IP using trusted proxy headers first.
 *
 * Production uses provider-populated headers (`x-vercel-forwarded-for`, `x-real-ip`).
 * We intentionally avoid untrusted `x-forwarded-for` in production to prevent easy
 * rate-limit key spoofing. Local dev can still fall back to `x-forwarded-for`.
 */
export function getTrustedClientIp(req: VercelRequest): string {
  const fromVercel = extractFirstIp(firstHeaderValue(req.headers['x-vercel-forwarded-for']))
  if (fromVercel) return fromVercel

  const fromRealIp = extractFirstIp(firstHeaderValue(req.headers['x-real-ip']))
  if (fromRealIp) return fromRealIp

  const fromSocket = typeof (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress === 'string'
    ? String((req.socket as { remoteAddress?: string }).remoteAddress ?? '').trim()
    : ''
  if (fromSocket) return fromSocket

  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv !== 'production') {
    const fromForwarded = extractFirstIp(firstHeaderValue(req.headers['x-forwarded-for']))
    if (fromForwarded) return fromForwarded
  }

  return 'unknown'
}


