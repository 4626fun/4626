import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function getSessionAddress(req: VercelRequest): `0x${string}` | null {
  const session = readSessionFromRequest(req)
  const addr = session?.address ? String(session.address) : ''
  if (!isAddressLike(addr)) return null
  return addr.toLowerCase() as `0x${string}`
}

export function isAdminAddress(address: `0x${string}`): boolean {
  const raw = process.env.CREATOR_ACCESS_ADMIN_ADDRESSES
  if (!raw) return false

  const g: any = globalThis as any
  const cached: { key: string; set: Set<string> } | undefined = g.__creatorvault_admin_addresses_cache
  const cacheKey = raw
  const set =
    cached && cached.key === cacheKey
      ? cached.set
      : (() => {
          const parts = raw
            .split(/[\s,]+/g)
            .map((s) => s.trim())
            .filter(Boolean)
          const out = new Set<string>()
          for (const p of parts) {
            if (!isAddressLike(p)) continue
            out.add(p.toLowerCase())
          }
          g.__creatorvault_admin_addresses_cache = { key: cacheKey, set: out }
          return out
        })()

  const addrLc = address.toLowerCase()
  return set.has(addrLc)
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.CREATOR_ACCESS_ADMIN_EMAILS
  if (!raw) return false

  const g: any = globalThis as any
  const cached: { key: string; set: Set<string> } | undefined = g.__creatorvault_admin_emails_cache
  const cacheKey = raw
  const set =
    cached && cached.key === cacheKey
      ? cached.set
      : (() => {
          const parts = raw
            .split(/[\s,]+/g)
            .map((s) => normalizeEmail(s))
            .filter(Boolean)
          const out = new Set<string>()
          for (const p of parts) {
            if (!isValidEmail(p)) continue
            out.add(p)
          }
          g.__creatorvault_admin_emails_cache = { key: cacheKey, set: out }
          return out
        })()

  const emailLc = normalizeEmail(email)
  return set.has(emailLc)
}


