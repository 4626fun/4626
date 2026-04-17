import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  checkRateLimit,
  getClientIp as getRateLimitIp,
  rateLimitKey,
  RATE_LIMITS,
} from '../../../packages/server-core/src/index.js'


import { assertNoEmailPrivyCollision, isIdentityRecoveryRequiredError } from '../../../server/_lib/identity/identityRecovery.js'
import {
  dedupeReferralCodeCandidates,
  getClientIp,
  getUserAgent,
  hashForAttribution,
  normalizeReferralCode,
  referralCodeFromEmail,
} from '../../../server/_lib/onboarding/referrals.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/onboarding/waitlistPoints.js'
import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  upsertAccount,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'
import { runWithOwnedEmailCollisionAdoption } from '../../../server/_lib/identity/emailCollisionAdoption.js'

type BootstrapBody = { email?: string; referralCode?: string }
type WaitlistBootstrapResponse =
  | {
      requiresPrivyAuth: true
      email: string | null
      waitlistEntryId: number | null
    }
  | ({
      requiresPrivyAuth: false
    } & Awaited<ReturnType<typeof buildAccountsMePayload>>)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CREATOR_COIN_REFERRAL_LOOKUP_TIMEOUT_MS = 1_500
const BOOTSTRAP_BODY_MAX_BYTES = 16_384

function normalizeEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

function normalizeReferralCodeOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = normalizeReferralCode(value)
  return normalized || null
}

function parseBootstrapBody(input: unknown): BootstrapBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as BootstrapBody
}

function isPrivyUserIdUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('profiles_privy_user_id_unique') ||
    (lower.includes('duplicate key value') && lower.includes('privy_user_id'))
  )
}

function isProfileEmailUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('waitlist_signups_email_key') ||
    (lower.includes('duplicate key value') && lower.includes('email'))
  )
}

function readPrivyToken(req: VercelRequest): string | null {
  const fromHeader = typeof req.headers?.['x-privy-token'] === 'string' ? req.headers['x-privy-token'].trim() : ''
  if (fromHeader) return fromHeader
  const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice('bearer '.length).trim()
    return token || null
  }
  return null
}

async function upsertBootstrapProfile(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  email: string
  privyUserId: string
}): Promise<void> {
  const { db, email, privyUserId } = params

  const rebindEmailProfileToPrivyUser = async (): Promise<boolean> => {
    const emailProfile = await db.sql`
      SELECT id
      FROM profiles
      WHERE LOWER(email) = LOWER(${email})
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      LIMIT 1;
    `
    const targetIdRaw = emailProfile.rows?.[0]?.id
    const targetId = typeof targetIdRaw === 'number' ? targetIdRaw : Number(targetIdRaw)
    if (!Number.isFinite(targetId) || targetId <= 0) return false

    await db.sql`
      UPDATE profiles
      SET privy_user_id = ${privyUserId}, updated_at = NOW()
      WHERE id = ${targetId};
    `

    const placeholderProfiles = await db.sql`
      SELECT id
      FROM profiles
      WHERE privy_user_id = ${privyUserId}
        AND id <> ${targetId}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC;
    `

    for (const row of placeholderProfiles.rows ?? []) {
      const placeholderIdRaw = (row as { id?: unknown })?.id
      const placeholderId = typeof placeholderIdRaw === 'number' ? placeholderIdRaw : Number(placeholderIdRaw)
      if (!Number.isFinite(placeholderId) || placeholderId <= 0) continue

      await db.sql`
        INSERT INTO points (signup_id, source, source_id, amount, created_at)
        SELECT ${targetId}, source, source_id, amount, created_at
        FROM points
        WHERE signup_id = ${placeholderId}
        ON CONFLICT DO NOTHING;
      `
      await db.sql`
        DELETE FROM points
        WHERE signup_id = ${placeholderId};
      `
      await db.sql`
        UPDATE profiles
        SET privy_user_id = NULL, updated_at = NOW()
        WHERE id = ${placeholderId};
      `
    }

    return true
  }

  const updateByPrivyUserId = async () =>
    db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        updated_at = NOW()
      WHERE privy_user_id = ${privyUserId}
      RETURNING id;
    `

  try {
    const existingByPrivy = await updateByPrivyUserId()
    if (Array.isArray(existingByPrivy.rows) && existingByPrivy.rows.length > 0) return
  } catch (error) {
    if (!isProfileEmailUniqueViolation(error)) throw error
    if (await rebindEmailProfileToPrivyUser()) return
    throw error
  }

  try {
    await db.sql`
      INSERT INTO profiles (email, privy_user_id, created_at, updated_at)
      VALUES (${email}, ${privyUserId}, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
        SET privy_user_id = COALESCE(profiles.privy_user_id, EXCLUDED.privy_user_id),
            updated_at = NOW();
    `
    return
  } catch (error) {
    if (!isPrivyUserIdUniqueViolation(error) && !isProfileEmailUniqueViolation(error)) throw error
  }

  if (await rebindEmailProfileToPrivyUser()) return

  const recoveredByPrivy = await updateByPrivyUserId()
  if (Array.isArray(recoveredByPrivy.rows) && recoveredByPrivy.rows.length > 0) return
  throw new Error('waitlist_bootstrap_profile_upsert_failed')
}

async function readBootstrapProfile(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  privyUserId: string
}): Promise<{
  signupId: number | null
  referralCode: string | null
  email: string | null
  primaryWallet: string | null
  embeddedWallet: string | null
  zoraHandle: string | null
}> {
  const profile = await params.db.sql`
    SELECT id, referral_code, email, primary_wallet, embedded_wallet
    FROM profiles
    WHERE privy_user_id = ${params.privyUserId}
    LIMIT 1;
  `
  const signupId = typeof profile?.rows?.[0]?.id === 'number' ? (profile.rows[0].id as number) : null
  const referralCode = typeof profile?.rows?.[0]?.referral_code === 'string' ? (profile.rows[0].referral_code as string) : null
  const email = normalizeEmail(profile?.rows?.[0]?.email)
  const primaryWallet = typeof profile?.rows?.[0]?.primary_wallet === 'string' ? String(profile.rows[0].primary_wallet).trim() || null : null
  const embeddedWallet =
    typeof profile?.rows?.[0]?.embedded_wallet === 'string' ? String(profile.rows[0].embedded_wallet).trim() || null : null

  // Read Zora handle for use as a referral code candidate
  let zoraHandle: string | null = null
  try {
    const zoraResult = await params.db.sql`
      SELECT zora_handle
      FROM account_zora_signals
      WHERE privy_user_id = ${params.privyUserId}
      LIMIT 1;
    `
    const raw = zoraResult?.rows?.[0]?.zora_handle
    zoraHandle = typeof raw === 'string' && raw.trim() ? raw.trim().replace(/^[@$]/, '') : null
  } catch { /* table may not exist yet */ }

  return { signupId, referralCode, email, primaryWallet, embeddedWallet, zoraHandle }
}

async function resolveCreatorCoinReferralCode(wallet: string | null | undefined): Promise<string | null> {
  const normalizedWallet = typeof wallet === 'string' ? wallet.trim() : ''
  const key = (process.env.ZORA_SERVER_API_KEY || '').trim()
  if (!normalizedWallet || !key) return null
  try {
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const profileResp = await sdk.getProfile({ identifier: normalizedWallet })
    const creatorCoinAddr = String((profileResp as any)?.data?.profile?.creatorCoin?.address ?? '').trim()
    if (!creatorCoinAddr) return null
    const coinResp = await sdk.getCoin({ address: creatorCoinAddr, chain: 8453 })
    const symbol = String((coinResp as any)?.data?.zora20Token?.symbol ?? '').trim()
    const name = String((coinResp as any)?.data?.zora20Token?.name ?? '').trim()
    const normalized = normalizeReferralCode(symbol || name)
    return normalized || null
  } catch {
    return null
  }
}

async function resolveCreatorCoinReferralCodeWithTimeout(wallet: string | null | undefined): Promise<string | null> {
  const normalizedWallet = typeof wallet === 'string' ? wallet.trim() : ''
  if (!normalizedWallet) return null

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race<string | null>([
      resolveCreatorCoinReferralCode(normalizedWallet).catch(() => null),
      new Promise<string | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), CREATOR_COIN_REFERRAL_LOOKUP_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

async function readCurrentBootstrapReferralCode(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  signupId: number
}): Promise<string | null> {
  const row = await params.db.sql`
    SELECT referral_code
    FROM profiles
    WHERE id = ${params.signupId}
    LIMIT 1;
  `
  return typeof row?.rows?.[0]?.referral_code === 'string' ? String(row.rows[0].referral_code) : null
}

async function ensureBootstrapReferralCode(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  signupId: number
  referralCode: string | null
  email: string | null
  primaryWallet: string | null
  embeddedWallet: string | null
  zoraHandle: string | null
}): Promise<string | null> {
  const creatorCoinCode =
    (await resolveCreatorCoinReferralCodeWithTimeout(params.primaryWallet)) ??
    (await resolveCreatorCoinReferralCodeWithTimeout(params.embeddedWallet))

  // If a code is already set, check if we can upgrade a generated fallback
  // (e.g. "CJ2") to a more memorable identity-based code.
  if (params.referralCode) {
    const generatedFallbackPattern = `C${Number(params.signupId).toString(36).toUpperCase()}`
    const isGeneratedFallback = params.referralCode === generatedFallbackPattern
    if (!isGeneratedFallback) return params.referralCode

    // Try to upgrade to an identity-based code
    const upgradeCandidates = dedupeReferralCodeCandidates([
      params.zoraHandle,
      creatorCoinCode,
    ])
    for (const desired of upgradeCandidates) {
      if (desired === params.referralCode) continue
      try {
        const updated = await params.db.sql`
          UPDATE profiles
          SET referral_code = ${desired}
          WHERE id = ${params.signupId} AND referral_code = ${params.referralCode}
          RETURNING referral_code;
        `
        const claimed = typeof updated?.rows?.[0]?.referral_code === 'string' ? (updated.rows[0].referral_code as string) : null
        if (claimed) return claimed
      } catch {
        continue
      }
    }
    return params.referralCode
  }

  const candidates = dedupeReferralCodeCandidates([
    params.zoraHandle,
    creatorCoinCode,
    referralCodeFromEmail(params.email),
    `C${Number(params.signupId).toString(36).toUpperCase()}`,
  ])

  for (const desired of candidates) {
    try {
      const updated = await params.db.sql`
        UPDATE profiles
        SET referral_code = ${desired}, referral_claimed_at = NOW()
        WHERE id = ${params.signupId} AND referral_code IS NULL
        RETURNING referral_code;
      `
      const claimed = typeof updated?.rows?.[0]?.referral_code === 'string' ? (updated.rows[0].referral_code as string) : null
      if (claimed) return claimed
      const existing = await readCurrentBootstrapReferralCode({ db: params.db, signupId: params.signupId })
      if (existing) return existing
    } catch {
      continue
    }
  }

  return await readCurrentBootstrapReferralCode({ db: params.db, signupId: params.signupId })
}

async function applyBootstrapReferral(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  signupId: number
  referralCode: string
  ipHash: string | null
  uaHash: string | null
}): Promise<void> {
  const referrer = await params.db.sql`
    SELECT id
    FROM profiles
    WHERE referral_code = ${params.referralCode}
    LIMIT 1;
  `
  const referrerId = typeof referrer?.rows?.[0]?.id === 'number' ? (referrer.rows[0].id as number) : null
  if (!referrerId || referrerId === params.signupId) return

  await params.db.sql`
    UPDATE profiles
    SET referred_by_code = ${params.referralCode}, referred_by_signup_id = ${referrerId}
    WHERE id = ${params.signupId} AND referred_by_signup_id IS NULL;
  `

  const conversionResult = await params.db.sql`
    INSERT INTO referral_conversions (
      referral_code,
      referrer_signup_id,
      invitee_signup_id,
      ip_hash,
      ua_hash,
      session_id,
      attribution,
      is_valid,
      invalid_reason,
      status,
      created_at
    )
    VALUES (
      ${params.referralCode},
      ${referrerId},
      ${params.signupId},
      ${params.ipHash},
      ${params.uaHash},
      NULL,
      'last_click',
      TRUE,
      NULL,
      'signed_up',
      NOW()
    )
    ON CONFLICT (invitee_signup_id) DO NOTHING
    RETURNING id;
  `

  if (conversionResult?.rows?.[0]?.id) {
    await awardWaitlistPoints({
      db: params.db as any,
      signupId: referrerId,
      source: 'referral_signup',
      sourceId: `invitee:${params.signupId}`,
      amount: WAITLIST_POINTS.referralSignup,
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const limiter = checkRateLimit(rateLimitKey('waitlist:bootstrap', getRateLimitIp(req)), RATE_LIMITS.general)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  let parsedBody: BootstrapBody | null = null
  try {
    parsedBody = await readBoundedJsonObjectBody<BootstrapBody>(req, { maxBytes: BOOTSTRAP_BODY_MAX_BYTES })
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' } satisfies ApiEnvelope<never>)
  }
  const body = parseBootstrapBody(parsedBody ?? {})
  if (Object.prototype.hasOwnProperty.call(body, 'email') && body.email != null && typeof body.email !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'referralCode') && body.referralCode != null && typeof body.referralCode !== 'string') {
    return res.status(400).json({ success: false, error: 'Invalid referral code' } satisfies ApiEnvelope<never>)
  }
  const email = normalizeEmail(body?.email)
  const referralCode = normalizeReferralCodeOrNull(body?.referralCode)
  const token = readPrivyToken(req)
  const ipHash = hashForAttribution(getClientIp(req))
  const uaHash = hashForAttribution(getUserAgent(req))

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  if (!token) {
    let waitlistEntryId: number | null = null
    if (email) {
      const existing = await db.sql`
        SELECT id
        FROM profiles
        WHERE email = ${email}
        LIMIT 1;
      `
      const idRaw = existing.rows?.[0]?.id
      const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
      waitlistEntryId = Number.isFinite(id) && id > 0 ? id : null
    }

    return res.status(200).json({
      success: true,
      data: {
        requiresPrivyAuth: true,
        email: email ?? null,
        waitlistEntryId,
      } satisfies WaitlistBootstrapResponse,
    } satisfies ApiEnvelope<WaitlistBootstrapResponse>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)

    const privyEmail = normalizeEmail((context.privyUser as any)?.email?.address)
    await runWithOwnedEmailCollisionAdoption({
      db: db as any,
      email: privyEmail,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
      action: () =>
        syncEmailIdentity({
          db: db as any,
          privyUserId: context.privyUserId,
          privyUser: context.privyUser,
        }),
    })

    // Only Privy's verified email is allowed to become the canonical account email.
    // Pre-auth form input is intent, not proof.
    if (privyEmail) {
      await runWithOwnedEmailCollisionAdoption({
        db: db as any,
        email: privyEmail,
        privyUserId: context.privyUserId,
        privyUser: context.privyUser,
        action: () =>
          assertNoEmailPrivyCollision({
            db: db as any,
            email: privyEmail,
            privyUserId: context.privyUserId,
          }),
      })
      await upsertAccount({
        db: db as any,
        privyUserId: context.privyUserId,
        email: privyEmail,
        emailVerified: true,
      })
      await upsertBootstrapProfile({
        db: db as any,
        email: privyEmail,
        privyUserId: context.privyUserId,
      })

      const bootstrapProfile = await readBootstrapProfile({
        db: db as any,
        privyUserId: context.privyUserId,
      })
      if (bootstrapProfile.signupId) {
        await ensureBootstrapReferralCode({
          db: db as any,
          signupId: bootstrapProfile.signupId,
          referralCode: bootstrapProfile.referralCode,
          email: bootstrapProfile.email,
          primaryWallet: bootstrapProfile.primaryWallet,
          embeddedWallet: bootstrapProfile.embeddedWallet,
          zoraHandle: bootstrapProfile.zoraHandle,
        })
        if (referralCode) {
          await applyBootstrapReferral({
            db: db as any,
            signupId: bootstrapProfile.signupId,
            referralCode,
            ipHash,
            uaHash,
          })
        }
      }
    }

    const me = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    return res.status(200).json({
      success: true,
      data: {
        requiresPrivyAuth: false,
        ...me,
      } satisfies WaitlistBootstrapResponse,
    } satisfies ApiEnvelope<WaitlistBootstrapResponse>)
  } catch (error: any) {
    if (isIdentityRecoveryRequiredError(error)) {
      return res.status(200).json({
        success: false,
        error: 'Recovery required: this email is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & {
        code: string
        recoveryRequired: true
      })
    }
    const message = typeof error?.message === 'string' ? error.message : 'Failed to bootstrap waitlist account'
    const lower = message.toLowerCase()
    const isEmailMismatch =
      lower.includes('email does not match authenticated user') || lower.includes('does not match authenticated user')
    if (isEmailMismatch) {
      return res.status(401).json({
        success: false,
        error: 'Session email mismatch. Please sign in again.',
      } satisfies ApiEnvelope<never>)
    }
    const status = lower.includes('token') || lower.includes('unauthorized') || lower.includes('privy') ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
