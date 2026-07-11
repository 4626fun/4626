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
  classifyLinkedAccounts,
  syncUserWallets,
  type ClassifiedLinkedAccounts,
} from '@4626/server-core'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import { isIdentityRecoveryRequiredError } from '../../../server/_lib/identity/identityRecovery.js'
import { PrivyClient } from '@privy-io/server-auth'

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

function pickPrivySessionAddress(params: {
  classified: ClassifiedLinkedAccounts
  classifiedSessionAddress: string | null
  persistedSessionAddress?: string | null
  syncedCanonicalAddress?: string | null
  syncedPrimaryAddress?: string | null
  syncedActiveOwnerAddress?: string | null
}): string | null {
  const currentLinked = collectCurrentLinkedEvmAddresses(params.classified)
  const candidates = [
    params.syncedActiveOwnerAddress,
    params.classifiedSessionAddress,
    params.syncedPrimaryAddress,
    params.syncedCanonicalAddress,
    params.persistedSessionAddress,
  ].map((value) => normalizeEvmAddress(value))

  for (const candidate of candidates) {
    if (candidate && currentLinked.has(candidate)) return candidate
  }

  // Prefer canonical smart wallets, then owner signers, then any linked EVM wallet.
  const smartWallet = params.classified.allWallets.find(
    (wallet) => wallet.chain === 'evm' && wallet.walletType === 'smart_wallet',
  )
  const smartAddress = normalizeEvmAddress(smartWallet?.address)
  if (smartAddress && currentLinked.has(smartAddress)) return smartAddress

  const ownerAddress = normalizeEvmAddress(
    params.classified.activeOwnerWallet?.address ?? params.classified.embeddedEoa?.address,
  )
  if (ownerAddress && currentLinked.has(ownerAddress)) return ownerAddress

  for (const wallet of params.classified.allWallets) {
    if (wallet.chain !== 'evm') continue
    const linked = normalizeEvmAddress(wallet.address)
    if (linked && currentLinked.has(linked)) return linked
  }

  // Fail closed for production safety: never mint a session for an address that
  // is not currently linked on the verified Privy user object.
  return null
}

const PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS = 4
const PRIVY_USER_WALLET_LINK_RETRY_DELAY_MS = 200

function logPrivyWalletProvision(detail: Record<string, unknown>): void {
  console.info('[auth/privy] ensure-user-wallet', detail)
}

/**
 * Waitlist email OTP uses whitelabel `loginWithCode`, which does not run Privy's
 * `createOnLogin` auto-wallet path. Client `createWallet()` on localhost also
 * loads the privy.4626.fun embedded-wallet iframe (server-cookie mode) and can
 * clear the just-minted session before a wallet exists. Provision the
 * user-owned embedded EOA server-side when the verified Privy user still has
 * zero linked wallets so `/api/auth/privy` can mint a session.
 */
async function ensurePrivyUserEmbeddedWallet(
  client: PrivyClient,
  userId: string,
  classified: ClassifiedLinkedAccounts,
): Promise<{ user: any; classified: ClassifiedLinkedAccounts }> {
  if (classified.allWallets.length > 0) {
    return { user: null, classified }
  }

  // Path 1: legacy app users/wallet endpoint (links wallet onto the Privy user).
  try {
    const created = await client.createWallets({
      userId,
      wallets: [
        {
          chainType: 'ethereum',
          policyIds: [],
        },
      ],
    })
    const nextClassified = classifyLinkedAccounts(created as any)
    logPrivyWalletProvision({
      path: 'createWallets',
      walletCount: nextClassified.allWallets.length,
      primary: nextClassified.primaryWalletAddress ?? null,
    })
    if (nextClassified.allWallets.length > 0) {
      return { user: created, classified: nextClassified }
    }
  } catch (error) {
    logPrivyWalletProvision({
      path: 'createWallets',
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
  }

  // Path 2: Wallet API create with the Privy user as owner, then re-load the user.
  try {
    const wallet = await client.walletApi.create({
      chainType: 'ethereum',
      owner: { userId },
    })
    logPrivyWalletProvision({
      path: 'walletApi.create',
      address: typeof wallet?.address === 'string' ? wallet.address : null,
      walletId: typeof wallet?.id === 'string' ? wallet.id : null,
    })
  } catch (error) {
    logPrivyWalletProvision({
      path: 'walletApi.create',
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
  }

  const user = await client.getUserById(userId)
  const reloaded = classifyLinkedAccounts(user as any)
  logPrivyWalletProvision({
    path: 'reload',
    walletCount: reloaded.allWallets.length,
    primary: reloaded.primaryWalletAddress ?? null,
  })
  return { user, classified: reloaded }
}

async function loadPrivyUserWithWalletLinkRetry(
  client: PrivyClient,
  userId: string,
): Promise<{ user: any; classified: ClassifiedLinkedAccounts }> {
  let user = await client.getUserById(userId)
  let classified = classifyLinkedAccounts(user as any)

  if (classified.allWallets.length === 0) {
    // Prefer server provision immediately for brand-new email OTP users.
    // Client createWallet on localhost often clears auth before a wallet exists,
    // so waiting for client-side link propagation just adds latency.
    const provisioned = await ensurePrivyUserEmbeddedWallet(client, userId, classified)
    if (provisioned.user) user = provisioned.user
    classified = provisioned.classified
  }

  for (
    let attempt = 1;
    attempt < PRIVY_USER_WALLET_LINK_RETRY_ATTEMPTS && classified.allWallets.length === 0;
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, PRIVY_USER_WALLET_LINK_RETRY_DELAY_MS))
    user = await client.getUserById(userId)
    classified = classifyLinkedAccounts(user as any)
  }

  return { user, classified }
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
      row.csw_address,
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


// FIX: FINDING-19 — this module-level variable is process-scoped; in serverless,
// each warm instance has its own counter and concurrent instances don't share state.
// This means the throttle does not prevent duplicate syncs across instances.
// For robust deduplication, move throttle to DB (e.g., a `last_synced_at` column
// on the profile, updated atomically). syncUserWallets uses upsert so duplicates
// are idempotent, making this a performance concern rather than a correctness bug.
let lastPrivyAuthDbSyncAtMs = 0

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
    const client = new PrivyClient(auth.appId, auth.appSecret)
    const verificationKey = getPrivyJwtVerificationKey()
    const claims = await client.verifyAuthToken(token, verificationKey ?? undefined)
    const loaded = await loadPrivyUserWithWalletLinkRetry(client, claims.userId)
    let user = loaded.user
    let classified = loaded.classified
    // Session principal should prefer the active owner signer used for canonical execution.
    // This keeps paymaster ownership checks and canonical submit guards aligned.
    const classifiedSessionAddress =
      classified.activeOwnerWallet?.address ??
      classified.canonicalSmartWallet?.address ??
      classified.primaryWalletAddress ??
      null
    let sessionAddress = classifiedSessionAddress

    try {
      const db = await getDb()
      if (db) {
        await ensureWaitlistSchema(db as any)
        const persistedSessionAddress = await resolvePersistedSessionAddress(db as any, claims.userId)
        sessionAddress = pickPrivySessionAddress({
          classified,
          classifiedSessionAddress,
          persistedSessionAddress,
        })

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
          sessionAddress = pickPrivySessionAddress({
            classified,
            classifiedSessionAddress,
            persistedSessionAddress,
            syncedCanonicalAddress: syncResult.canonicalSmartWallet?.address ?? null,
            syncedPrimaryAddress: syncResult.primaryWalletAddress ?? null,
            syncedActiveOwnerAddress: syncResult.activeOwnerWallet?.address ?? null,
          })
          lastPrivyAuthDbSyncAtMs = now
        }
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
      // continue to fall through (best-effort): auth can still succeed when the DB is
      // unavailable for reasons unrelated to identity recovery.
      if (isIdentityRecoveryRequiredError(dbSyncError)) {
        throw dbSyncError
      }
      // best-effort: auth should succeed even if DB is unavailable
    }

    if (!sessionAddress) {
      return res.status(400).json({
        success: false,
        error: 'No Privy wallet is ready yet. Finish email or wallet sign-in, then retry in a moment.',
      } satisfies ApiEnvelope<never>)
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
