import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  COOKIE_SESSION,
  handleOptions,
  setCookie,
  setCors,
  setNoStore,
  makeSessionToken,
} from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { upsertProfileByWallet } from '../../../server/_lib/profileSync.js'
import { classifyLinkedAccounts } from '../../../server/_lib/walletMapping.js'
import { syncUserWallets } from '../../../server/_lib/walletSync.js'

import { PrivyClient } from '@privy-io/server-auth'

declare const process: { env: Record<string, string | undefined> }

type PrivyVerifyResponse = {
  address: string
  sessionToken: string
  privyUserId: string
}

function getPrivyServerAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function getBearerToken(req: VercelRequest): string | null {
  const h = req.headers?.authorization
  const raw = typeof h === 'string' ? h.trim() : ''
  if (!raw || !raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice('bearer '.length).trim()
  return token.length > 0 ? token : null
}

function isLegacyFallbackEnabled(): boolean {
  const raw = String(process.env.WALLET_SYNC_LEGACY_FALLBACK ?? 'true').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const auth = getPrivyServerAuth()
  if (!auth) {
    return res.status(503).json({
      success: false,
      error: 'Privy server auth is not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).',
    } satisfies ApiEnvelope<never>)
  }

  const token = getBearerToken(req)
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing Privy auth token' } satisfies ApiEnvelope<never>)
  }

  try {
    const client = new PrivyClient(auth.appId, auth.appSecret)
    const claims = await client.verifyAuthToken(token)
    const user = await client.getUserById(claims.userId)

    const classified = classifyLinkedAccounts(user as any)
    const sessionAddress = classified.canonicalSmartWallet?.address ?? classified.primaryWalletAddress ?? null
    if (!sessionAddress) {
      return res.status(400).json({
        success: false,
        error: 'No EVM wallet is linked in Privy. Connect a wallet and retry.',
      } satisfies ApiEnvelope<never>)
    }

    const sessionToken = makeSessionToken({ address: sessionAddress })
    setCookie(req, res, COOKIE_SESSION, sessionToken, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })

    try {
      const db = await getDb()
      if (db) {
        await ensureWaitlistSchema(db as any)
        const syncResult = await syncUserWallets(db as any, user as any)

        if (isLegacyFallbackEnabled()) {
          try {
            await upsertProfileByWallet(db as any, {
              primaryWallet: syncResult.primaryWalletAddress ?? sessionAddress,
              embeddedWallet: syncResult.embeddedEoa?.address ?? null,
              embeddedWalletChain: syncResult.embeddedEoa?.chainType ?? null,
              embeddedWalletClientType: syncResult.embeddedEoa?.clientType ?? null,
              privyUserId: claims.userId,
              cswAddress: syncResult.canonicalSmartWallet?.address ?? null,
              baseSubAccount: syncResult.canonicalSmartWallet?.address ?? null,
            })
          } catch {
            // Compatibility write should not block auth.
          }
        }
      }
    } catch {
      // best-effort: auth should succeed even if DB is unavailable
    }

    return res.status(200).json({
      success: true,
      data: { address: sessionAddress, sessionToken, privyUserId: claims.userId } satisfies PrivyVerifyResponse,
    } satisfies ApiEnvelope<PrivyVerifyResponse>)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Privy verification failed'
    const lower = String(msg || '').toLowerCase()
    const isAuthish =
      lower.includes('jwt') ||
      lower.includes('token') ||
      lower.includes('signature') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden')
    return res.status(isAuthish ? 401 : 500).json({
      success: false,
      error: isAuthish ? 'Invalid Privy auth token' : 'Privy verification failed',
    } satisfies ApiEnvelope<never>)
  }
}
