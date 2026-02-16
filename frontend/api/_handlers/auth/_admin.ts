import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getSessionAddress, isAdminAddress, isAdminEmail } from '../../../server/_lib/session.js'
import { getDb } from '../../../server/_lib/postgres.js'

type AdminResponse = { address: string; isAdmin: boolean } | null

async function lookupEmailByWallet(address: string): Promise<string | null> {
  try {
    const db = await getDb()
    if (!db) return null
    // Check profiles first (most common)
    const r1 = await db.sql`
      SELECT email FROM profiles
      WHERE LOWER(primary_wallet) = LOWER(${address})
         OR LOWER(embedded_wallet) = LOWER(${address})
         OR LOWER(csw_address) = LOWER(${address})
         OR LOWER(primary_smart_wallet) = LOWER(${address})
         OR LOWER(primary_embedded_eoa) = LOWER(${address})
      LIMIT 1;
    `
    const email1 = r1?.rows?.[0]?.email
    if (typeof email1 === 'string' && email1.length > 0) return email1

    // Canonical wallet mapping table (profile_wallets -> profiles)
    const rPw = await db.sql`
      SELECT p.email
      FROM profile_wallets pw
      JOIN profiles p ON p.id = pw.profile_id
      WHERE LOWER(pw.address) = LOWER(${address})
      LIMIT 1;
    `
    const emailPw = rPw?.rows?.[0]?.email
    if (typeof emailPw === 'string' && emailPw.length > 0) return emailPw

    // Check creator_wallets
    const r2 = await db.sql`
      SELECT email FROM creator_wallets
      WHERE LOWER(wallet_address) = LOWER(${address})
      LIMIT 1;
    `
    const email2 = r2?.rows?.[0]?.email
    if (typeof email2 === 'string' && email2.length > 0) return email2

    return null
  } catch {
    return null
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

  // Check if admin by email (look up email from database)
  const email = await lookupEmailByWallet(address)
  if (email && isAdminEmail(email)) {
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

