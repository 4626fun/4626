import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { syncUserWallets } from '../../../server/_lib/walletSync.js'

import { PrivyClient } from '@privy-io/server-auth'

declare const process: { env: Record<string, string | undefined> }

type WalletSyncResponse = {
  canonicalSmartWallet: { address: string; provider: string } | null
  embeddedEoa: { address: string; chainType: string; clientType: string | null } | null
  connectedWallets: Array<{ address: string; walletType: string; provider: string }>
}

function getPrivyServerAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

async function resolvePrivyUserIdForSession(db: any, address: string): Promise<string | null> {
  const byWalletGraph = await db.sql`
    SELECT p.privy_user_id
    FROM profile_wallets pw
    JOIN profiles p ON p.id = pw.profile_id
    WHERE LOWER(pw.address) = ${address}
      AND p.privy_user_id IS NOT NULL
    LIMIT 1;
  `
  const fromGraph = byWalletGraph.rows?.[0]?.privy_user_id
  if (typeof fromGraph === 'string' && fromGraph.trim()) return fromGraph.trim()

  const byLegacy = await db.sql`
    SELECT privy_user_id
    FROM profiles
    WHERE privy_user_id IS NOT NULL
      AND (
        LOWER(primary_wallet) = ${address}
        OR LOWER(embedded_wallet) = ${address}
        OR LOWER(csw_address) = ${address}
        OR LOWER(base_sub_account) = ${address}
        OR LOWER(primary_smart_wallet) = ${address}
        OR LOWER(primary_embedded_eoa) = ${address}
      )
    LIMIT 1;
  `
  const fromLegacy = byLegacy.rows?.[0]?.privy_user_id
  if (typeof fromLegacy === 'string' && fromLegacy.trim()) return fromLegacy.trim()

  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const session = readSessionFromRequest(req)
  const sessionAddress = typeof session?.address === 'string' ? session.address.trim().toLowerCase() : ''
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const auth = getPrivyServerAuth()
  if (!auth) {
    return res.status(503).json({ success: false, error: 'Privy server auth unavailable' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db as any)
    const privyUserId = await resolvePrivyUserIdForSession(db as any, sessionAddress)
    if (!privyUserId) {
      return res.status(409).json({
        success: false,
        error: 'No Privy user mapping found for this session',
      } satisfies ApiEnvelope<never>)
    }

    const client = new PrivyClient(auth.appId, auth.appSecret)
    const user = await client.getUserById(privyUserId)
    const syncResult = await syncUserWallets(db as any, user as any)

    const data: WalletSyncResponse = {
      canonicalSmartWallet: syncResult.canonicalSmartWallet,
      embeddedEoa: syncResult.embeddedEoa,
      connectedWallets: syncResult.connectedWallets,
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WalletSyncResponse>)
  } catch {
    return res.status(500).json({ success: false, error: 'Wallet sync failed' } satisfies ApiEnvelope<never>)
  }
}
