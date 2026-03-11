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

function normalizeEvmAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

function shouldBypassWalletSyncThrottle(params: {
  persistedSessionAddress: string | null
  classifiedSessionAddress: string | null
}): boolean {
  const persisted = normalizeEvmAddress(params.persistedSessionAddress)
  const classified = normalizeEvmAddress(params.classifiedSessionAddress)
  return Boolean(persisted && classified && persisted !== classified)
}

async function resolvePersistedSessionAddress(db: any, privyUserId: string): Promise<string | null> {
  try {
    const result = await db.sql`
      SELECT
        p.primary_smart_wallet,
        p.csw_address,
        p.base_sub_account,
        p.primary_wallet,
        p.primary_embedded_eoa,
        canonical.address AS canonical_wallet
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT pw.address
        FROM profile_wallets pw
        WHERE pw.profile_id = p.id
          AND pw.is_canonical_smart_wallet = true
        LIMIT 1
      ) canonical ON true
      WHERE p.privy_user_id = ${privyUserId}
      LIMIT 1;
    `
    const row = result?.rows?.[0] as
      | {
          primary_smart_wallet?: unknown
          csw_address?: unknown
          base_sub_account?: unknown
          primary_wallet?: unknown
          primary_embedded_eoa?: unknown
          canonical_wallet?: unknown
        }
      | undefined
    if (!row) return null
    const candidates = [
      row.canonical_wallet,
      row.primary_smart_wallet,
      row.csw_address,
      row.base_sub_account,
      row.primary_wallet,
      row.primary_embedded_eoa,
    ]
    for (const candidate of candidates) {
      const normalized = normalizeEvmAddress(candidate)
      if (normalized) return normalized
    }
    return null
  } catch {
    return null
  }
}


let lastPrivyAuthDbSyncAtMs = 0

function getPrivyAuthDbSyncMinIntervalMs(): number {
  const raw = String(process.env.PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS ?? '').trim()
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  return 15_000
}

function isLegacyFallbackEnabled(): boolean {
  const raw = String(process.env.WALLET_SYNC_LEGACY_FALLBACK ?? 'false').trim().toLowerCase()
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
    const classifiedSessionAddress =
      classified.canonicalSmartWallet?.address ?? classified.primaryWalletAddress ?? null
    let sessionAddress = classifiedSessionAddress

    try {
      const db = await getDb()
      if (db) {
        await ensureWaitlistSchema(db as any)
        const persistedSessionAddress = await resolvePersistedSessionAddress(db as any, claims.userId)
        if (persistedSessionAddress) {
          sessionAddress = persistedSessionAddress
        }

        const now = Date.now()
        const minInterval = getPrivyAuthDbSyncMinIntervalMs()
        const shouldSyncNow =
          now - lastPrivyAuthDbSyncAtMs >= minInterval ||
          shouldBypassWalletSyncThrottle({
            persistedSessionAddress,
            classifiedSessionAddress,
          })
        if (shouldSyncNow) {
          const syncResult = await syncUserWallets(db as any, user as any)
          sessionAddress = syncResult.canonicalSmartWallet?.address ?? syncResult.primaryWalletAddress ?? sessionAddress
          const rawEmail = typeof (user as any)?.email?.address === 'string' ? String((user as any).email.address).trim() : ''
          const privyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail.toLowerCase() : null

          if (isLegacyFallbackEnabled()) {
            try {
              await upsertProfileByWallet(db as any, {
                email: privyEmail,
                primaryWallet: syncResult.activeOwnerWallet?.address ?? syncResult.primaryWalletAddress ?? sessionAddress,
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
          lastPrivyAuthDbSyncAtMs = now
        }
      }
    } catch {
      // best-effort: auth should succeed even if DB is unavailable
    }

    if (!sessionAddress) {
      return res.status(400).json({
        success: false,
        error: 'No EVM wallet is linked in Privy. Connect a wallet and retry.',
      } satisfies ApiEnvelope<never>)
    }

    const sessionToken = makeSessionToken({ address: sessionAddress })
    setCookie(req, res, COOKIE_SESSION, sessionToken, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })

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
