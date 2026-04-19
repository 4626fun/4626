import { upsertLinkedMethod } from './accountsIdentity.js'
import { type IdentityRecoveryRequiredError, isIdentityRecoveryRequiredError } from './identityRecovery.js'
import { classifyLinkedAccounts, type PrivyUserLike } from '../wallet/walletMapping.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function adoptOwnedEmailCollision(params: {
  db: Db
  collision: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
  privyUser: PrivyUserLike
}): Promise<boolean> {
  const { collision, db, email, privyUserId, privyUser } = params
  // Wallet-collision recovery is intentionally not auto-adopted here — the
  // product surface for that case is "sign in with email," not a silent
  // wallet re-bind. Narrow to the email-bound variant only.
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

  const updatedProfile = await db.sql`
    UPDATE profiles
    SET privy_user_id = ${privyUserId}, updated_at = NOW()
    WHERE id = ${profileId}
      AND LOWER(COALESCE(privy_user_id, '')) = ${existingPrivyUserId}
    RETURNING id;
  `
  if (!updatedProfile?.rows?.length) return false

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

function isMatchingEmailCollision(params: {
  error: IdentityRecoveryRequiredError
  email: string
  privyUserId: string
}): boolean {
  // Only the email-bound variant exposes `email` — wallet collisions are
  // routed through a different recovery UX and must not be adopted here.
  if (params.error.reason !== 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER') return false
  const errorEmail = normalizeLower(params.error.email)
  const requestedPrivyUserId = normalizeLower(params.error.requestedPrivyUserId)
  const currentPrivyUserId = normalizeLower(params.privyUserId)
  return Boolean(errorEmail) && errorEmail === params.email && requestedPrivyUserId === currentPrivyUserId
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
      (await adoptOwnedEmailCollision({
        db,
        collision: error,
        email: normalizedEmail,
        privyUserId,
        privyUser,
      }))
    if (!canAdopt) throw error
    return action()
  }
}
