import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getSessionAddress, isAdminAddress, isAdminEmail } from '../../../server/_lib/session.js'
import { getDb } from '../../../server/_lib/postgres.js'

type AdminResponse = { address: string; isAdmin: boolean } | null

function asAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase() as `0x${string}`
}

type AdminLookup = {
  email: string | null
  relatedAddresses: `0x${string}`[]
}

function asNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.trunc(parsed)
  }
  return null
}

async function lookupAdminContextByWallet(address: string): Promise<AdminLookup> {
  const related = new Set<`0x${string}`>()
  const addAddress = (value: unknown) => {
    const addr = asAddress(value)
    if (addr) related.add(addr)
  }

  try {
    const db = await getDb()
    if (!db) return { email: null, relatedAddresses: [] }

    let profileId: number | null = null
    let email: string | null = null

    // Check profiles first (most common).
    const r1 = await db.sql`
      SELECT
        id,
        email,
        primary_wallet,
        embedded_wallet,
        csw_address,
        primary_smart_wallet,
        primary_embedded_eoa
      FROM profiles
      WHERE LOWER(primary_wallet) = LOWER(${address})
         OR LOWER(embedded_wallet) = LOWER(${address})
         OR LOWER(csw_address) = LOWER(${address})
         OR LOWER(primary_smart_wallet) = LOWER(${address})
         OR LOWER(primary_embedded_eoa) = LOWER(${address})
      LIMIT 1;
    `
    const row1 = r1?.rows?.[0] as
      | {
          id?: unknown
          email?: unknown
          primary_wallet?: unknown
          embedded_wallet?: unknown
          csw_address?: unknown
          primary_smart_wallet?: unknown
          primary_embedded_eoa?: unknown
        }
      | undefined
    profileId = asNumericId(row1?.id) ?? profileId
    if (typeof row1?.email === 'string' && row1.email.length > 0) {
      email = row1.email
    }
    addAddress(row1?.primary_wallet)
    addAddress(row1?.embedded_wallet)
    addAddress(row1?.csw_address)
    addAddress(row1?.primary_smart_wallet)
    addAddress(row1?.primary_embedded_eoa)

    // Canonical wallet mapping table (profile_wallets -> profiles).
    // Also use it to gather all addresses linked to the same profile id.
    const rPw = await db.sql`
      SELECT p.id, p.email
      FROM profile_wallets pw
      JOIN profiles p ON p.id = pw.profile_id
      WHERE LOWER(pw.address) = LOWER(${address})
      LIMIT 1;
    `
    const rowPw = rPw?.rows?.[0] as { id?: unknown; email?: unknown } | undefined
    profileId = asNumericId(rowPw?.id) ?? profileId
    if (!email && typeof rowPw?.email === 'string' && rowPw.email.length > 0) {
      email = rowPw.email
    }

    if (profileId !== null) {
      const rLinked = await db.sql`
        SELECT
          p.primary_wallet,
          p.embedded_wallet,
          p.csw_address,
          p.primary_smart_wallet,
          p.primary_embedded_eoa,
          pw.address
        FROM profiles p
        LEFT JOIN profile_wallets pw ON pw.profile_id = p.id
        WHERE p.id = ${profileId}
      `
      for (const row of rLinked?.rows ?? []) {
        addAddress((row as any)?.primary_wallet)
        addAddress((row as any)?.embedded_wallet)
        addAddress((row as any)?.csw_address)
        addAddress((row as any)?.primary_smart_wallet)
        addAddress((row as any)?.primary_embedded_eoa)
        addAddress((row as any)?.address)
      }
    }

    // Check creator_wallets (legacy fallback path).
    const r2 = await db.sql`
      SELECT email FROM creator_wallets
      WHERE LOWER(wallet_address) = LOWER(${address})
      LIMIT 1;
    `
    const email2 = r2?.rows?.[0]?.email
    if (!email && typeof email2 === 'string' && email2.length > 0) {
      email = email2
    }

    return { email, relatedAddresses: Array.from(related) }
  } catch {
    return { email: null, relatedAddresses: [] }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const address = getSessionAddress(req)
  if (!address) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<AdminResponse>)
  }

  // Check if admin by wallet address first
  if (isAdminAddress(address)) {
    return res.status(200).json({
      success: true,
      data: { address, isAdmin: true } satisfies NonNullable<AdminResponse>,
    } satisfies ApiEnvelope<AdminResponse>)
  }

  // Resolve profile-linked wallets and email, then evaluate admin status from either.
  // This lets owner EOAs linked to a canonical session wallet inherit admin privileges.
  const adminContext = await lookupAdminContextByWallet(address)
  const linkedWalletIsAdmin = adminContext.relatedAddresses.some((wallet) => isAdminAddress(wallet))
  const linkedEmailIsAdmin = Boolean(adminContext.email && isAdminEmail(adminContext.email))
  if (linkedWalletIsAdmin || linkedEmailIsAdmin) {
    return res.status(200).json({
      success: true,
      data: { address, isAdmin: true } satisfies NonNullable<AdminResponse>,
    } satisfies ApiEnvelope<AdminResponse>)
  }

  return res.status(200).json({
    success: true,
    data: { address, isAdmin: false } satisfies NonNullable<AdminResponse>,
  } satisfies ApiEnvelope<AdminResponse>)
}

