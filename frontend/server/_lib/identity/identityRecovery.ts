import { classifyLinkedAccounts, type PrivyUserLike } from '../wallet/walletMapping.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type EmailCollisionSource = 'accounts' | 'profiles'

export type IdentityRecoveryRequiredError = Error & {
  code: 'IDENTITY_RECOVERY_REQUIRED'
  requestedPrivyUserId: string
} & (
  | {
      reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER'
      email: string
      existingPrivyUserId: string
      source: EmailCollisionSource
    }
  | {
      reason: 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE'
      /** The EVM address that collided. */
      wallet: string
      /** The canonical account's email. Safe to display — the client shows
       *  "sign in with <email>" so the user knows which account they have. */
      canonicalEmail: string
      canonicalProfileId: number
    }
)

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEmail(value: unknown): string | null {
  const email = normalizeLower(value)
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function isMissingRelationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return lower.includes('does not exist') && lower.includes('relation')
}

function buildEmailCollisionError(params: {
  email: string
  requestedPrivyUserId: string
  existingPrivyUserId: string
  source: EmailCollisionSource
}): IdentityRecoveryRequiredError {
  const error = new Error(
    `Recovery required: email "${params.email}" is already linked to a different Privy account.`,
  ) as IdentityRecoveryRequiredError
  Object.assign(error, {
    code: 'IDENTITY_RECOVERY_REQUIRED',
    reason: 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER',
    email: params.email,
    requestedPrivyUserId: params.requestedPrivyUserId,
    existingPrivyUserId: params.existingPrivyUserId,
    source: params.source,
  })
  return error
}

function buildWalletCollisionError(params: {
  wallet: string
  requestedPrivyUserId: string
  canonicalEmail: string
  canonicalProfileId: number
}): IdentityRecoveryRequiredError {
  const error = new Error(
    `Recovery required: wallet ${params.wallet} is already linked to email "${params.canonicalEmail}". Sign in with email to continue.`,
  ) as IdentityRecoveryRequiredError
  Object.assign(error, {
    code: 'IDENTITY_RECOVERY_REQUIRED',
    reason: 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE',
    wallet: params.wallet,
    requestedPrivyUserId: params.requestedPrivyUserId,
    canonicalEmail: params.canonicalEmail,
    canonicalProfileId: params.canonicalProfileId,
  })
  return error
}

async function readBoundPrivyUserIdFromAccounts(db: Db, email: string): Promise<string | null> {
  try {
    const result = await db.sql`
      SELECT privy_user_id
      FROM accounts
      WHERE LOWER(email) = LOWER(${email})
        AND privy_user_id IS NOT NULL
      LIMIT 1;
    `
    return normalizeLower(result.rows?.[0]?.privy_user_id) || null
  } catch (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }
}

async function readBoundPrivyUserIdFromProfiles(db: Db, email: string): Promise<string | null> {
  try {
    const result = await db.sql`
      SELECT privy_user_id
      FROM profiles
      WHERE LOWER(email) = LOWER(${email})
        AND privy_user_id IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      LIMIT 1;
    `
    return normalizeLower(result.rows?.[0]?.privy_user_id) || null
  } catch (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }
}

export async function assertNoEmailPrivyCollision(params: {
  db: Db
  email: string | null | undefined
  privyUserId: string | null | undefined
}): Promise<void> {
  const email = normalizeEmail(params.email)
  const requestedPrivyUserId = normalizeLower(params.privyUserId)
  if (!email || !requestedPrivyUserId) return

  const boundInAccounts = await readBoundPrivyUserIdFromAccounts(params.db, email)
  if (boundInAccounts && boundInAccounts !== requestedPrivyUserId) {
    throw buildEmailCollisionError({
      email,
      requestedPrivyUserId,
      existingPrivyUserId: boundInAccounts,
      source: 'accounts',
    })
  }

  const boundInProfiles = await readBoundPrivyUserIdFromProfiles(params.db, email)
  if (boundInProfiles && boundInProfiles !== requestedPrivyUserId) {
    throw buildEmailCollisionError({
      email,
      requestedPrivyUserId,
      existingPrivyUserId: boundInProfiles,
      source: 'profiles',
    })
  }
}

/**
 * Block wallet-only Privy sign-ins that would otherwise mint a fragmented
 * profile for a human whose canonical account (verified email) already
 * exists. This is the prevention counterpart to `assertNoEmailPrivyCollision`:
 * that one catches "same email, different Privy user", this one catches
 * "same EOA, no email on incoming, canonical email profile already owns
 * that EOA."
 *
 * Runs even when the incoming Privy user has an email (in which case
 * `assertNoEmailPrivyCollision` does the primary check); for the email-
 * less case this is the ONLY guard against split-identity creation.
 *
 * No-op when:
 *   - the incoming Privy user id is already aliased to the canonical
 *     profile (expected re-auth after a prior merge),
 *   - the incoming Privy user has no EVM wallets (nothing to collide),
 *   - `privy_user_aliases` table does not exist yet (legacy envs — in
 *     that case we can't safely distinguish expected re-auth from
 *     fragmentation, so we err on the side of not blocking).
 */
export async function assertNoWalletPrivyCollision(params: {
  db: Db
  privyUserId: string
  /** Provide exactly one source of EVM addresses: a raw Privy user (we
   *  extract via `classifyLinkedAccounts`), or a pre-computed list. The
   *  pre-computed form lets callers like `walletSync` skip the re-parse. */
  privyUser?: PrivyUserLike
  evmAddresses?: readonly string[]
}): Promise<void> {
  const requestedPrivyUserId = normalizeLower(params.privyUserId)
  if (!requestedPrivyUserId) return

  const sourceAddresses = params.evmAddresses
    ? params.evmAddresses
    : params.privyUser
      ? classifyLinkedAccounts(params.privyUser).allWallets
          .filter((w) => w.chain === 'evm')
          .map((w) => w.address)
      : []
  const evmAddresses = Array.from(
    new Set(
      sourceAddresses
        .map((a) => normalizeLower(a))
        .filter((a) => /^0x[a-f0-9]{40}$/.test(a)),
    ),
  )
  if (evmAddresses.length === 0) return

  // Gate the lookup so legacy envs without `privy_user_aliases` or
  // `profile_wallets` can't throw. If either is missing we skip the check
  // entirely — the cost of a missed collision in a dev/legacy env is
  // strictly lower than blocking live auth on a spurious schema error.
  for (const probe of [
    async () => params.db.sql`SELECT 1 FROM privy_user_aliases LIMIT 1;`,
    async () => params.db.sql`SELECT 1 FROM profile_wallets LIMIT 1;`,
  ]) {
    try {
      await probe()
    } catch (error) {
      if (isMissingRelationError(error)) return
      throw error
    }
  }

  // The set of wallet-address columns we check is: direct columns on
  // `profiles` plus any row in `profile_wallets` linked to that profile.
  // A wallet listed only in `profile_wallets` (e.g. post-merge) must also
  // trigger the guard, otherwise a merged-away wallet could be used to
  // create another fragment.
  // Filter out synthetic placeholder emails — `<addr>@wallet.4626.fun`,
  // `<addr>@noemail.4626.fun`, AMOE's `amoe-*@wallet.4626.fun`, etc. Those
  // rows represent wallet-first pseudo-accounts, not verified canonical
  // identities. A real-email signup for the same human must be allowed
  // to proceed and reconcile later, not be blocked by an unclaimed shell.
  const result = await params.db.sql`
    SELECT p.id, p.email, LOWER(
      COALESCE(
        CASE WHEN LOWER(p.primary_wallet) = ANY(${evmAddresses}) THEN p.primary_wallet END,
        CASE WHEN LOWER(p.embedded_wallet) = ANY(${evmAddresses}) THEN p.embedded_wallet END,
        CASE WHEN LOWER(p.csw_address) = ANY(${evmAddresses}) THEN p.csw_address END,
        (SELECT LOWER(pw.address) FROM profile_wallets pw
          WHERE pw.profile_id = p.id AND LOWER(pw.address) = ANY(${evmAddresses})
          LIMIT 1)
      )
    ) AS matched_wallet
    FROM profiles p
    WHERE p.merged_into_profile_id IS NULL
      AND p.email IS NOT NULL
      AND p.email <> ''
      AND LOWER(p.email) NOT LIKE '%@wallet.4626.fun'
      AND LOWER(p.email) NOT LIKE '%@noemail.4626.fun'
      AND (
        LOWER(p.primary_wallet) = ANY(${evmAddresses})
        OR LOWER(p.embedded_wallet) = ANY(${evmAddresses})
        OR LOWER(p.csw_address) = ANY(${evmAddresses})
        OR EXISTS (
          SELECT 1 FROM profile_wallets pw
          WHERE pw.profile_id = p.id
            AND LOWER(pw.address) = ANY(${evmAddresses})
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM privy_user_aliases a
        WHERE a.profile_id = p.id AND a.privy_user_id = ${requestedPrivyUserId}
      )
    ORDER BY p.id ASC
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return

  const canonicalEmail = normalizeEmail(row.email)
  const canonicalProfileId = Number(row.id)
  const matchedWallet = typeof row.matched_wallet === 'string' ? row.matched_wallet : evmAddresses[0]
  if (!canonicalEmail || !Number.isInteger(canonicalProfileId) || canonicalProfileId <= 0) return

  throw buildWalletCollisionError({
    wallet: matchedWallet ?? '',
    requestedPrivyUserId,
    canonicalEmail,
    canonicalProfileId,
  })
}

export function isIdentityRecoveryRequiredError(error: unknown): error is IdentityRecoveryRequiredError {
  if (!error || typeof error !== 'object') return false
  if ((error as { code?: unknown }).code !== 'IDENTITY_RECOVERY_REQUIRED') return false
  const reason = (error as { reason?: unknown }).reason
  return (
    reason === 'EMAIL_BOUND_TO_DIFFERENT_PRIVY_USER' ||
    reason === 'WALLET_BOUND_TO_CANONICAL_EMAIL_PROFILE'
  )
}
