import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
  resolveAuthorizedRequestPrincipal,
} from '../../../packages/server-core/src/index.js'



import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { syncUserWallets } from '../../../server/_lib/walletSync.js'
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitKey } from '../../../server/_lib/rateLimit.js'

import { PrivyClient } from '@privy-io/server-auth'

declare const process: { env: Record<string, string | undefined> }

type WalletSyncResponse = {
  canonicalSmartWallet: { address: string; provider: string } | null
  canonicalSolanaWallet: { address: string; provider: string } | null
  operationalSolanaWallet: { address: string; provider: string } | null
  embeddedEoa: { address: string; chainType: string; clientType: string | null } | null
  connectedWallets: Array<{ address: string; walletType: string; provider: string }>
}

function getPrivyServerAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

async function resolvePrivyUserIdForProfile(db: any, profileId: number): Promise<string | null> {
  const result = await db.sql`
    SELECT privy_user_id
    FROM profiles
    WHERE id = ${profileId}
      AND privy_user_id IS NOT NULL
    LIMIT 1;
  `
  const privyUserId = result.rows?.[0]?.privy_user_id
  if (typeof privyUserId === 'string' && privyUserId.trim()) return privyUserId.trim()

  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('wallet-sync', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
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
    const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
    if (!authorizedPrincipal) {
      return res.status(403).json({
        success: false,
        error: 'Current session is not authorized for an active wallet profile',
      } satisfies ApiEnvelope<never>)
    }

    const privyUserId = await resolvePrivyUserIdForProfile(db as any, authorizedPrincipal.profileId)
    if (!privyUserId) {
      return res.status(409).json({
        success: false,
        error: 'No Privy user mapping found for this wallet',
      } satisfies ApiEnvelope<never>)
    }

    const client = new PrivyClient(auth.appId, auth.appSecret)
    const user = await client.getUserById(privyUserId)
    const syncResult = await syncUserWallets(db as any, user as any)

    const data: WalletSyncResponse = {
      canonicalSmartWallet: syncResult.canonicalSmartWallet,
      canonicalSolanaWallet: syncResult.canonicalSolanaWallet,
      operationalSolanaWallet: syncResult.operationalSolanaWallet,
      embeddedEoa: syncResult.embeddedEoa,
      connectedWallets: syncResult.connectedWallets,
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WalletSyncResponse>)
  } catch {
    return res.status(500).json({ success: false, error: 'Wallet sync failed' } satisfies ApiEnvelope<never>)
  }
}
