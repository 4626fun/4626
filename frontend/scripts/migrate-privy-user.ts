#!/usr/bin/env node

import { PrivyClient } from '@privy-io/server-auth'

import { getDb } from '../server/_lib/db/postgres.ts'
import { ensureWaitlistSchema } from '../server/_lib/onboarding/waitlistSchema.ts'
import { syncUserWallets, type SyncUserWalletsResult } from '../server/_lib/wallet/walletSync.ts'
import type { PrivyUserLike } from '../server/_lib/wallet/walletMapping.ts'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
}

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type ProfileRow = {
  id: number
  email: string | null
  privy_user_id: string | null
  primary_wallet: string | null
  embedded_wallet: string | null
  primary_embedded_eoa: string | null
  primary_smart_wallet: string | null
  csw_address: string | null
  base_sub_account: string | null
}

type WalletRoleSummary = {
  totalWalletRows: number
  primaryRows: number
  canonicalSmartWalletRows: number
  embeddedEoaRows: number
}

function usage(): void {
  console.log(`Usage:
  pnpm -C frontend privy:user:migrate -- --old-privy-user-id <did> --new-privy-user-id <did> [options]
  pnpm -C frontend exec tsx scripts/migrate-privy-user.ts --old-privy-user-id <did> --new-privy-user-id <did> [options]

Options:
  --old-privy-user-id <did>   Source Privy user id (ex: did:privy:cmk...)
  --new-privy-user-id <did>   Destination Privy user id
  --profile-id <id>           Optional explicit profile id guard
  --stale-wallet <0x...>      Optional wallet address to remove from profile_wallets
  --allow-canonical-replacement
                              Allow replacing existing canonical CSW with current Privy-derived canonical
  --skip-sync                 Skip Privy fetch + syncUserWallets after remap
  --apply                     Apply mutations (default is dry-run)
  --dry-run                   Force dry-run mode
  --help                      Show this help

Environment fallbacks:
  OLD_PRIVY_USER_ID, NEW_PRIVY_USER_ID
  PRIVY_APP_ID, PRIVY_APP_SECRET (required unless --skip-sync)
`)
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function normalizePrivyUserId(value: string): string {
  const out = String(value || '').trim()
  return out
}

function normalizeAddress(value: string): string | null {
  const out = String(value || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(out)) return null
  return out
}

function normalizeNullableString(value: unknown): string | null {
  const out = typeof value === 'string' ? value.trim() : ''
  return out.length > 0 ? out : null
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.trunc(parsed)
}

function assertValidPrivyUserId(name: string, value: string): void {
  if (!value) throw new Error(`${name} is required`)
  if (!value.startsWith('did:privy:')) {
    throw new Error(`${name} must start with "did:privy:"`)
  }
}

function assertValidProfileId(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --profile-id: ${value}`)
  return Math.trunc(n)
}

async function getProfileByPrivyUserId(db: Db, privyUserId: string): Promise<ProfileRow[]> {
  const result = await db.sql`
    SELECT
      id,
      email,
      privy_user_id,
      primary_wallet,
      embedded_wallet,
      primary_embedded_eoa,
      primary_smart_wallet,
      csw_address,
      base_sub_account
    FROM profiles
    WHERE privy_user_id = ${privyUserId}
    ORDER BY id ASC;
  `
  return (result.rows ?? []).map((row) => ({
    id: toInt(row.id),
    email: normalizeNullableString(row.email),
    privy_user_id: normalizeNullableString(row.privy_user_id),
    primary_wallet: normalizeNullableString(row.primary_wallet),
    embedded_wallet: normalizeNullableString(row.embedded_wallet),
    primary_embedded_eoa: normalizeNullableString(row.primary_embedded_eoa),
    primary_smart_wallet: normalizeNullableString(row.primary_smart_wallet),
    csw_address: normalizeNullableString(row.csw_address),
    base_sub_account: normalizeNullableString(row.base_sub_account),
  }))
}

async function getWalletRoleSummary(db: Db, profileId: number): Promise<WalletRoleSummary> {
  const result = await db.sql`
    SELECT
      COUNT(*)::bigint AS total_wallet_rows,
      COALESCE(SUM(CASE WHEN is_primary THEN 1 ELSE 0 END), 0)::bigint AS primary_rows,
      COALESCE(SUM(CASE WHEN is_canonical_smart_wallet THEN 1 ELSE 0 END), 0)::bigint AS canonical_smart_wallet_rows,
      COALESCE(SUM(CASE WHEN is_embedded_eoa THEN 1 ELSE 0 END), 0)::bigint AS embedded_eoa_rows
    FROM profile_wallets
    WHERE profile_id = ${profileId};
  `
  const row = (result.rows ?? [])[0] ?? {}
  return {
    totalWalletRows: toInt(row.total_wallet_rows, 0),
    primaryRows: toInt(row.primary_rows, 0),
    canonicalSmartWalletRows: toInt(row.canonical_smart_wallet_rows, 0),
    embeddedEoaRows: toInt(row.embedded_eoa_rows, 0),
  }
}

async function getCanonicalSmartWalletRole(db: Db, profileId: number): Promise<string | null> {
  const result = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profileId}
      AND is_canonical_smart_wallet = true
    LIMIT 1;
  `
  const address = normalizeAddress(result.rows?.[0]?.address)
  return address
}

async function enforceCanonicalSmartWallet(db: Db, profileId: number, canonicalAddress: string): Promise<void> {
  const canonical = normalizeAddress(canonicalAddress)
  if (!canonical) return

  await db.sql`
    INSERT INTO wallets (address, chain, wallet_type, provider)
    VALUES (${canonical}, ${'evm'}, ${'smart_wallet'}, ${'unknown'})
    ON CONFLICT (address) DO UPDATE
    SET
      chain = COALESCE(EXCLUDED.chain, wallets.chain),
      wallet_type = COALESCE(EXCLUDED.wallet_type, wallets.wallet_type),
      provider = CASE
        WHEN wallets.provider = ${'unknown'} THEN EXCLUDED.provider
        ELSE wallets.provider
      END;
  `

  await db.sql`
    UPDATE profile_wallets
    SET
      is_canonical_smart_wallet = false,
      updated_at = NOW()
    WHERE profile_id = ${profileId};
  `

  await db.sql`
    INSERT INTO profile_wallets (
      profile_id,
      address,
      is_primary,
      is_canonical_smart_wallet,
      is_embedded_eoa,
      verified_at,
      updated_at
    )
    VALUES (${profileId}, ${canonical}, false, true, false, NOW(), NOW())
    ON CONFLICT (profile_id, address) DO UPDATE
    SET
      is_canonical_smart_wallet = true,
      verified_at = NOW(),
      updated_at = NOW();
  `

  await db.sql`
    UPDATE profiles
    SET
      primary_smart_wallet = ${canonical},
      csw_address = ${canonical},
      base_sub_account = ${canonical},
      updated_at = NOW()
    WHERE id = ${profileId};
  `
}

async function resolvePrivyUserForSync(newPrivyUserId: string): Promise<PrivyUserLike> {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Missing PRIVY_APP_ID / PRIVY_APP_SECRET (or use --skip-sync).')
  }
  const client = new PrivyClient(appId, appSecret)
  const user = await client.getUserById(newPrivyUserId)
  return user as unknown as PrivyUserLike
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const oldPrivyUserId = normalizePrivyUserId(
    getArg('--old-privy-user-id', String(process.env.OLD_PRIVY_USER_ID ?? '')),
  )
  const newPrivyUserId = normalizePrivyUserId(
    getArg('--new-privy-user-id', String(process.env.NEW_PRIVY_USER_ID ?? '')),
  )
  const profileIdGuard = assertValidProfileId(getArg('--profile-id', ''))
  const staleWallet = normalizeAddress(getArg('--stale-wallet', ''))
  const allowCanonicalReplacement = hasFlag('--allow-canonical-replacement')
  const apply = hasFlag('--apply')
  const dryRun = hasFlag('--dry-run') || !apply
  const skipSync = hasFlag('--skip-sync')

  assertValidPrivyUserId('--old-privy-user-id', oldPrivyUserId)
  assertValidPrivyUserId('--new-privy-user-id', newPrivyUserId)

  if (oldPrivyUserId === newPrivyUserId) {
    throw new Error('Old/new Privy user ids are identical; nothing to migrate.')
  }

  const db = (await getDb()) as Db | null
  if (!db) throw new Error('Database is not configured.')
  await ensureWaitlistSchema(db)

  const oldProfiles = await getProfileByPrivyUserId(db, oldPrivyUserId)
  const newProfiles = await getProfileByPrivyUserId(db, newPrivyUserId)

  if (oldProfiles.length > 1) {
    throw new Error(
      `Found ${oldProfiles.length} profiles with old Privy user id. Resolve duplicates before migration: ${oldProfiles.map((p) => p.id).join(', ')}`,
    )
  }
  if (newProfiles.length > 1) {
    throw new Error(
      `Found ${newProfiles.length} profiles with new Privy user id. Resolve duplicates before migration: ${newProfiles.map((p) => p.id).join(', ')}`,
    )
  }

  if (oldProfiles.length === 0 && newProfiles.length === 1) {
    console.log(
      JSON.stringify(
        {
          mode: dryRun ? 'dry-run' : 'apply',
          status: 'already_migrated',
          profileId: newProfiles[0].id,
          oldPrivyUserId,
          newPrivyUserId,
        },
        null,
        2,
      ),
    )
    return
  }

  if (oldProfiles.length === 0) {
    throw new Error(`No profile found with old Privy user id: ${oldPrivyUserId}`)
  }

  const targetProfile = oldProfiles[0]
  if (profileIdGuard && targetProfile.id !== profileIdGuard) {
    throw new Error(
      `--profile-id guard mismatch. old DID is mapped to profile ${targetProfile.id}, expected ${profileIdGuard}.`,
    )
  }

  if (newProfiles.length === 1 && newProfiles[0].id !== targetProfile.id) {
    throw new Error(
      `New Privy user id is already mapped to a different profile (${newProfiles[0].id}). Aborting to avoid an unsafe merge.`,
    )
  }

  const beforeRoles = await getWalletRoleSummary(db, targetProfile.id)
  const canonicalFromRole = await getCanonicalSmartWalletRole(db, targetProfile.id)
  const canonicalFromProfile =
    normalizeAddress(targetProfile.primary_smart_wallet ?? '') ??
    normalizeAddress(targetProfile.csw_address ?? '') ??
    normalizeAddress(targetProfile.base_sub_account ?? '')
  const preservedCanonicalSmartWallet = !allowCanonicalReplacement ? canonicalFromRole ?? canonicalFromProfile : null

  const staleWalletMembership = staleWallet
    ? await db.sql`
        SELECT address
        FROM profile_wallets
        WHERE profile_id = ${targetProfile.id}
          AND LOWER(address) = ${staleWallet}
        LIMIT 1;
      `
    : { rows: [] as any[] }

  let privyUserForSync: PrivyUserLike | null = null
  if (!skipSync) {
    privyUserForSync = await resolvePrivyUserForSync(newPrivyUserId)
  }

  const preview = {
    mode: dryRun ? 'dry-run' : 'apply',
    profileId: targetProfile.id,
    profileEmail: targetProfile.email,
    oldPrivyUserId,
    newPrivyUserId,
    skipSync,
    staleWallet,
    allowCanonicalReplacement,
    preservedCanonicalSmartWallet,
    staleWalletLinkedToProfile: (staleWalletMembership.rows ?? []).length > 0,
    before: {
      primaryWallet: targetProfile.primary_wallet,
      embeddedWallet: targetProfile.embedded_wallet,
      primaryEmbeddedEoa: targetProfile.primary_embedded_eoa,
      primarySmartWallet: targetProfile.primary_smart_wallet,
      cswAddress: targetProfile.csw_address,
      baseSubAccount: targetProfile.base_sub_account,
      walletRoleSummary: beforeRoles,
    },
    plan: {
      updatePrivyUserId: true,
      resetWalletIdentityColumns: true,
      clearWalletRoleFlags: true,
      dropStaleWalletFromProfileWallets: Boolean(staleWallet),
      preservePreviousCanonicalSmartWallet: Boolean(preservedCanonicalSmartWallet),
      resyncFromPrivy: !skipSync,
    },
  }

  console.log(JSON.stringify(preview, null, 2))
  if (dryRun) return

  let syncResult: SyncUserWalletsResult | null = null
  await db.sql`BEGIN;`
  try {
    await db.sql`
      UPDATE profiles
      SET
        privy_user_id = ${newPrivyUserId},
        primary_wallet = NULL,
        embedded_wallet = NULL,
        embedded_wallet_chain = NULL,
        embedded_wallet_client_type = NULL,
        primary_embedded_eoa = NULL,
        primary_smart_wallet = NULL,
        csw_address = NULL,
        base_sub_account = NULL,
        updated_at = NOW()
      WHERE id = ${targetProfile.id};
    `

    await db.sql`
      UPDATE profile_wallets
      SET
        is_primary = false,
        is_canonical_smart_wallet = false,
        is_embedded_eoa = false,
        updated_at = NOW()
      WHERE profile_id = ${targetProfile.id};
    `

    if (staleWallet) {
      await db.sql`
        DELETE FROM profile_wallets
        WHERE profile_id = ${targetProfile.id}
          AND LOWER(address) = ${staleWallet};
      `
    }

    if (!skipSync) {
      if (!privyUserForSync) {
        throw new Error('Expected Privy user payload for sync, but none was loaded.')
      }
      syncResult = await syncUserWallets(db, privyUserForSync)
    }

    if (preservedCanonicalSmartWallet) {
      await enforceCanonicalSmartWallet(db, targetProfile.id, preservedCanonicalSmartWallet)
    }

    await db.sql`COMMIT;`
  } catch (error) {
    await db.sql`ROLLBACK;`
    throw error
  }

  const afterRoles = await getWalletRoleSummary(db, targetProfile.id)
  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        status: 'ok',
        profileId: targetProfile.id,
        oldPrivyUserId,
        newPrivyUserId,
        staleWalletDropped: Boolean(staleWallet),
        canonicalPreserved: Boolean(preservedCanonicalSmartWallet),
        preservedCanonicalSmartWallet,
        syncExecuted: !skipSync,
        syncResult: syncResult
          ? {
              profileId: syncResult.profileId,
              canonicalSmartWallet: syncResult.canonicalSmartWallet?.address ?? null,
              embeddedEoa: syncResult.embeddedEoa?.address ?? null,
              primaryWalletAddress: syncResult.primaryWalletAddress ?? null,
              connectedWallets: syncResult.connectedWallets.length,
            }
          : null,
        afterWalletRoleSummary: afterRoles,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[privy-user-migrate] ${message}`)
  process.exit(1)
})
