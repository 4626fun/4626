/**
 * Profile merge primitive.
 *
 * Folds one `profiles` row ("from") into another ("to") so a single human
 * whose identity fragmented across multiple Privy users ends up under one
 * canonical profile (per `AGENTS.md` → "Account and auth invariants":
 * verified email is the canonical 4626 identity).
 *
 * Append-only where possible, idempotent at every step:

import { ensureMigrationApplied } from './schemaBootstrap.js'
 *
 *   1. Validate: `to` has verified email, neither side is already merged,
 *      `from.id !== to.id`.
 *   2. Write `privy_user_aliases(from.privy_user_id → to.id, source='merge')`
 *      — future auth calls with either Privy user id resolve to `to`.
 *   3. Copy `from.primary_wallet` / `embedded_wallet` into `profile_wallets`
 *      as linked wallets on `to` (ON CONFLICT DO NOTHING).
 *   4. Propagate `from.csw_address` to `to` only when `to.csw_address IS NULL`
 *      — never overwrite an existing canonical CSW (ERC-4337 invariant).
 *   5. Move `points` rows: `INSERT ... SELECT` into `to` (ON CONFLICT DO
 *      NOTHING to preserve `to`'s existing rows), then `DELETE FROM points`
 *      for `from` so scoring queries aren't double-counted if something
 *      still consults `from.id` directly.
 *   6. Repoint `referral_conversions.referrer_signup_id` and
 *      `.referee_signup_id` from `from` → `to`.
 *   7. Repoint any `profiles.referred_by_signup_id` currently pointing at
 *      `from` to `to` instead.
 *   8. Copy `from.referral_code` to `to` only if `to.referral_code IS NULL`.
 *   9. Null `from.privy_user_id` (frees the unique-index slot) and set
 *      `from.merged_into_profile_id = to.id`.
 *
 * This module performs no admin-auth checks — callers (the admin HTTP
 * handler or the CLI) are responsible for that.
 */

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let profileMergeSchemaEnsured = false

/** Idempotent schema bootstrap. Matches the pattern used by
 *  `ensureWaitlistSchema` / `ensureAccountsIdentitySchema` elsewhere in this
 *  module family — the migration file at
 *  `supabase/migrations/20260419200000_profile_merge_infra.sql` is the
 *  source of truth; this helper exists so cold starts (and the CLI) can
 *  run without a separate migration step. */
export async function ensureProfileMergeSchema(db: Db): Promise<void> {
  if (profileMergeSchemaEnsured) return
  // The authoritative DDL lives in supabase/migrations/20260419200000_profile_merge_infra.sql
  await ensureMigrationApplied(db as any, '20260419200000_profile_merge_infra.sql').catch(() => {})
  // Seed is data, not DDL — keep it here as a safe, idempotent cold-start backfill.
  try {
    await db.sql`
      INSERT INTO privy_user_aliases (privy_user_id, profile_id, source)
      SELECT privy_user_id, id, 'signup'
      FROM profiles
      WHERE privy_user_id IS NOT NULL
        AND privy_user_id <> ''
        AND merged_into_profile_id IS NULL
      ON CONFLICT (privy_user_id) DO NOTHING;
    `
  } catch {
    // best effort
  }
  profileMergeSchemaEnsured = true
}

export type ProfileRow = {
  id: number
  email: string | null
  privyUserId: string | null
  primaryWallet: string | null
  embeddedWallet: string | null
  cswAddress: string | null
  referralCode: string | null
  mergedIntoProfileId: number | null
}

export type ProfileMergePlan = {
  from: ProfileRow
  to: ProfileRow
  /** Rows in `points` that would be re-keyed from `from` → `to`. */
  pointsRowsToMove: number
  /** Matching rows that already exist on `to` and would be dropped from
   *  `from` (no-op writes, safe to delete). */
  pointsRowsSkippedAsDuplicate: number
  /** `referral_conversions` rows that reference `from` in either position. */
  referralConversionsToRepoint: number
  /** Other profiles whose `referred_by_signup_id` points at `from`. */
  refereesToRepoint: number
}

export type ProfileMergeResult = {
  aliasInserted: boolean
  walletsLinked: number
  /** Rows swept from `profile_wallets` on `from` onto `to`. Distinct from
   *  `walletsLinked` which copies the single `primary_wallet`/`embedded_wallet`
   *  columns. This sweep catches every wallet row previously attached to
   *  `from` (via the many-to-many `profile_wallets` table) so a tombstone
   *  is never left with dangling wallet rows that a later lookup could
   *  resurrect. See `AGENTS.md` → "Profile merge moves arch-b tables too". */
  walletRowsSwept: number
  pointsMoved: number
  pointsDroppedAsDuplicate: number
  referralConversionsRepointed: number
  refereesRepointed: number
  referralCodeCopied: boolean
  cswPropagated: boolean
  fromTombstoned: boolean
}

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

function normString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function loadProfile(db: Db, id: number): Promise<ProfileRow | null> {
  const result = await db.sql`
    SELECT id, email, privy_user_id, primary_wallet, embedded_wallet,
           csw_address, referral_code, merged_into_profile_id
    FROM profiles
    WHERE id = ${id}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  if (!row) return null
  return {
    id: toInt(row.id) ?? 0,
    email: normString(row.email)?.toLowerCase() ?? null,
    privyUserId: normString(row.privy_user_id),
    primaryWallet: normString(row.primary_wallet)?.toLowerCase() ?? null,
    embeddedWallet: normString(row.embedded_wallet)?.toLowerCase() ?? null,
    cswAddress: normString(row.csw_address)?.toLowerCase() ?? null,
    referralCode: normString(row.referral_code),
    mergedIntoProfileId: toInt(row.merged_into_profile_id),
  }
}

export class ProfileMergeValidationError extends Error {
  constructor(public readonly code: string, detail: string) {
    // Include the code in the message so log lines and thrown errors both
    // surface it without needing to inspect the typed field.
    super(`${code}: ${detail}`)
    this.name = 'ProfileMergeValidationError'
  }
}

function validateMerge(from: ProfileRow | null, to: ProfileRow | null): { from: ProfileRow; to: ProfileRow } {
  if (!from) throw new ProfileMergeValidationError('from_not_found', 'From profile not found')
  if (!to) throw new ProfileMergeValidationError('to_not_found', 'To profile not found')
  if (from.id === to.id) {
    throw new ProfileMergeValidationError('same_profile', 'From and to are the same profile')
  }
  if (from.mergedIntoProfileId !== null) {
    throw new ProfileMergeValidationError('from_already_merged', `From profile ${from.id} is already tombstoned`)
  }
  if (to.mergedIntoProfileId !== null) {
    throw new ProfileMergeValidationError('to_already_merged', `To profile ${to.id} is already tombstoned`)
  }
  // Per the invariant, the canonical side must have a verified email.
  if (!to.email) {
    throw new ProfileMergeValidationError('to_email_required', 'To profile must have a verified email (canonical 4626 identity)')
  }
  return { from, to }
}

export async function planProfileMerge(
  db: Db,
  fromProfileId: number,
  toProfileId: number,
): Promise<ProfileMergePlan> {
  await ensureProfileMergeSchema(db)
  const { from, to } = validateMerge(
    await loadProfile(db, fromProfileId),
    await loadProfile(db, toProfileId),
  )

  // Count rows that would move. Uses NOT EXISTS so the count is honest
  // about what's already on `to`.
  const pointsToMoveResult = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM points p
    WHERE p.signup_id = ${from.id}
      AND NOT EXISTS (
        SELECT 1 FROM points pt
        WHERE pt.signup_id = ${to.id}
          AND pt.source = p.source
          AND pt.source_id IS NOT DISTINCT FROM p.source_id
      );
  `
  const pointsDuplicateResult = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM points p
    WHERE p.signup_id = ${from.id}
      AND EXISTS (
        SELECT 1 FROM points pt
        WHERE pt.signup_id = ${to.id}
          AND pt.source = p.source
          AND pt.source_id IS NOT DISTINCT FROM p.source_id
      );
  `
  const referralConvResult = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM referral_conversions
    WHERE referrer_signup_id = ${from.id} OR invitee_signup_id = ${from.id};
  `
  const refereesResult = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM profiles
    WHERE referred_by_signup_id = ${from.id};
  `

  return {
    from,
    to,
    pointsRowsToMove: Number(pointsToMoveResult.rows?.[0]?.c ?? 0),
    pointsRowsSkippedAsDuplicate: Number(pointsDuplicateResult.rows?.[0]?.c ?? 0),
    referralConversionsToRepoint: Number(referralConvResult.rows?.[0]?.c ?? 0),
    refereesToRepoint: Number(refereesResult.rows?.[0]?.c ?? 0),
  }
}

export async function executeProfileMerge(
  db: Db,
  plan: ProfileMergePlan,
): Promise<ProfileMergeResult> {
  const { from, to } = plan

  // Re-validate at execute time (guards against TOCTOU since planning and
  // executing aren't wrapped in a single transaction across the Db adapter).
  validateMerge(
    await loadProfile(db, from.id),
    await loadProfile(db, to.id),
  )

  // 1. Alias: Privy user id from `from` → canonical profile `to`. Uses
  // UPSERT because `ensureProfileMergeSchema` seeds an alias per existing
  // `profiles.privy_user_id` pointing at that profile — which for `from`
  // is the row we're merging away. Re-point it to `to` so future auth
  // resolves correctly.
  let aliasInserted = false
  if (from.privyUserId) {
    const res = await db.sql`
      INSERT INTO privy_user_aliases (privy_user_id, profile_id, source, created_at)
      VALUES (${from.privyUserId}, ${to.id}, 'merge', NOW())
      ON CONFLICT (privy_user_id) DO UPDATE
        SET profile_id = EXCLUDED.profile_id,
            source = 'merge',
            created_at = NOW()
      RETURNING privy_user_id;
    `
    aliasInserted = Array.isArray(res.rows) && res.rows.length > 0
  }

  // 2. Propagate canonical CSW only if `to` doesn't already have one.
  let cswPropagated = false
  if (from.cswAddress && !to.cswAddress) {
    const res = await db.sql`
      UPDATE profiles
      SET csw_address = ${from.cswAddress}, updated_at = NOW()
      WHERE id = ${to.id} AND csw_address IS NULL
      RETURNING id;
    `
    cswPropagated = Array.isArray(res.rows) && res.rows.length > 0
  }

  // 3. Link wallets from `from` onto `to`. Uses `profile_wallets` as the
  // many-to-many table. Only links EVM addresses; skip anything malformed.
  let walletsLinked = 0
  for (const candidate of [from.primaryWallet, from.embeddedWallet]) {
    if (!candidate || !/^0x[a-f0-9]{40}$/.test(candidate)) continue
    try {
      const res = await db.sql`
        INSERT INTO profile_wallets (profile_id, address, is_primary, is_canonical_smart_wallet, source, created_at)
        VALUES (${to.id}, ${candidate}, FALSE, FALSE, 'merge', NOW())
        ON CONFLICT DO NOTHING
        RETURNING profile_id;
      `
      if (Array.isArray(res.rows) && res.rows.length > 0) walletsLinked += 1
    } catch {
      // profile_wallets schema may vary across envs; ignore column mismatches
    }
  }

  // 3b. Sweep every `profile_wallets` row currently attached to `from` onto
  // `to`, then delete the originals. This preserves wallets that landed on
  // `from` after the merge infrastructure first linked it (step 3 above only
  // covers the single primary/embedded columns on the `profiles` row).
  //
  // Role flags are forced FALSE on the sweep because `to` enforces partial
  // unique indexes (`profile_wallets_one_canonical`, `_one_embedded_eoa`,
  // `_one_primary`, etc.) that must not be displaced by a tombstone's
  // secondary attachments. The canonical wallet on `to` is authoritative.
  let walletRowsSwept = 0
  try {
    const sweptRes = await db.sql`
      INSERT INTO profile_wallets (
        profile_id, address,
        is_primary, is_canonical_smart_wallet, is_embedded_eoa,
        is_canonical_solana_wallet, is_operational_solana_wallet,
        verified_at, metadata, created_at, updated_at,
        chain_id, canonical_csw_address, canonical_source,
        privy_embedded_eoa_address, privy_is_owner, last_checked_at,
        canonical_zora_csw_address
      )
      SELECT
        ${to.id}, address,
        FALSE, FALSE, FALSE, FALSE, FALSE,
        verified_at,
        COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object(
               'salvagedFromTombstoneId', profile_id,
               'salvagedAt', NOW()::text
             ),
        created_at, NOW(),
        chain_id, canonical_csw_address, canonical_source,
        privy_embedded_eoa_address, privy_is_owner, last_checked_at,
        canonical_zora_csw_address
      FROM profile_wallets
      WHERE profile_id = ${from.id}
      ON CONFLICT (profile_id, address) DO NOTHING
      RETURNING profile_id;
    `
    walletRowsSwept = Array.isArray(sweptRes.rows) ? sweptRes.rows.length : 0
    await db.sql`DELETE FROM profile_wallets WHERE profile_id = ${from.id};`
  } catch {
    // profile_wallets schema may vary across envs; ignore column mismatches
    // (mirrors the step-3 try/catch rationale).
  }

  // 4. Copy `from`'s novel points rows onto `to`, drop duplicates.
  const movedRes = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    SELECT ${to.id}, p.source, p.source_id, p.amount, p.created_at
    FROM points p
    WHERE p.signup_id = ${from.id}
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  const pointsMoved = Array.isArray(movedRes.rows) ? movedRes.rows.length : 0
  // Count duplicates BEFORE the DELETE so the result is accurate.
  const dupRes = await db.sql`
    SELECT COUNT(*)::int AS c
    FROM points p
    WHERE p.signup_id = ${from.id}
      AND EXISTS (
        SELECT 1 FROM points pt
        WHERE pt.signup_id = ${to.id}
          AND pt.source = p.source
          AND pt.source_id IS NOT DISTINCT FROM p.source_id
      );
  `
  const pointsDroppedAsDuplicate = Number(dupRes.rows?.[0]?.c ?? 0)
  await db.sql`DELETE FROM points WHERE signup_id = ${from.id};`

  // 5. Repoint referral_conversions both sides.
  let referralConversionsRepointed = 0
  try {
    const r1 = await db.sql`
      UPDATE referral_conversions
      SET referrer_signup_id = ${to.id}
      WHERE referrer_signup_id = ${from.id}
      RETURNING id;
    `
    referralConversionsRepointed += Array.isArray(r1.rows) ? r1.rows.length : 0
    const r2 = await db.sql`
      UPDATE referral_conversions
      SET invitee_signup_id = ${to.id}
      WHERE invitee_signup_id = ${from.id}
      RETURNING id;
    `
    referralConversionsRepointed += Array.isArray(r2.rows) ? r2.rows.length : 0
  } catch {
    // table may not exist in some envs
  }

  // 6. Repoint any referees whose referred_by points at `from`.
  const refereesRes = await db.sql`
    UPDATE profiles
    SET referred_by_signup_id = ${to.id}, updated_at = NOW()
    WHERE referred_by_signup_id = ${from.id}
    RETURNING id;
  `
  const refereesRepointed = Array.isArray(refereesRes.rows) ? refereesRes.rows.length : 0

  // 7a. Arch-B execution context. Only one row per profile (UNIQUE on
  //     profile_id); if `to` already has one we prefer its config and
  //     drop `from`'s. If `to` doesn't, we re-key `from`'s onto `to`.
  try {
    const existingOnTo = await db.sql`
      SELECT 1 FROM command_issuer_execution_context WHERE profile_id = ${to.id} LIMIT 1;
    `
    if (existingOnTo.rows?.length) {
      await db.sql`DELETE FROM command_issuer_execution_context WHERE profile_id = ${from.id};`
    } else {
      await db.sql`
        UPDATE command_issuer_execution_context
        SET profile_id = ${to.id}, updated_at = NOW()
        WHERE profile_id = ${from.id};
      `
    }
  } catch {
    // Table may not exist in some envs (legacy). Ignore.
  }

  // 7b. Arch-B daily spend ledger. Compound PK (profile_id, ymd); if both
  //     sides have a row for the same day we sum them onto `to`.
  try {
    await db.sql`
      INSERT INTO command_issuer_daily_spend (profile_id, ymd, spent_wei, updated_at)
      SELECT ${to.id}, ymd, spent_wei, NOW()
      FROM command_issuer_daily_spend
      WHERE profile_id = ${from.id}
      ON CONFLICT (profile_id, ymd) DO UPDATE
        SET spent_wei = command_issuer_daily_spend.spent_wei + EXCLUDED.spent_wei,
            updated_at = NOW();
    `
    await db.sql`DELETE FROM command_issuer_daily_spend WHERE profile_id = ${from.id};`
  } catch {
    // Table may not exist in some envs.
  }

  // 7c. Adopt `from`'s referral code if `to` doesn't have one.
  let referralCodeCopied = false
  if (from.referralCode && !to.referralCode) {
    try {
      const res = await db.sql`
        UPDATE profiles
        SET referral_code = ${from.referralCode}, updated_at = NOW()
        WHERE id = ${to.id} AND referral_code IS NULL
        RETURNING id;
      `
      referralCodeCopied = Array.isArray(res.rows) && res.rows.length > 0
      if (referralCodeCopied) {
        // Free the referral_code on `from` so the unique index stays sane
        // even if we later re-merge or untombstone.
        await db.sql`
          UPDATE profiles
          SET referral_code = NULL, updated_at = NOW()
          WHERE id = ${from.id};
        `
      }
    } catch {
      // unique collision: leave both codes as-is, the rare edge case is
      // preferable to rolling back the whole merge.
    }
  }

  // 8. Tombstone `from`: null its privy_user_id (freeing the unique index)
  //    and point it at the canonical survivor.
  const tombstoneRes = await db.sql`
    UPDATE profiles
    SET privy_user_id = NULL,
        merged_into_profile_id = ${to.id},
        updated_at = NOW()
    WHERE id = ${from.id} AND merged_into_profile_id IS NULL
    RETURNING id;
  `
  const fromTombstoned = Array.isArray(tombstoneRes.rows) && tombstoneRes.rows.length > 0

  return {
    aliasInserted,
    walletsLinked,
    walletRowsSwept,
    pointsMoved,
    pointsDroppedAsDuplicate,
    referralConversionsRepointed,
    refereesRepointed,
    referralCodeCopied,
    cswPropagated,
    fromTombstoned,
  }
}
