import type { VercelRequest } from '@vercel/node'

import { getCanonicalOrigin } from './origin.js'

declare const process: { env: Record<string, string | undefined> }

const LOCAL_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
])

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = normalizeLower(value)
  if (!isAddressLike(raw)) return null
  return raw as `0x${string}`
}

export function normalizeEmail(value: unknown): string | null {
  const raw = normalizeLower(value)
  if (!raw) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null
  return raw
}

function isTruthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const lc = value.trim().toLowerCase()
    return lc === '1' || lc === 'true' || lc === 'yes'
  }
  return false
}

function accountHasVerifiedFlag(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const account = value as Record<string, unknown>
  if (isTruthy(account.verified)) return true
  if (isTruthy(account.isVerified)) return true
  if (isTruthy(account.is_verified)) return true
  const verifiedAt = typeof account.verifiedAt === 'string' ? account.verifiedAt.trim() : ''
  const verifiedAtSnake = typeof account.verified_at === 'string' ? account.verified_at.trim() : ''
  return verifiedAt.length > 0 || verifiedAtSnake.length > 0
}

function candidateEmailFromAccount(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const account = value as Record<string, unknown>
  return (
    normalizeEmail(account.address) ??
    normalizeEmail(account.emailAddress) ??
    normalizeEmail(account.email_address) ??
    normalizeEmail(account.email)
  )
}

export function extractPrivyVerifiedEmail(user: unknown): string | null {
  const u = (user ?? {}) as Record<string, unknown>
  const directEmail = (u.email ?? null) as Record<string, unknown> | null
  if (directEmail && accountHasVerifiedFlag(directEmail)) {
    const direct = candidateEmailFromAccount(directEmail)
    if (direct) return direct
  }

  const linked = [
    ...(Array.isArray(u.linkedAccounts) ? (u.linkedAccounts as unknown[]) : []),
    ...(Array.isArray(u.linked_accounts) ? (u.linked_accounts as unknown[]) : []),
  ]
  for (const account of linked) {
    const record = (account ?? {}) as Record<string, unknown>
    const type = normalizeLower(record.type)
    if (!type.includes('email')) continue
    if (!accountHasVerifiedFlag(record)) continue
    const candidate = candidateEmailFromAccount(record)
    if (candidate) return candidate
  }

  return null
}

export function normalizeOrigin(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

function getOriginsFromEnvVar(name: string): string[] {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return []
  return raw
    .split(/[\s,]+/g)
    .map((part) => normalizeOrigin(part))
    .filter((origin): origin is string => Boolean(origin))
}

export function getTrustedRequestOrigins(req?: VercelRequest): Set<string> {
  const out = new Set<string>()

  const canonical = normalizeOrigin(String(process.env.APP_ORIGIN ?? '').trim())
  if (canonical) out.add(canonical)

  for (const origin of getOriginsFromEnvVar('CORS_ALLOWED_ORIGINS')) {
    out.add(origin)
  }

  try {
    const derived = normalizeOrigin(getCanonicalOrigin(req))
    if (derived) out.add(derived)
  } catch {
    // Canonical origin may not be configured in all environments.
  }

  const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (nodeEnv !== 'production') {
    for (const origin of LOCAL_ORIGINS) out.add(origin)
  }

  return out
}

export function isTrustedRequestOrigin(req: VercelRequest | undefined, origin: string): boolean {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return false
  return getTrustedRequestOrigins(req).has(normalized)
}

export function readServerAdminAddressSet(): Set<string> {
  const raw = String(process.env.CREATOR_ACCESS_ADMIN_ADDRESSES ?? '')
  const g = globalThis as Record<string, unknown>
  const cache = g.__4626_server_admin_cache as { key: string; set: Set<string> } | undefined
  if (cache && cache.key === raw) return cache.set

  const set = new Set<string>()
  for (const part of raw.split(/[\s,]+/g)) {
    const normalized = normalizeAddress(part)
    if (normalized) set.add(normalized)
  }
  g.__4626_server_admin_cache = { key: raw, set }
  return set
}

export function isServerAdminAddress(address: string): boolean {
  const normalized = normalizeAddress(address)
  if (!normalized) return false
  return readServerAdminAddressSet().has(normalized)
}

