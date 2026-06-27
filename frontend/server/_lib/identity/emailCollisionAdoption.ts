import { upsertLinkedMethod } from './accountsIdentity.js'
import { type IdentityRecoveryRequiredError, isIdentityRecoveryRequiredError } from './identityRecovery.js'
import { extractPrivyVerifiedEmail } from '../infra/trust.js'
import { classifyLinkedAccounts, type PrivyUserLike } from '../wallet/walletMapping.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
  query?: (text: string, values?: any[]) => Promise<{ rows: any[] }>
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isPrivyEmailVerified(privyUser: PrivyUserLike, email: string): boolean {
  const normalizedEmail = normalizeLower(email)
  if (!normalizedEmail) return false
  return normalizeLower(extractPrivyVerifiedEmail(privyUser)) === normalizedEmail
}

async function upsertPrivyUserAlias(params: {
  db: Db
  privyUserId: string
  profileId: number
  source: string
}): Promise<void> {
  try {
    await params.db.sql`
      INSERT INTO privy_user_aliases (privy_user_id, profile_id, source, created_at)
      VALUES (${params.privyUserId}, ${params.profileId}, ${params.source}, NOW())
      ON CONFLICT (privy_user_id) DO NOTHING;
    `
  } catch {
    // privy_user_aliases may not exist in legacy envs — safe to ignore.
  }
}

function collectPrivyOwnedEvmAddresses(privyUser: PrivyUserLike): Set<string> {
  const classification = classifyLinkedAccounts(privyUser)
  const ownedAddresses = new Set<string>()

  for (const wallet of classification.allWallets) {
    const normalized = normalizeLower(wallet.address)
    if (normalized) ownedAddresses.add(normalized)
  }

  const primaryWallet = normalizeLower(classification.primaryWalletAddress)
  if (primaryWallet) ownedAddresses.add(primaryWallet)

  const embeddedWallet = normalizeLower(classification.embeddedEoa?.address)
  if (embeddedWallet) ownedAddresses.add(embeddedWallet)

  return ownedAddresses
}

async function readCanonicalProfileAddresses(db: Db, profileId: number): Promise<string[]> {
  const profileResult = await db.sql`
    SELECT
      primary_wallet,
      solana_wallet,
      canonical_solana_wallet,
      operational_solana_wallet,
      embedded_wallet,
      base_sub_account,
      csw_address,
      primary_smart_wallet,
      primary_embedded_eoa
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `

  const profileRow = (profileResult?.rows?.[0] ?? null) as Record<string, unknown> | null
  const profileAddresses = [
    profileRow?.primary_wallet,
    profileRow?.solana_wallet,
    profileRow?.canonical_solana_wallet,
    profileRow?.operational_solana_wallet,
    profileRow?.embedded_wallet,
    profileRow?.base_sub_account,
    profileRow?.csw_address,
    profileRow?.primary_smart_wallet,
    profileRow?.primary_embedded_eoa,
  ]
    .map((value) => normalizeLower(value))
    .filter(Boolean)

  const profileWallets = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profileId};
  `
  for (const row of profileWallets?.rows ?? []) {
    const normalized = normalizeLower((row as { address?: unknown })?.address)
    if (normalized) profileAddresses.push(normalized)
  }

  return profileAddresses
}

async function privyUserOwnsProfileAddresses(params: {
  db: Db
  privyUser: PrivyUserLike
  profileId: number
}): Promise<boolean> {
  const ownedAddresses = collectPrivyOwnedEvmAddresses(params.privyUser)
  if (ownedAddresses.size === 0) return false
  const profileAddresses = await readCanonicalProfileAddresses(params.db, params.profileId)
  return profileAddresses.some((address) => ownedAddresses.has(address))
}

async function mergePlaceholderProfiles(params: {
  db: Db
  email: string
  privyUserId: string
  targetProfileId: number
}): Promise<void> {
  // RACE-003: Wrap the entire merge in a transaction so a mid-loop failure
  // doesn't leave placeholder profiles in a partially-merged state.
  const canTransaction = typeof params.db.query === 'function'
  if (canTransaction) {
    await params.db.query!('BEGIN')
  }
  try {
    const placeholderProfiles = await params.db.sql`
      SELECT id
      FROM profiles
      WHERE privy_user_id = ${params.privyUserId}
        AND id <> ${params.targetProfileId}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC;
    `

    for (const row of placeholderProfiles.rows ?? []) {
      const placeholderIdRaw = (row as { id?: unknown })?.id
      const placeholderId = typeof placeholderIdRaw === 'number' ? placeholderIdRaw : Number(placeholderIdRaw)
      if (!Number.isFinite(placeholderId) || placeholderId <= 0) continue

      await params.db.sql`
        INSERT INTO points (signup_id, source, source_id, amount, created_at)
        SELECT ${params.targetProfileId}, source, source_id, amount, created_at
        FROM points
        WHERE signup_id = ${placeholderId}
        ON CONFLICT DO NOTHING;
      `
      await params.db.sql`
        DELETE FROM points
        WHERE signup_id = ${placeholderId};
      `
      await params.db.sql`
        UPDATE profiles
        SET privy_user_id = NULL, updated_at = NOW()
        WHERE id = ${placeholderId};
      `
    }

    if (canTransaction) {
      await params.db.query!('COMMIT')
    }
  } catch (error) {
    if (canTransaction) {
      try { await params.db.query!('ROLLBACK') } catch {}
    }
    throw error
  }
}

async function rebindEmailCollisionProfile(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
}): Promise<boolean> {
  const { collision, db, email, privyUserId } = params
  if (collision.reason !== 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER') return false

  const profileResult = await db.sql`
    SELECT id, privy_user_id
    FROM profiles
    WHERE LOWER(email) = LOWER(${email})
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    LIMIT 1;
  `

  const profileRow = (profileResult?.rows?.[0] ?? null) as { id?: unknown; privy_user_id?: unknown } | null
  const profileId = typeof profileRow?.id === 'number' ? profileRow.id : Number(profileRow?.id)
  if (!Number.isFinite(profileId) || profileId <= 0) return false

  const existingPrivyUserId = normalizeLower(collision.existingPrivyUserId)
  if (!existingPrivyUserId) return false

  const profilePrivyUserId = normalizeLower(profileRow?.privy_user_id)
  const requestedPrivyUserId = normalizeLower(collision.requestedPrivyUserId)
  if (
    profilePrivyUserId &&
    profilePrivyUserId !== existingPrivyUserId &&
    profilePrivyUserId !== requestedPrivyUserId
  ) {
    return false
  }

  const updatedProfile = await db.sql`
    UPDATE profiles
    SET privy_user_id = ${privyUserId}, updated_at = NOW()
    WHERE id = ${profileId}
      AND (
        privy_user_id IS NULL
        OR LOWER(privy_user_id) = ${existingPrivyUserId}
        OR LOWER(privy_user_id) = ${normalizeLower(collision.requestedPrivyUserId)}
      )
    RETURNING id;
  `
  if (!updatedProfile?.rows?.length) return false

  await mergePlaceholderProfiles({
    db,
    email,
    privyUserId,
    targetProfileId: profileId,
  })

  await db.sql`
    UPDATE accounts
    SET
      privy_user_id = ${privyUserId},
      email_verified = TRUE,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER(${email})
      AND (
        privy_user_id IS NULL
        OR LOWER(privy_user_id) = ${existingPrivyUserId}
        OR LOWER(privy_user_id) = ${normalizeLower(collision.requestedPrivyUserId)}
      );
  `
  await upsertLinkedMethod({
    db: db as any,
    privyUserId,
    type: 'email',
    value: email,
    verified: true,
  })
  await upsertPrivyUserAlias({
    db,
    privyUserId,
    profileId,
    source: 'waitlist_email_rebind',
  })
  return true
}

async function rebindWalletCollisionProfile(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
}): Promise<boolean> {
  const { collision, db, email, privyUserId } = params
  if (collision.reason !== 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE') return false

  const profileId = collision.canonicalProfileId
  if (!Number.isInteger(profileId) || profileId <= 0) return false

  const profileResult = await db.sql`
    SELECT id, privy_user_id
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const profileRow = (profileResult?.rows?.[0] ?? null) as { id?: unknown; privy_user_id?: unknown } | null
  if (!profileRow) return false

  const profilePrivyUserId = normalizeLower(profileRow?.privy_user_id)
  const requestedPrivyUserId = normalizeLower(collision.requestedPrivyUserId)

  await upsertPrivyUserAlias({
    db,
    privyUserId,
    profileId,
    source: 'waitlist_wallet_adopt',
  })

  if (profilePrivyUserId && profilePrivyUserId !== requestedPrivyUserId) {
    return true
  }

  const updatedProfile = await db.sql`
    UPDATE profiles
    SET privy_user_id = ${privyUserId}, updated_at = NOW()
    WHERE id = ${profileId}
      AND (
        privy_user_id IS NULL
        OR LOWER(privy_user_id) = ${requestedPrivyUserId}
      )
    RETURNING id;
  `
  if (!updatedProfile?.rows?.length) return true

  await mergePlaceholderProfiles({
    db,
    email,
    privyUserId,
    targetProfileId: profileId,
  })

  await db.sql`
    UPDATE accounts
    SET
      privy_user_id = ${privyUserId},
      email_verified = TRUE,
      updated_at = NOW()
    WHERE LOWER(email) = LOWER(${email})
      AND (
        privy_user_id IS NULL
        OR LOWER(privy_user_id) = ${requestedPrivyUserId}
      );
  `
  await upsertLinkedMethod({
    db: db as any,
    privyUserId,
    type: 'email',
    value: email,
    verified: true,
  })
  return true
}

async function adoptOwnedEmailCollision(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
  privyUser: PrivyUserLike
}): Promise<boolean> {
  const { collision, db, email, privyUserId, privyUser } = params
  if (collision.reason !== 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER') return false

  const classification = classifyLinkedAccounts(privyUser)
  const ownedAddresses = new Set<string>()

  for (const wallet of classification.allWallets) {
    const normalized = normalizeLower(wallet.address)
    if (normalized) ownedAddresses.add(normalized)
  }

  const primaryWallet = normalizeLower(classification.primaryWalletAddress)
  if (primaryWallet) ownedAddresses.add(primaryWallet)

  const embeddedWallet = normalizeLower(classification.embeddedEoa?.address)
  if (embeddedWallet) ownedAddresses.add(embeddedWallet)

  if (ownedAddresses.size === 0) return false

  const profileResult = await db.sql`
    SELECT
      id,
      privy_user_id,
      primary_wallet,
      solana_wallet,
      canonical_solana_wallet,
      operational_solana_wallet,
      embedded_wallet,
      base_sub_account,
      csw_address,
      primary_smart_wallet,
      primary_embedded_eoa
    FROM profiles
    WHERE LOWER(email) = LOWER(${email})
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    LIMIT 1;
  `

  const profileRow = (profileResult?.rows?.[0] ?? null) as
    | {
        id?: unknown
        privy_user_id?: unknown
        primary_wallet?: unknown
        solana_wallet?: unknown
        canonical_solana_wallet?: unknown
        operational_solana_wallet?: unknown
        embedded_wallet?: unknown
        base_sub_account?: unknown
        csw_address?: unknown
        primary_smart_wallet?: unknown
        primary_embedded_eoa?: unknown
      }
    | null
  const profileId = typeof profileRow?.id === 'number' ? profileRow.id : Number(profileRow?.id)
  if (!Number.isFinite(profileId) || profileId <= 0) return false

  const existingPrivyUserId = normalizeLower(collision.existingPrivyUserId)
  if (!existingPrivyUserId) return false

  const profilePrivyUserId = normalizeLower(profileRow?.privy_user_id)
  if (profilePrivyUserId && profilePrivyUserId !== existingPrivyUserId) return false

  const profileAddresses = [
    profileRow?.primary_wallet,
    profileRow?.solana_wallet,
    profileRow?.canonical_solana_wallet,
    profileRow?.operational_solana_wallet,
    profileRow?.embedded_wallet,
    profileRow?.base_sub_account,
    profileRow?.csw_address,
    profileRow?.primary_smart_wallet,
    profileRow?.primary_embedded_eoa,
  ]
    .map((value) => normalizeLower(value))
    .filter(Boolean)

  const profileWallets = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profileId};
  `
  for (const row of profileWallets?.rows ?? []) {
    const normalized = normalizeLower((row as { address?: unknown })?.address)
    if (normalized) profileAddresses.push(normalized)
  }

  const ownsProfile = profileAddresses.some((address) => ownedAddresses.has(address))
  if (!ownsProfile) return false

  return rebindEmailCollisionProfile({
    db,
    collision,
    email,
    privyUserId,
  })
}

async function adoptWaitlistVerifiedEmailRebind(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
  privyUser: PrivyUserLike
}): Promise<boolean> {
  if (params.collision.reason !== 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER') return false
  if (!isPrivyEmailVerified(params.privyUser, params.email)) return false

  return rebindEmailCollisionProfile({
    db: params.db,
    collision: params.collision,
    email: params.email,
    privyUserId: params.privyUserId,
  })
}

function isMatchingEmailCollision(params: {
  error: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
}): boolean {
  if (params.error.reason !== 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER') return false
  const errorEmail = normalizeLower(params.error.email)
  const requestedPrivyUserId = normalizeLower(params.error.requestedPrivyUserId)
  const currentPrivyUserId = normalizeLower(params.privyUserId)
  return Boolean(errorEmail) && errorEmail === params.email && requestedPrivyUserId === currentPrivyUserId
}

async function adoptWaitlistBootstrapEmailHintRebind(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
  bootstrapEmailHint: string | null | undefined
}): Promise<boolean> {
  if (params.collision.reason !== 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER') return false
  const hint = normalizeLower(params.bootstrapEmailHint)
  const collisionEmail = normalizeLower(params.email)
  if (!hint || hint !== collisionEmail) return false

  return rebindEmailCollisionProfile({
    db: params.db,
    collision: params.collision,
    email: params.email,
    privyUserId: params.privyUserId,
  })
}

async function adoptEmailCollision(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
  privyUser: PrivyUserLike
  allowVerifiedEmailRebind: boolean
  bootstrapEmailHint?: string | null
}): Promise<boolean> {
  if (
    await adoptOwnedEmailCollision({
      db: params.db,
      collision: params.collision,
      email: params.email,
      privyUserId: params.privyUserId,
      privyUser: params.privyUser,
    })
  ) {
    return true
  }

  if (!params.allowVerifiedEmailRebind) return false

  if (
    await adoptWaitlistVerifiedEmailRebind({
      db: params.db,
      collision: params.collision,
      email: params.email,
      privyUserId: params.privyUserId,
      privyUser: params.privyUser,
    })
  ) {
    return true
  }

  return adoptWaitlistBootstrapEmailHintRebind({
    db: params.db,
    collision: params.collision,
    email: params.email,
    privyUserId: params.privyUserId,
    bootstrapEmailHint: params.bootstrapEmailHint,
  })
}

function isMatchingWalletCollision(params: {
  error: IdentityRecoveryRequiredError
  privyUserId: string
}): boolean {
  if (params.error.reason !== 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE') return false
  const requestedPrivyUserId = normalizeLower(params.error.requestedPrivyUserId)
  const currentPrivyUserId = normalizeLower(params.privyUserId)
  return Boolean(requestedPrivyUserId) && requestedPrivyUserId === currentPrivyUserId
}

async function adoptWalletBoundCollision(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
  privyUser: PrivyUserLike
  allowVerifiedEmailRebind: boolean
}): Promise<boolean> {
  if (params.collision.reason !== 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE') return false

  const canonicalEmail =
    normalizeLower(params.collision.canonicalEmail) || normalizeLower(params.email)
  if (!canonicalEmail) return false

  const verified =
    params.allowVerifiedEmailRebind && isPrivyEmailVerified(params.privyUser, canonicalEmail)
  const ownsProfile = await privyUserOwnsProfileAddresses({
    db: params.db,
    privyUser: params.privyUser,
    profileId: params.collision.canonicalProfileId,
  })

  if (!verified && !ownsProfile) return false

  return rebindWalletCollisionProfile({
    db: params.db,
    collision: params.collision,
    email: canonicalEmail,
    privyUserId: params.privyUserId,
  })
}

export async function runWithWaitlistWalletCollisionAdoption<T>(params: {
  db: Db
  email: string | null | undefined
  privyUserId: string
  privyUser: PrivyUserLike
  bootstrapEmailHint?: string | null
  action: () => Promise<T>
}): Promise<T> {
  const { action, bootstrapEmailHint, db, email, privyUser, privyUserId } = params
  try {
    return await action()
  } catch (error: unknown) {
    const verifiedEmail = normalizeLower(extractPrivyVerifiedEmail(privyUser))
    const requestedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const hintEmail =
      typeof bootstrapEmailHint === 'string' ? bootstrapEmailHint.trim().toLowerCase() : ''
    const collisionEmail =
      isIdentityRecoveryRequiredError(error) &&
      error.reason === 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE' &&
      typeof error.canonicalEmail === 'string'
        ? error.canonicalEmail.trim().toLowerCase()
        : ''
    const normalizedEmail = verifiedEmail || requestedEmail || hintEmail || collisionEmail
    const canAdopt =
      normalizedEmail &&
      isIdentityRecoveryRequiredError(error) &&
      isMatchingWalletCollision({
        error,
        privyUserId,
      }) &&
      (await adoptWalletBoundCollision({
        db,
        collision: error,
        email: normalizedEmail,
        privyUserId,
        privyUser,
        allowVerifiedEmailRebind: true,
      }))
    if (!canAdopt) throw error
    return action()
  }
}

export async function runWithOwnedEmailCollisionAdoption<T>(params: {
  db: Db
  email: string | null | undefined
  privyUserId: string
  privyUser: PrivyUserLike
  action: () => Promise<T>
}): Promise<T> {
  const { action, db, email, privyUser, privyUserId } = params
  try {
    return await action()
  } catch (error: unknown) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const canAdopt =
      normalizedEmail &&
      isIdentityRecoveryRequiredError(error) &&
      isMatchingEmailCollision({
        error,
        email: normalizedEmail,
        privyUserId,
      }) &&
      (await adoptEmailCollision({
        db,
        collision: error,
        email: normalizedEmail,
        privyUserId,
        privyUser,
        allowVerifiedEmailRebind: false,
      }))
    if (!canAdopt) throw error
    return action()
  }
}

export async function runWithWaitlistEmailCollisionAdoption<T>(params: {
  db: Db
  email: string | null | undefined
  privyUserId: string
  privyUser: PrivyUserLike
  bootstrapEmailHint?: string | null
  action: () => Promise<T>
}): Promise<T> {
  const { action, bootstrapEmailHint, db, email, privyUser, privyUserId } = params
  try {
    return await action()
  } catch (error: unknown) {
    const verifiedEmail = normalizeLower(extractPrivyVerifiedEmail(privyUser))
    const requestedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const hintEmail =
      typeof bootstrapEmailHint === 'string' ? bootstrapEmailHint.trim().toLowerCase() : ''
    const collisionEmail =
      isIdentityRecoveryRequiredError(error) &&
      error.reason === 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER' &&
      typeof error.email === 'string'
        ? error.email.trim().toLowerCase()
        : ''
    const normalizedEmail = verifiedEmail || requestedEmail || hintEmail || collisionEmail
    const canAdopt =
      normalizedEmail &&
      isIdentityRecoveryRequiredError(error) &&
      isMatchingEmailCollision({
        error,
        email: normalizedEmail,
        privyUserId,
      }) &&
      (await adoptEmailCollision({
        db,
        collision: error,
        email: normalizedEmail,
        privyUserId,
        privyUser,
        allowVerifiedEmailRebind: true,
        bootstrapEmailHint:
          typeof bootstrapEmailHint === 'string' ? bootstrapEmailHint.trim().toLowerCase() : null,
      }))
    if (!canAdopt) throw error
    return action()
  }
}
