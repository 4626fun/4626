import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { checkRateLimit, RATE_LIMITS, rateLimitKey, getClientIp } from '../../../server/_lib/rateLimit.js'

type Body = { currentEmail?: string; newEmail?: string }

type UpdateEmailResponse = {
  email: string
}

type OwnedProfile = { id: number; email: string }

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function normalizeAddress(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun') || v.endsWith('@wallet.4626.fun')
}

function isLegacySyntheticEmail(v: string): boolean {
  const s = String(v || '').trim().toLowerCase()
  if (!s.endsWith('@example.com')) return false
  const local = s.split('@')[0] ?? ''
  return (
    local.startsWith('solinfer-') ||
    local.startsWith('wallet-') ||
    local.startsWith('anon-') ||
    local.startsWith('0x')
  )
}

function isAnySyntheticEmail(v: string): boolean {
  return isSyntheticEmail(v) || isLegacySyntheticEmail(v)
}
async function findOwnedProfileByEmail(params: {
  db: any
  email: string
  principalAddress: string
}): Promise<OwnedProfile | null> {
  const { db, email, principalAddress } = params
  const q = await db.sql`
    SELECT p.id, p.email
    FROM profiles p
    WHERE p.email = ${email}
    LIMIT 1;
  `
  const row = q?.rows?.[0] as { id?: unknown; email?: unknown } | undefined
  if (!row?.id) return null
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  if (!Number.isFinite(id) || id <= 0) return null
  const authorized = await isAuthorizedWalletForProfile({
    db,
    profileId: id,
    address: principalAddress,
  })
  if (!authorized) return null
  return { id, email: typeof row.email === 'string' ? row.email : email }
}

async function findOwnedProfileByPrincipal(params: {
  db: any
  principalAddress: string
}): Promise<OwnedProfile | null> {
  const { db, principalAddress } = params
  const q = await db.sql`
    SELECT p.id, p.email
    FROM profiles p
    WHERE (
      LOWER(p.primary_wallet) = ${principalAddress}
      OR LOWER(p.embedded_wallet) = ${principalAddress}
      OR LOWER(p.csw_address) = ${principalAddress}
      OR LOWER(p.base_sub_account) = ${principalAddress}
      OR LOWER(p.primary_smart_wallet) = ${principalAddress}
      OR LOWER(p.primary_embedded_eoa) = ${principalAddress}
    )
    ORDER BY
      CASE WHEN p.email IS NULL THEN 2 WHEN LOWER(p.email) LIKE '%@noemail.4626.fun' OR LOWER(p.email) LIKE '%@wallet.4626.fun' THEN 1 ELSE 0 END ASC,
      p.updated_at DESC,
      p.created_at ASC
    LIMIT 1;
  `
  const row = q?.rows?.[0] as { id?: unknown; email?: unknown } | undefined
  if (!row?.id) return null
  const id = typeof row.id === 'number' ? row.id : Number(row.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return { id, email: typeof row.email === 'string' ? row.email : '' }
}
async function mergeOwnedProfiles(params: {
  db: any
  sourceProfileId: number
  targetProfileId: number
}): Promise<void> {
  const { db, sourceProfileId, targetProfileId } = params
  if (sourceProfileId === targetProfileId) return

  const uniqueValues = await db.sql`
    SELECT
      src.privy_user_id AS source_privy_user_id,
      src.referral_code AS source_referral_code,
      src.referral_claimed_at AS source_referral_claimed_at,
      dst.privy_user_id AS target_privy_user_id,
      dst.referral_code AS target_referral_code
    FROM profiles src
    JOIN profiles dst ON dst.id = ${targetProfileId}
    WHERE src.id = ${sourceProfileId}
    LIMIT 1;
  `
  const uniqueRow = (uniqueValues?.rows?.[0] ?? null) as {
    source_privy_user_id?: unknown
    source_referral_code?: unknown
    source_referral_claimed_at?: unknown
    target_privy_user_id?: unknown
    target_referral_code?: unknown
  } | null
  const sourcePrivyUserId =
    typeof uniqueRow?.source_privy_user_id === 'string' ? String(uniqueRow.source_privy_user_id) : null
  const sourceReferralCode =
    typeof uniqueRow?.source_referral_code === 'string' ? String(uniqueRow.source_referral_code) : null
  const sourceReferralClaimedAt = uniqueRow?.source_referral_claimed_at ?? null
  const targetPrivyUserId =
    typeof uniqueRow?.target_privy_user_id === 'string' ? String(uniqueRow.target_privy_user_id) : null
  const targetReferralCode =
    typeof uniqueRow?.target_referral_code === 'string' ? String(uniqueRow.target_referral_code) : null

  if (!targetPrivyUserId && sourcePrivyUserId) {
    await db.sql`UPDATE profiles SET privy_user_id = NULL WHERE id = ${sourceProfileId};`
    await db.sql`
      UPDATE profiles
      SET privy_user_id = ${sourcePrivyUserId}
      WHERE id = ${targetProfileId}
        AND privy_user_id IS NULL;
    `
  }
  if (!targetReferralCode && sourceReferralCode) {
    await db.sql`UPDATE profiles SET referral_code = NULL WHERE id = ${sourceProfileId};`
    await db.sql`
      UPDATE profiles
      SET
        referral_code = ${sourceReferralCode},
        referral_claimed_at = COALESCE(referral_claimed_at, ${sourceReferralClaimedAt}, NOW())
      WHERE id = ${targetProfileId}
        AND referral_code IS NULL;
    `
  }

  await db.sql`
    UPDATE profiles dst
    SET
      primary_wallet = COALESCE(dst.primary_wallet, src.primary_wallet),
      solana_wallet = COALESCE(dst.solana_wallet, src.solana_wallet),
      canonical_solana_wallet = COALESCE(dst.canonical_solana_wallet, src.canonical_solana_wallet, src.solana_wallet),
      operational_solana_wallet = COALESCE(dst.operational_solana_wallet, src.operational_solana_wallet),
      embedded_wallet = COALESCE(dst.embedded_wallet, src.embedded_wallet),
      embedded_wallet_chain = COALESCE(dst.embedded_wallet_chain, src.embedded_wallet_chain),
      embedded_wallet_client_type = COALESCE(dst.embedded_wallet_client_type, src.embedded_wallet_client_type),
      base_sub_account = COALESCE(dst.base_sub_account, src.base_sub_account),
      persona = COALESCE(dst.persona, src.persona),
      has_creator_coin = COALESCE(dst.has_creator_coin, src.has_creator_coin),
      farcaster_fid = COALESCE(dst.farcaster_fid, src.farcaster_fid),
      contact_preference = COALESCE(dst.contact_preference, src.contact_preference),
      app_access_status = COALESCE(dst.app_access_status, src.app_access_status),
      app_access_decision_note = COALESCE(dst.app_access_decision_note, src.app_access_decision_note),
      app_access_decided_at = COALESCE(dst.app_access_decided_at, src.app_access_decided_at),
      app_access_decided_by = COALESCE(dst.app_access_decided_by, src.app_access_decided_by),
      verifications = COALESCE(dst.verifications, src.verifications),
      csw_address = COALESCE(dst.csw_address, src.csw_address),
      primary_smart_wallet = COALESCE(dst.primary_smart_wallet, src.primary_smart_wallet),
      primary_embedded_eoa = COALESCE(dst.primary_embedded_eoa, src.primary_embedded_eoa),
      display_name = COALESCE(dst.display_name, src.display_name),
      bio = COALESCE(dst.bio, src.bio),
      website = COALESCE(dst.website, src.website),
      avatar_url = COALESCE(dst.avatar_url, src.avatar_url),
      banner_url = COALESCE(dst.banner_url, src.banner_url),
      profile_fields = COALESCE(dst.profile_fields, src.profile_fields),
      preprovisioned_at = COALESCE(dst.preprovisioned_at, src.preprovisioned_at),
      preprov_server_wallet_id = COALESCE(dst.preprov_server_wallet_id, src.preprov_server_wallet_id),
      preprov_server_wallet_address = COALESCE(dst.preprov_server_wallet_address, src.preprov_server_wallet_address),
      preprov_coin_address = COALESCE(dst.preprov_coin_address, src.preprov_coin_address),
      preprov_coin_symbol = COALESCE(dst.preprov_coin_symbol, src.preprov_coin_symbol),
      preprov_farcaster_username = COALESCE(dst.preprov_farcaster_username, src.preprov_farcaster_username),
      preprov_farcaster_pfp = COALESCE(dst.preprov_farcaster_pfp, src.preprov_farcaster_pfp),
      preprov_zora_handle = COALESCE(dst.preprov_zora_handle, src.preprov_zora_handle),
      erc8004_agent_id = COALESCE(dst.erc8004_agent_id, src.erc8004_agent_id),
      erc8128_agent_id = COALESCE(dst.erc8128_agent_id, src.erc8128_agent_id),
      lens_handle = COALESCE(dst.lens_handle, src.lens_handle),
      lens_account_address = COALESCE(dst.lens_account_address, src.lens_account_address),
      lens_owner_address = COALESCE(dst.lens_owner_address, src.lens_owner_address),
      lens_grove_uri = COALESCE(dst.lens_grove_uri, src.lens_grove_uri),
      referred_by_code = COALESCE(dst.referred_by_code, src.referred_by_code),
      referred_by_signup_id = COALESCE(dst.referred_by_signup_id, src.referred_by_signup_id),
      referral_claimed_at = COALESCE(dst.referral_claimed_at, src.referral_claimed_at),
      profile_completed_at = COALESCE(dst.profile_completed_at, src.profile_completed_at),
      updated_at = NOW()
    FROM profiles src
    WHERE dst.id = ${targetProfileId}
      AND src.id = ${sourceProfileId};
  `

  await db.sql`
    INSERT INTO profile_wallets (
      profile_id,
      address,
      is_primary,
      is_canonical_smart_wallet,
      is_canonical_solana_wallet,
      is_operational_solana_wallet,
      is_embedded_eoa,
      verified_at,
      metadata,
      updated_at
    )
    SELECT
      ${targetProfileId},
      pw.address,
      pw.is_primary,
      pw.is_canonical_smart_wallet,
      pw.is_canonical_solana_wallet,
      pw.is_operational_solana_wallet,
      pw.is_embedded_eoa,
      pw.verified_at,
      pw.metadata,
      NOW()
    FROM profile_wallets pw
    WHERE pw.profile_id = ${sourceProfileId}
    ON CONFLICT (profile_id, address) DO UPDATE
    SET
      is_primary = profile_wallets.is_primary OR EXCLUDED.is_primary,
      is_canonical_smart_wallet = profile_wallets.is_canonical_smart_wallet OR EXCLUDED.is_canonical_smart_wallet,
      is_canonical_solana_wallet = profile_wallets.is_canonical_solana_wallet OR EXCLUDED.is_canonical_solana_wallet,
      is_operational_solana_wallet = profile_wallets.is_operational_solana_wallet OR EXCLUDED.is_operational_solana_wallet,
      is_embedded_eoa = profile_wallets.is_embedded_eoa OR EXCLUDED.is_embedded_eoa,
      verified_at = COALESCE(profile_wallets.verified_at, EXCLUDED.verified_at),
      metadata = COALESCE(profile_wallets.metadata, EXCLUDED.metadata),
      updated_at = NOW();
  `
  await db.sql`DELETE FROM profile_wallets WHERE profile_id = ${sourceProfileId};`

  await db.sql`
    UPDATE points src
    SET signup_id = ${targetProfileId}
    WHERE src.signup_id = ${sourceProfileId}
      AND (
        src.source_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM points dst
          WHERE dst.signup_id = ${targetProfileId}
            AND dst.source = src.source
            AND dst.source_id = src.source_id
        )
      );
  `
  await db.sql`DELETE FROM points WHERE signup_id = ${sourceProfileId};`

  await db.sql`
    UPDATE referral_conversions
    SET referrer_signup_id = ${targetProfileId}
    WHERE referrer_signup_id = ${sourceProfileId};
  `
  await db.sql`
    UPDATE referral_conversions src
    SET invitee_signup_id = ${targetProfileId}
    WHERE src.invitee_signup_id = ${sourceProfileId}
      AND NOT EXISTS (
        SELECT 1
        FROM referral_conversions dst
        WHERE dst.invitee_signup_id = ${targetProfileId}
          AND dst.id <> src.id
      );
  `
  await db.sql`DELETE FROM referral_conversions WHERE invitee_signup_id = ${sourceProfileId};`
  await db.sql`
    UPDATE profiles
    SET referred_by_signup_id = ${targetProfileId}
    WHERE referred_by_signup_id = ${sourceProfileId}
      AND id <> ${targetProfileId};
  `

  const deleted = await db.sql`DELETE FROM profiles WHERE id = ${sourceProfileId} RETURNING id;`
  if (!deleted?.rows?.[0]?.id) {
    await db.sql`
      UPDATE profiles
      SET
        primary_wallet = NULL,
        embedded_wallet = NULL,
        csw_address = NULL,
        base_sub_account = NULL,
        primary_smart_wallet = NULL,
        primary_embedded_eoa = NULL,
        privy_user_id = NULL,
        updated_at = NOW()
      WHERE id = ${sourceProfileId};
    `
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  // Rate limiting: 5 email updates per minute per IP
  const clientIp = getClientIp(req)
  const rateLimit = checkRateLimit(rateLimitKey('update-email', clientIp), { windowMs: 60_000, maxRequests: 5 })
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  // Authentication required - verify caller owns the profile
  const principalAddress = normalizeAddress(readRequestPrincipalAddress(req))
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const currentEmailInput = typeof body?.currentEmail === 'string' ? body.currentEmail : ''
  const currentEmail = normalizeEmail(currentEmailInput)
  const hasCurrentEmail = currentEmail.length > 0
  const newEmail = normalizeEmail(typeof body?.newEmail === 'string' ? body.newEmail : '')

  if ((hasCurrentEmail && !isValidEmail(currentEmail)) || !isValidEmail(newEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }
  if (isAnySyntheticEmail(newEmail)) {
    return res.status(400).json({ success: false, error: 'A real email address is required.' } satisfies ApiEnvelope<never>)
  }

  if (hasCurrentEmail && currentEmail === newEmail) {
    const data: UpdateEmailResponse = { email: newEmail }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const currentOwnedProfile = hasCurrentEmail
    ? await findOwnedProfileByEmail({
        db,
        email: currentEmail,
        principalAddress,
      })
    : await findOwnedProfileByPrincipal({
        db,
        principalAddress,
      })
  if (!currentOwnedProfile) {
    return res.status(hasCurrentEmail ? 403 : 404).json({
      success: false,
      error: hasCurrentEmail ? 'Not authorized to update this profile' : 'Signup not found.',
    } satisfies ApiEnvelope<never>)
  }

  // Atomic update with NOT EXISTS to prevent TOCTOU race.
  // Keep the legacy "update by currentEmail" branch for compatibility with existing clients/tests.
  const updated = hasCurrentEmail
    ? await db.sql`
        UPDATE profiles
        SET email = ${newEmail}, contact_preference = 'email', updated_at = NOW()
        WHERE email = ${currentEmail}
          AND NOT EXISTS (SELECT 1 FROM profiles WHERE email = ${newEmail})
        RETURNING id, email;
      `
    : await db.sql`
        UPDATE profiles
        SET email = ${newEmail}, contact_preference = 'email', updated_at = NOW()
        WHERE id = ${currentOwnedProfile.id}
          AND NOT EXISTS (SELECT 1 FROM profiles WHERE email = ${newEmail} AND id <> ${currentOwnedProfile.id})
        RETURNING id, email;
      `
  const row = updated?.rows?.[0] ?? null
  if (!row?.id) {
    // Could be: profile not found, or email already taken (race condition)
    const conflict = await db.sql`SELECT id FROM profiles WHERE email = ${newEmail} LIMIT 1;`
    if (conflict?.rows?.[0]) {
      const targetOwnedProfile = await findOwnedProfileByEmail({
        db,
        email: newEmail,
        principalAddress,
      })
      if (targetOwnedProfile && targetOwnedProfile.id !== currentOwnedProfile.id) {
        await mergeOwnedProfiles({
          db,
          sourceProfileId: currentOwnedProfile.id,
          targetProfileId: targetOwnedProfile.id,
        })
        const data: UpdateEmailResponse = { email: newEmail }
        return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
      }
      if (targetOwnedProfile && targetOwnedProfile.id === currentOwnedProfile.id) {
        const data: UpdateEmailResponse = { email: newEmail }
        return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
      }
      return res.status(409).json({ success: false, error: 'Email already in use.' } satisfies ApiEnvelope<never>)
    }
    return res.status(404).json({ success: false, error: 'Signup not found.' } satisfies ApiEnvelope<never>)
  }

  const data: UpdateEmailResponse = { email: String(row.email ?? newEmail) }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UpdateEmailResponse>)
}
