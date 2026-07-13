import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  COOKIE_SESSION,
  handleOptions,
  setCookie,
  setCors,
  setNoStore,
  makeSessionToken,
  getDb,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
  syncUserWallets,
  type ClassifiedLinkedAccounts,
} from '@4626/server-core'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import { isIdentityRecoveryRequiredError } from '../../../server/_lib/identity/identityRecovery.js'
import {
  createPrivyServerClientFromEnv,
  ensurePrivyUserEmbeddedWallet,
} from '../../../server/_lib/identity/privyEmbeddedWalletProvision.js'

declare const process: { env: Record<string, string | undefined> }

// FIX: FINDING-02 — removed sessionToken and privyUserId from response body;
// session is conveyed via HttpOnly cookie only, preventing XSS exfiltration.
type PrivyVerifyResponse = {
  address: string
}

function getPrivyServerAuth(): { appId: string; appSecret: string } | null {
  const appId = (process.env.PRIVY_APP_ID || '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET || '').trim()
  if (!appId || !appSecret) return null
  return { appId, appSecret }
}

function getPrivyJwtVerificationKey(): string | null {
  const key = String(process.env.PRIVY_JWT_VERIFICATION_KEY ?? '').trim()
  return key.length > 0 ? key : null
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

function collectCurrentLinkedEvmAddresses(classified: ClassifiedLinkedAccounts): Set<string> {
  const out = new Set<string>()

  for (const wallet of classified.allWallets) {
    if (wallet.chain !== 'evm') continue
    const normalized = normalizeEvmAddress(wallet.address)
    if (normalized) out.add(normalized)
  }

  const canonical = normalizeEvmAddress(classified.canonicalSmartWallet?.address)
  if (canonical) out.add(canonical)

  const activeOwner = normalizeEvmAddress(classified.activeOwnerWallet?.address)
  if (activeOwner) out.add(activeOwner)

  const primary = normalizeEvmAddress(classified.primaryWalletAddress)
  if (primary) out.add(primary)

  return out
}

export function pickPrivySessionAddress(params: {
  classified: ClassifiedLinkedAccounts
  persistedAuthorityAddresses: readonly string[]
}): string | null {
  const currentLinked = collectCurrentLinkedEvmAddresses(params.classified)
  for (const value of params.persistedAuthorityAddresses) {
    const candidate = normalizeEvmAddress(value)
    if (candidate && currentLinked.has(candidate)) return candidate
  }

  // Fail closed: an arbitrary linked wallet is not automatically authorized to
  // represent the persisted 4626 profile.
  return null
}

function shouldBypassWalletSyncThrottle(params: {
  persistedSessionAddress: string | null
  classifiedSessionAddress: string | null
}): boolean {
  const persisted = normalizeEvmAddress(params.persistedSessionAddress)
  const classified = normalizeEvmAddress(params.classifiedSessionAddress)
  return Boolean(persisted && classified && persisted !== classified)
}

type PersistedSessionAuthority = {
  profileId: number
  addresses: string[]
}

async function resolvePersistedSessionAuthority(
  db: any,
  privyUserId: string,
): Promise<PersistedSessionAuthority | null> {
  try {
    const result = await db.sql`
      SELECT
        p.id,
        p.csw_address,
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
          id?: unknown
          csw_address?: unknown
          primary_wallet?: unknown
          primary_embedded_eoa?: unknown
          canonical_wallet?: unknown
        }
      | undefined
    if (!row) return null
    const profileId = typeof row.id === 'number' ? row.id : Number(row.id)
    if (!Number.isFinite(profileId) || profileId <= 0) return null

    const roleWallets = await db.sql`
      SELECT address
      FROM profile_wallets
      WHERE profile_id = ${profileId}
        AND (
          is_primary = true
          OR is_embedded_eoa = true
          OR is_canonical_smart_wallet = true
        )
      ORDER BY
        is_canonical_smart_wallet DESC,
        is_primary DESC,
        is_embedded_eoa DESC,
        verified_at DESC NULLS LAST,
        address ASC;
    `
    const candidates = [
      row.canonical_wallet,
      row.csw_address,
      row.primary_wallet,
      row.primary_embedded_eoa,
      ...(roleWallets?.rows ?? []).map((walletRow: { address?: unknown }) => walletRow.address),
    ]
    const addresses: string[] = []
    const seen = new Set<string>()
    for (const candidate of candidates) {
      const normalized = normalizeEvmAddress(candidate)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      addresses.push(normalized)
    }
    return { profileId, addresses }
  } catch {
    return null
  }
}


// Process-local, per-user throttle. Warm instances do not share state, so this
// reduces repeated work without suppressing one user's sync behind another.
// For robust deduplication, move throttle to DB (e.g., a `last_synced_at` column
// on the profile, updated atomically). syncUserWallets uses upsert so duplicates
// are idempotent, making this a performance concern rather than a correctness bug.
const MAX_PRIVY_AUTH_SYNC_THROTTLE_ENTRIES = 1_000
const lastPrivyAuthDbSyncAtMsByUser = new Map<string, number>()

export function resetPrivyAuthDbSyncThrottleForTests(): void {
  lastPrivyAuthDbSyncAtMsByUser.clear()
}

function recordPrivyAuthDbSync(privyUserId: string, syncedAtMs: number): void {
  if (
    !lastPrivyAuthDbSyncAtMsByUser.has(privyUserId) &&
    lastPrivyAuthDbSyncAtMsByUser.size >= MAX_PRIVY_AUTH_SYNC_THROTTLE_ENTRIES
  ) {
    const oldestUserId = lastPrivyAuthDbSyncAtMsByUser.keys().next().value
    if (typeof oldestUserId === 'string') lastPrivyAuthDbSyncAtMsByUser.delete(oldestUserId)
  }
  lastPrivyAuthDbSyncAtMsByUser.delete(privyUserId)
  lastPrivyAuthDbSyncAtMsByUser.set(privyUserId, syncedAtMs)
}

function getPrivyAuthDbSyncMinIntervalMs(): number {
  const raw = String(process.env.PRIVY_AUTH_DB_SYNC_MIN_INTERVAL_MS ?? '').trim()
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  return 15_000
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // H-07 / 4626-299: durable failClosed limiter for auth endpoints.
  const limiter = await checkDurableRateLimit(
    rateLimitKey('auth-privy', getClientIp(req)),
    RATE_LIMITS.authPrivy,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
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
    const client = createPrivyServerClientFromEnv()
    const verificationKey = getPrivyJwtVerificationKey()
    const claims = await client.verifyAuthToken(token, verificationKey ?? undefined)
    const loaded = await ensurePrivyUserEmbeddedWallet(client, claims.userId)
    const user = loaded.user
    const classified = loaded.classified
    // The 4626 cookie represents canonical account identity. Prefer the parent
    // CSW when present; execution code resolves the embedded owner separately.
    const classifiedSessionAddress =
      classified.canonicalSmartWallet?.address ??
      classified.activeOwnerWallet?.address ??
      classified.embeddedEoa?.address ??
      classified.primaryWalletAddress ??
      null
    let sessionAddress: string | null = null

    try {
      const db = await getDb()
      if (db) {
        await ensureWaitlistSchema(db as any)
        const persistedAuthority = await resolvePersistedSessionAuthority(db as any, claims.userId)
        const persistedSessionAddress = persistedAuthority?.addresses[0] ?? null

        const now = Date.now()
        const minInterval = getPrivyAuthDbSyncMinIntervalMs()
        const lastUserSyncAtMs = lastPrivyAuthDbSyncAtMsByUser.get(claims.userId)
        const shouldSyncNow =
          !persistedSessionAddress ||
          lastUserSyncAtMs === undefined ||
          now - lastUserSyncAtMs >= minInterval ||
          shouldBypassWalletSyncThrottle({
            persistedSessionAddress,
            classifiedSessionAddress,
          })
        if (shouldSyncNow) {
          await syncUserWallets(db as any, user as any)
          recordPrivyAuthDbSync(claims.userId, now)
        }
        const currentAuthority = shouldSyncNow
          ? await resolvePersistedSessionAuthority(db as any, claims.userId)
          : persistedAuthority
        sessionAddress = pickPrivySessionAddress({
          classified,
          persistedAuthorityAddresses: currentAuthority?.addresses ?? [],
        })
      }
    } catch (dbSyncError) {
      // FIX: M-16 / 4626-428 — Privy auth must NEVER swallow IDENTITY_RECOVERY_REQUIRED.
      //
      // Previously this catch block bypassed identity-recovery enforcement whenever a
      // classified sessionAddress had already been resolved from the in-memory Privy
      // response, even though the database rejected the write because the same email
      // is bound to a different account. That allowed a caller to mint an HttpOnly
      // session cookie for an account the Privy user is not authorized to represent,
      // silently defeating the RECOVERY_REQUIRED_EMAIL_BOUND protection surfaced by
      // other bootstrap endpoints.
      //
      // The server now re-throws so the outer catch returns 409 RECOVERY_REQUIRED_EMAIL_BOUND
      // regardless of whether a session address was derivable. Other database errors
      // continue to the fail-closed response below. Without persisted authority
      // data, a merely linked wallet must not receive a 4626 session.
      if (isIdentityRecoveryRequiredError(dbSyncError)) {
        throw dbSyncError
      }
    }

    if (!sessionAddress) {
      return res.status(400).json({
        success: false,
        error: 'No Privy wallet is ready yet. Finish email or wallet sign-in, then retry in a moment.',
        code: 'PRIVY_WALLET_NOT_READY',
      } satisfies ApiEnvelope<never> & { code: string })
    }

    const sessionToken = makeSessionToken({ address: sessionAddress })
    setCookie(req, res, COOKIE_SESSION, sessionToken, { httpOnly: true, maxAgeSeconds: 60 * 60 * 24 * 7 })

    // FIX: FINDING-02 — do not return sessionToken or privyUserId in response body;
    // the session cookie is set above, privyUserId is unnecessary client-side.
    return res.status(200).json({
      success: true,
      data: { address: sessionAddress } satisfies PrivyVerifyResponse,
    } satisfies ApiEnvelope<PrivyVerifyResponse>)
  } catch (e: unknown) {
    if (isIdentityRecoveryRequiredError(e)) {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this email is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }

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
