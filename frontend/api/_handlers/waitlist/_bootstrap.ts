import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { assertNoEmailPrivyCollision, isIdentityRecoveryRequiredError } from '../../../server/_lib/identityRecovery.js'
import {
  dedupeReferralCodeCandidates,
  ensureReferralsSchema,
  getClientIp,
  getUserAgent,
  hashForAttribution,
  normalizeReferralCode,
  referralCodeFromEmail,
} from '../../../server/_lib/referrals.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, ensureWaitlistPointsSchema, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  upsertAccount,
  verifyPrivyForAccounts,
} from '../../../server/_lib/accountsIdentity.js'

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

function isPrivyUserIdUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('profiles_privy_user_id_unique') ||
    (lower.includes('duplicate key value') && lower.includes('privy_user_id'))
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

  const updateByPrivyUserId = async () =>
    db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        updated_at = NOW()
      WHERE privy_user_id = ${privyUserId}
      RETURNING id;
    `

  const existingByPrivy = await updateByPrivyUserId()
  if (Array.isArray(existingByPrivy.rows) && existingByPrivy.rows.length > 0) return

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
    if (!isPrivyUserIdUniqueViolation(error)) throw error
  }

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
  return { signupId, referralCode, email, primaryWallet, embeddedWallet }
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
}): Promise<string | null> {
  if (params.referralCode) return params.referralCode
  const creatorCoinCode =
    (await resolveCreatorCoinReferralCodeWithTimeout(params.primaryWallet)) ??
    (await resolveCreatorCoinReferralCodeWithTimeout(params.embeddedWallet))
  const candidates = dedupeReferralCodeCandidates([
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

  const body = (await readJsonBody<BootstrapBody>(req).catch(() => null)) ?? (req.body as BootstrapBody | null) ?? {}
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
  await ensureWaitlistPointsSchema(db as any)
  await ensureReferralsSchema(db as any)

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

    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const privyEmail = normalizeEmail((context.privyUser as any)?.email?.address)
    // Only Privy's verified email is allowed to become the canonical account email.
    // Pre-auth form input is intent, not proof.
    if (privyEmail) {
      await assertNoEmailPrivyCollision({
        db: db as any,
        email: privyEmail,
        privyUserId: context.privyUserId,
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
      return res.status(409).json({
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
