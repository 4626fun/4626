import { createHash } from 'node:crypto'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

/** How an AMOE `points.signup_id` was resolved for a wallet. */
export type AmoePointsProfileKind = 'verified_privy' | 'linked' | 'synthetic'

/**
 * - `verified_privy_only` — Privy account with verified, non-synthetic email.
 *   Used for Twitter daily awards and credit snapshots. No synthetic fallback.
 * - `privy_linked` — Any Privy-backed profile linked via `profile_wallets`.
 *   Used for the waitlist `amoe_checkin` bridge. No synthetic fallback.
 * - `lottery_ledger` — Prefer any linked profile (tombstone-aware, real email first);
 *   otherwise create `amoe-*@wallet.4626.fun` for anonymous lottery bookkeeping.
 */
export type AmoePointsProfilePolicy = 'verified_privy_only' | 'privy_linked' | 'lottery_ledger'

export type ResolveAmoePointsProfileResult = {
  signupId: number
  kind: AmoePointsProfileKind
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function isSyntheticEmail(email: unknown): boolean {
  const normalized = String(email ?? '').trim().toLowerCase()
  return normalized.endsWith('@wallet.4626.fun') || normalized.endsWith('@noemail.4626.fun')
}

function toPositiveInt(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(id) || id <= 0) return null
  return Math.floor(id)
}

/** Normalize and validate an EVM address used in AMOE flows. */
export function normalizeAmoeWallet(wallet: string): `0x${string}` {
  const normalized = wallet.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error('invalid_wallet')
  }
  return normalized as `0x${string}`
}

async function findVerifiedPrivyProfileId(db: Db, wallet: `0x${string}`): Promise<number | null> {
  const result = await db.sql`
    SELECT pw.profile_id
    FROM profile_wallets pw
    JOIN profiles p ON p.id = pw.profile_id
    JOIN accounts a ON a.privy_user_id = p.privy_user_id
    WHERE LOWER(pw.address) = ${wallet}
      AND p.privy_user_id IS NOT NULL
      AND p.merged_into_profile_id IS NULL
      AND a.email_verified = TRUE
      AND NOT (
        LOWER(COALESCE(a.email, '')) LIKE '%@wallet.4626.fun'
        OR LOWER(COALESCE(a.email, '')) LIKE '%@noemail.4626.fun'
      )
    ORDER BY
      pw.is_canonical_smart_wallet DESC NULLS LAST,
      pw.is_primary DESC NULLS LAST,
      pw.profile_id ASC
    LIMIT 1;
  `
  return toPositiveInt(result.rows?.[0]?.profile_id)
}

async function findPrivyLinkedProfileId(db: Db, wallet: `0x${string}`): Promise<number | null> {
  const result = await db.sql`
    SELECT pw.profile_id
    FROM profile_wallets pw
    JOIN profiles p ON p.id = pw.profile_id
    WHERE LOWER(pw.address) = ${wallet}
      AND p.privy_user_id IS NOT NULL
      AND p.merged_into_profile_id IS NULL
    ORDER BY
      pw.is_canonical_smart_wallet DESC NULLS LAST,
      pw.is_primary DESC NULLS LAST,
      pw.profile_id ASC
    LIMIT 1;
  `
  return toPositiveInt(result.rows?.[0]?.profile_id)
}

/**
 * Tombstone-aware wallet → profile match across profile columns and
 * `profile_wallets`. Prefers a survivor with a real (non-synthetic) email.
 */
async function findLinkedProfileId(db: Db, wallet: `0x${string}`): Promise<number | null> {
  const result = await db.sql`
    WITH matched AS (
      SELECT p.id, p.merged_into_profile_id, p.email, p.privy_user_id, p.updated_at, p.created_at
      FROM profiles p
      WHERE LOWER(p.primary_wallet) = ${wallet}
         OR LOWER(p.embedded_wallet) = ${wallet}
         OR LOWER(p.primary_embedded_eoa) = ${wallet}
         OR LOWER(p.csw_address) = ${wallet}
         OR LOWER(p.primary_smart_wallet) = ${wallet}
         OR LOWER(p.base_sub_account) = ${wallet}
         OR EXISTS (
           SELECT 1
           FROM profile_wallets pw
           WHERE pw.profile_id = p.id
             AND LOWER(pw.address) = ${wallet}
         )
    ),
    resolved AS (
      SELECT
        p2.id,
        p2.email,
        p2.privy_user_id,
        CASE
          WHEN p2.email IS NOT NULL
            AND TRIM(p2.email) <> ''
            AND LOWER(p2.email) NOT LIKE '%@wallet.4626.fun'
            AND LOWER(p2.email) NOT LIKE '%@noemail.4626.fun'
          THEN 0
          ELSE 1
        END AS bucket,
        COALESCE(p2.updated_at, p2.created_at) AS ranked_at
      FROM matched m
      JOIN profiles p2 ON p2.id = COALESCE(m.merged_into_profile_id, m.id)
      WHERE p2.merged_into_profile_id IS NULL
    )
    SELECT id, email, privy_user_id
    FROM (
      SELECT DISTINCT id, email, privy_user_id, bucket, ranked_at
      FROM resolved
    ) deduped
    ORDER BY bucket ASC, ranked_at DESC NULLS LAST
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return toPositiveInt(row?.id)
}

async function createSyntheticAmoeProfile(db: Db, wallet: `0x${string}`): Promise<number> {
  const syntheticEmail = `amoe-${sha256Hex(wallet).slice(0, 24)}@wallet.4626.fun`
  await db.sql`
    INSERT INTO profiles (email, primary_wallet, created_at, updated_at)
    VALUES (${syntheticEmail}, ${wallet}, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE
      SET primary_wallet = COALESCE(profiles.primary_wallet, EXCLUDED.primary_wallet),
          updated_at = NOW();
  `
  const created = await db.sql`
    SELECT id
    FROM profiles
    WHERE email = ${syntheticEmail}
    LIMIT 1;
  `
  const createdId = toPositiveInt(created.rows?.[0]?.id)
  if (createdId === null) {
    throw new Error('amoe_profile_resolve_failed')
  }
  return createdId
}

async function classifyLinkedProfile(
  db: Db,
  signupId: number,
): Promise<'verified_privy' | 'linked'> {
  const row = await db.sql`
    SELECT p.email, p.privy_user_id, a.email_verified
    FROM profiles p
    LEFT JOIN accounts a ON a.privy_user_id = p.privy_user_id
    WHERE p.id = ${signupId}
    LIMIT 1;
  `
  const email = row.rows?.[0]?.email
  const privyUserId = row.rows?.[0]?.privy_user_id
  const emailVerified = row.rows?.[0]?.email_verified === true
  if (
    privyUserId &&
    emailVerified &&
    !isSyntheticEmail(email)
  ) {
    return 'verified_privy'
  }
  return 'linked'
}

/**
 * Resolve which `profiles.id` should own AMOE `points` rows for `wallet`.
 * All AMOE award/spend paths must go through this helper.
 */
export async function resolveAmoePointsProfile(
  db: Db,
  walletInput: string,
  policy: AmoePointsProfilePolicy,
): Promise<ResolveAmoePointsProfileResult | null> {
  const wallet = normalizeAmoeWallet(walletInput)

  if (policy === 'verified_privy_only') {
    const signupId = await findVerifiedPrivyProfileId(db, wallet)
    return signupId === null ? null : { signupId, kind: 'verified_privy' }
  }

  if (policy === 'privy_linked') {
    const signupId = await findPrivyLinkedProfileId(db, wallet)
    if (signupId === null) return null
    const kind = await classifyLinkedProfile(db, signupId)
    return { signupId, kind }
  }

  const linkedId = await findLinkedProfileId(db, wallet)
  if (linkedId !== null) {
    const kind = await classifyLinkedProfile(db, linkedId)
    return { signupId: linkedId, kind }
  }

  const signupId = await createSyntheticAmoeProfile(db, wallet)
  return { signupId, kind: 'synthetic' }
}

/** Convenience when callers only need `profiles.id`. */
export async function resolveAmoePointsProfileId(
  db: Db,
  walletInput: string,
  policy: AmoePointsProfilePolicy,
): Promise<number | null> {
  const resolved = await resolveAmoePointsProfile(db, walletInput, policy)
  return resolved?.signupId ?? null
}
