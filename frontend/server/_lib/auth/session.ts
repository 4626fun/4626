import type { VercelRequest } from '@vercel/node'

import { readSessionFromRequest } from '../../auth/_shared.js'
import { buildAgentSessionContext, type AgentSessionContext } from '../../agent/core/resolveIdentityContext.js'
import { isAddressLike, isServerAdminAddress, normalizeEmail } from '../infra/trust.js'

declare const process: { env: Record<string, string | undefined> }

export type RuntimeSessionContext = AgentSessionContext

export function getSessionAddress(req: VercelRequest): `0x${string}` | null {
  const session = readSessionFromRequest(req)
  const addr = session?.address ? String(session.address) : ''
  if (!isAddressLike(addr)) return null
  return addr.toLowerCase() as `0x${string}`
}

export function isAdminAddress(address: string): boolean {
  return isServerAdminAddress(address)
}

export function buildRuntimeSessionContext(address: string | null | undefined): RuntimeSessionContext | null {
  return buildAgentSessionContext({
    address,
    source: 'xmtp',
  })
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.CREATOR_ACCESS_ADMIN_EMAILS
  if (!raw) return false

  const g: any = globalThis as any
  const cached: { key: string; set: Set<string> } | undefined = g.__4626_admin_emails_cache
  const cacheKey = raw
  const set =
    cached && cached.key === cacheKey
      ? cached.set
      : (() => {
          const parts = raw
            .split(/[\s,]+/g)
            .map((s) => normalizeEmail(s))
            .filter((candidate): candidate is string => Boolean(candidate))
          const out = new Set<string>()
          for (const p of parts) {
            if (!isValidEmail(p)) continue
            out.add(p)
          }
          g.__4626_admin_emails_cache = { key: cacheKey, set: out }
          return out
        })()

  const emailLc = normalizeEmail(email)
  if (!emailLc) return false
  return set.has(emailLc)
}
