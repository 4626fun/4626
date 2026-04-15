#!/usr/bin/env node

import {
  createPublicClient,
  encodeAbiParameters,
  http,
  isAddress,
  type Address,
  type PublicClient,
} from 'viem'
import { base } from 'viem/chains'
import type { SupabaseClient } from '@supabase/supabase-js'

import { ensureCanonicalWalletsSchema } from '../server/_lib/canonicalWalletsSchema.js'
import {
  ensureCswOwnerLinkStatusSchema,
  type CswOwnerLinkStatus,
  upsertCswOwnerLinkStatus,
} from '../server/_lib/cswOwnerLinkStatus.js'
import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../server/_lib/db/supabaseAdmin.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type ProfileRow = {
  id: number
  privyUserId: string | null
  primaryEmbeddedEoa: Address | null
  embeddedWallet: Address | null
  primarySmartWallet: Address | null
  cswAddress: Address | null
  baseSubAccount: Address | null
  canonicalWallet: Address | null
}

type AutoReconcileDecision = {
  canReconcile: boolean
  reason: string
}

type SupabaseAdminClient = SupabaseClient<any, any, any>
type ReadSource = { kind: 'db'; db: Db } | { kind: 'supabase'; supabase: SupabaseAdminClient }

const OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

type ReadContractClient = Pick<PublicClient, 'readContract'>

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend csw:owner-link:backfill -- [options]
  pnpm -C frontend exec tsx scripts/csw-owner-link-backfill.ts [options]

Options:
  --rpc <url>            Base RPC URL (default: BASE_RPC_URL or https://mainnet.base.org)
  --batch-size <n>       Profiles per DB fetch (default: 100)
  --max-profiles <n>     Stop after N profiles (default: 0 = all)
  --start-id <id>        Start scanning profiles with id > start-id (default: 0)
  --profile-id <id>      Process a single profile id only
  --auto-reconcile-mapping
                         Automatically reconcile DB canonical mapping for safe mapping-only mismatches
  --dry-run              Do not write status rows, only print classification
  --help                 Show this help
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

function asPositiveInt(value: string, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function normalizeAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!isAddress(raw)) return null
  return raw.toLowerCase() as Address
}

function normalizeNullableString(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw ? raw : null
}

function uniqueAddresses(values: Array<Address | null | undefined>): Address[] {
  const out: Address[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function toCanonicalArray(values: Address[]): Address[] {
  return uniqueAddresses(values.map((value) => normalizeAddress(value)))
}

async function reconcileCanonicalMappingInDb(params: {
  db: Db
  profileId: number
  canonicalSmartWallet: Address
  reconciledBy: string
  reason: string
}): Promise<void> {
  const canonicalLower = params.canonicalSmartWallet.toLowerCase() as Address
  const metadata = {
    reconciledBy: params.reconciledBy,
    reason: params.reason,
    reconciledAt: new Date().toISOString(),
  }
  await params.db.sql`BEGIN;`
  try {
    await params.db.sql`
      INSERT INTO wallets (address, chain, wallet_type, provider)
      VALUES (${canonicalLower}, 'evm', 'smart_wallet', 'unknown')
      ON CONFLICT (address) DO UPDATE
      SET
        chain = COALESCE(EXCLUDED.chain, wallets.chain),
        wallet_type = COALESCE(EXCLUDED.wallet_type, wallets.wallet_type),
        provider = CASE
          WHEN wallets.provider = 'unknown' THEN EXCLUDED.provider
          ELSE wallets.provider
        END;
    `

    await params.db.sql`
      INSERT INTO profile_wallets (
        profile_id,
        address,
        is_primary,
        is_canonical_smart_wallet,
        is_embedded_eoa,
        is_canonical_solana_wallet,
        is_operational_solana_wallet,
        verified_at,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        ${params.profileId},
        ${canonicalLower},
        false,
        true,
        false,
        false,
        false,
        NOW(),
        ${metadata},
        NOW(),
        NOW()
      )
      ON CONFLICT (profile_id, address) DO UPDATE
      SET
        is_canonical_smart_wallet = true,
        verified_at = NOW(),
        metadata = COALESCE(profile_wallets.metadata, '{}'::jsonb) || EXCLUDED.metadata,
        updated_at = NOW();
    `

    await params.db.sql`
      UPDATE profile_wallets
      SET
        is_canonical_smart_wallet = CASE WHEN LOWER(address) = ${canonicalLower} THEN true ELSE false END,
        updated_at = NOW()
      WHERE profile_id = ${params.profileId};
    `

    await params.db.sql`
      UPDATE profiles
      SET
        primary_smart_wallet = ${canonicalLower},
        csw_address = ${canonicalLower},
        base_sub_account = ${canonicalLower},
        updated_at = NOW()
      WHERE id = ${params.profileId};
    `

    await params.db.sql`COMMIT;`
  } catch (error) {
    try {
      await params.db.sql`ROLLBACK;`
    } catch {
      // Best effort rollback only.
    }
    throw error
  }
}

function decideAutoReconcile(params: {
  status: CswOwnerLinkStatus
  ownerLinked: boolean
  canonicalWallet: Address | null
  canonicalFromFlag: Address | null
  ownerMatchCandidates: Address[]
}): AutoReconcileDecision {
  if (params.status !== 'linked_mapping_mismatch') {
    return { canReconcile: false, reason: 'status_not_mapping_mismatch' }
  }
  if (!params.ownerLinked || !params.canonicalWallet) {
    return { canReconcile: false, reason: 'owner_not_linked_on_canonical' }
  }
  if (params.canonicalFromFlag) {
    return { canReconcile: true, reason: 'canonical_flag_authoritative' }
  }
  const matches = toCanonicalArray(params.ownerMatchCandidates)
  if (matches.length !== 1) {
    return { canReconcile: false, reason: 'ambiguous_owner_matches' }
  }
  const onlyMatch = matches[0]?.toLowerCase()
  if (onlyMatch !== params.canonicalWallet.toLowerCase()) {
    return { canReconcile: false, reason: 'canonical_not_unique_owner_match' }
  }
  return { canReconcile: true, reason: 'single_owner_match_candidate' }
}

async function fetchProfileBatch(db: Db, params: {
  cursorId: number
  batchSize: number
  profileId: number | null
}): Promise<ProfileRow[]> {
  let result: { rows: any[] }
  if (params.profileId && params.profileId > 0) {
    result = await db.sql`
      SELECT
        p.id,
        p.privy_user_id,
        LOWER(p.primary_embedded_eoa) AS primary_embedded_eoa,
        LOWER(p.embedded_wallet) AS embedded_wallet,
        LOWER(p.primary_smart_wallet) AS primary_smart_wallet,
        LOWER(p.csw_address) AS csw_address,
        LOWER(p.base_sub_account) AS base_sub_account,
        LOWER(csw.address) AS canonical_wallet
      FROM profiles p
      LEFT JOIN profile_wallets csw
        ON csw.profile_id = p.id
       AND csw.is_canonical_smart_wallet = true
      WHERE p.id = ${params.profileId}
      LIMIT 1;
    `
  } else {
    result = await db.sql`
      SELECT
        p.id,
        p.privy_user_id,
        LOWER(p.primary_embedded_eoa) AS primary_embedded_eoa,
        LOWER(p.embedded_wallet) AS embedded_wallet,
        LOWER(p.primary_smart_wallet) AS primary_smart_wallet,
        LOWER(p.csw_address) AS csw_address,
        LOWER(p.base_sub_account) AS base_sub_account,
        LOWER(csw.address) AS canonical_wallet
      FROM profiles p
      LEFT JOIN profile_wallets csw
        ON csw.profile_id = p.id
       AND csw.is_canonical_smart_wallet = true
      WHERE p.id > ${params.cursorId}
      ORDER BY p.id ASC
      LIMIT ${params.batchSize};
    `
  }

  return (result.rows ?? []).map((row: any) => ({
    id: Number(row.id),
    privyUserId: normalizeNullableString(row.privy_user_id),
    primaryEmbeddedEoa: normalizeAddress(row.primary_embedded_eoa),
    embeddedWallet: normalizeAddress(row.embedded_wallet),
    primarySmartWallet: normalizeAddress(row.primary_smart_wallet),
    cswAddress: normalizeAddress(row.csw_address),
    baseSubAccount: normalizeAddress(row.base_sub_account),
    canonicalWallet: normalizeAddress(row.canonical_wallet),
  }))
}

async function fetchProfileBatchFromSupabase(
  supabase: SupabaseAdminClient,
  params: { cursorId: number; batchSize: number; profileId: number | null },
): Promise<ProfileRow[]> {
  let query = supabase
    .from('profiles')
    .select('id,privy_user_id,primary_embedded_eoa,embedded_wallet,primary_smart_wallet,csw_address,base_sub_account')

  if (params.profileId && params.profileId > 0) {
    query = query.eq('id', params.profileId).limit(1)
  } else {
    query = query.gt('id', params.cursorId).order('id', { ascending: true }).limit(params.batchSize)
  }

  const { data: profiles, error: profilesError } = await query
  if (profilesError) throw new Error(`supabase_profiles_query_failed:${profilesError.message}`)

  const rows = Array.isArray(profiles) ? profiles : []
  const profileIds = rows
    .map((row: any) => Number(row?.id))
    .filter((id: number) => Number.isFinite(id) && id > 0)

  const canonicalByProfile = new Map<number, Address>()
  if (profileIds.length > 0) {
    const { data: canonicalRows, error: canonicalError } = await supabase
      .from('profile_wallets')
      .select('profile_id,address')
      .in('profile_id', profileIds)
      .eq('is_canonical_smart_wallet', true)
    if (canonicalError) throw new Error(`supabase_canonical_query_failed:${canonicalError.message}`)
    for (const row of canonicalRows ?? []) {
      const profileId = Number((row as any)?.profile_id)
      const address = normalizeAddress((row as any)?.address)
      if (!Number.isFinite(profileId) || profileId <= 0 || !address) continue
      if (!canonicalByProfile.has(profileId)) canonicalByProfile.set(profileId, address)
    }
  }

  return rows.map((row: any) => {
    const id = Number(row?.id)
    return {
      id,
      privyUserId: normalizeNullableString(row?.privy_user_id),
      primaryEmbeddedEoa: normalizeAddress(row?.primary_embedded_eoa),
      embeddedWallet: normalizeAddress(row?.embedded_wallet),
      primarySmartWallet: normalizeAddress(row?.primary_smart_wallet),
      cswAddress: normalizeAddress(row?.csw_address),
      baseSubAccount: normalizeAddress(row?.base_sub_account),
      canonicalWallet: canonicalByProfile.get(id) ?? null,
    }
  })
}

async function fetchProfileBatchForSource(
  source: ReadSource,
  params: { cursorId: number; batchSize: number; profileId: number | null },
): Promise<ProfileRow[]> {
  if (source.kind === 'db') return fetchProfileBatch(source.db, params)
  return fetchProfileBatchFromSupabase(source.supabase, params)
}

async function fetchSmartWalletCandidates(db: Db, profileId: number): Promise<Address[]> {
  const result = await db.sql`
    SELECT
      LOWER(pw.address) AS address,
      LOWER(COALESCE(w.wallet_type, '')) AS wallet_type
    FROM profile_wallets pw
    LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${profileId}
    ORDER BY pw.is_canonical_smart_wallet DESC, pw.is_primary DESC, pw.address ASC;
  `
  const candidates: Address[] = []
  for (const row of result.rows ?? []) {
    const address = normalizeAddress(row.address)
    const walletType = String(row.wallet_type ?? '').trim().toLowerCase()
    if (!address) continue
    if (walletType === 'smart_wallet') candidates.push(address)
  }
  return uniqueAddresses(candidates)
}

async function fetchSmartWalletCandidatesFromSupabase(
  supabase: SupabaseAdminClient,
  profileId: number,
): Promise<Address[]> {
  const { data: profileWalletRows, error: profileWalletError } = await supabase
    .from('profile_wallets')
    .select('address')
    .eq('profile_id', profileId)
  if (profileWalletError) throw new Error(`supabase_profile_wallets_query_failed:${profileWalletError.message}`)

  const addresses = uniqueAddresses((profileWalletRows ?? []).map((row: any) => normalizeAddress(row?.address)))
  if (addresses.length === 0) return []

  const { data: walletRows, error: walletError } = await supabase
    .from('wallets')
    .select('address,wallet_type')
    .in('address', addresses)
  if (walletError) throw new Error(`supabase_wallets_query_failed:${walletError.message}`)

  const out: Address[] = []
  for (const row of walletRows ?? []) {
    const address = normalizeAddress((row as any)?.address)
    const walletType = String((row as any)?.wallet_type ?? '').trim().toLowerCase()
    if (!address) continue
    if (walletType === 'smart_wallet') out.push(address)
  }
  return uniqueAddresses(out)
}

async function fetchSmartWalletCandidatesForSource(source: ReadSource, profileId: number): Promise<Address[]> {
  if (source.kind === 'db') return fetchSmartWalletCandidates(source.db, profileId)
  return fetchSmartWalletCandidatesFromSupabase(source.supabase, profileId)
}

type OwnerCheckCache = Map<string, boolean>

async function isOwner(params: {
  publicClient: ReadContractClient
  smartWallet: Address
  ownerAddress: Address
  cache: OwnerCheckCache
}): Promise<boolean> {
  const key = `${params.smartWallet.toLowerCase()}:${params.ownerAddress.toLowerCase()}`
  if (params.cache.has(key)) return params.cache.get(key) === true

  let result = false
  try {
    const direct = (await params.publicClient.readContract({
      address: params.smartWallet,
      abi: OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [params.ownerAddress],
    })) as boolean
    result = Boolean(direct)
  } catch {
    // Some versions may revert on direct helper checks; fallback to owner slot scan.
  }

  if (!result) {
    const expected = String(encodeAbiParameters([{ type: 'address' }], [params.ownerAddress])).toLowerCase()
    const ownerCountRaw = (await params.publicClient.readContract({
      address: params.smartWallet,
      abi: OWNER_ABI,
      functionName: 'ownerCount',
    })) as bigint
    const ownerCount = Number(ownerCountRaw)
    const upperBound = Math.min(128, Number.isFinite(ownerCount) && ownerCount > 0 ? ownerCount : 0)
    for (let i = 0; i < upperBound; i += 1) {
      const ownerBytes = (await params.publicClient.readContract({
        address: params.smartWallet,
        abi: OWNER_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as string
      if (String(ownerBytes).toLowerCase() === expected) {
        result = true
        break
      }
    }
  }

  params.cache.set(key, result)
  return result
}

function computeClassification(params: {
  canonicalWallet: Address | null
  canonicalFromFlag: Address | null
  legacyWallets: Address[]
  embeddedEoa: Address | null
  ownerLinked: boolean
  suggestedCanonicalWallet: Address | null
  rpcError: string | null
}): { status: CswOwnerLinkStatus; reason: string | null } {
  if (params.rpcError) return { status: 'rpc_error', reason: params.rpcError }
  if (!params.embeddedEoa) return { status: 'embedded_eoa_missing', reason: 'embedded_eoa_missing' }
  if (!params.canonicalWallet) return { status: 'canonical_wallet_missing', reason: 'canonical_wallet_missing' }

  const canonicalLc = params.canonicalWallet.toLowerCase()
  const legacyMismatch = params.legacyWallets.some((wallet) => wallet.toLowerCase() !== canonicalLc)
  const missingCanonicalFlag = !params.canonicalFromFlag

  if (params.ownerLinked) {
    if (legacyMismatch || missingCanonicalFlag) {
      return {
        status: 'linked_mapping_mismatch',
        reason: missingCanonicalFlag ? 'canonical_flag_missing' : 'legacy_columns_conflict',
      }
    }
    return { status: 'linked_ok', reason: null }
  }

  if (params.suggestedCanonicalWallet) {
    return {
      status: 'canonical_wallet_mismatch',
      reason: `embedded_owner_matches_${params.suggestedCanonicalWallet}`,
    }
  }
  return { status: 'owner_link_missing', reason: 'embedded_owner_not_installed' }
}

async function run(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const db = isDbConfigured() ? ((await getDb()) as Db | null) : null
  const supabase = isSupabaseAdminConfigured() ? (getSupabaseAdmin() as SupabaseAdminClient) : null

  let readSource: ReadSource | null = null
  if (db) {
    readSource = { kind: 'db', db }
  } else if (supabase) {
    readSource = { kind: 'supabase', supabase }
  } else {
    throw new Error('No database source available (Postgres and Supabase admin are both unavailable).')
  }

  const rpcUrl = getArg('--rpc', String(process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org')
  const batchSize = asPositiveInt(getArg('--batch-size', '100'), 100)
  const maxProfiles = asPositiveInt(getArg('--max-profiles', '0'), 0)
  const startId = asPositiveInt(getArg('--start-id', '0'), 0)
  const profileId = asPositiveInt(getArg('--profile-id', '0'), 0)
  const autoReconcileMapping = hasFlag('--auto-reconcile-mapping')
  const dryRun = hasFlag('--dry-run')

  if (!dryRun && readSource.kind !== 'db') {
    throw new Error('Non-dry-run requires direct Postgres connectivity; rerun with --dry-run or restore DB pool access.')
  }

  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 20_000 }),
  })
  const ownerCache: OwnerCheckCache = new Map()

  if (readSource.kind === 'db') {
    await ensureCanonicalWalletsSchema(readSource.db as any)
    await ensureCswOwnerLinkStatusSchema(readSource.db as any)
  }

  process.stdout.write(
    `[csw-owner-link-backfill] source=${readSource.kind} rpc=${rpcUrl} batchSize=${String(batchSize)} maxProfiles=${String(maxProfiles)} startId=${String(startId)} profileId=${profileId > 0 ? String(profileId) : 'all'} autoReconcileMapping=${String(autoReconcileMapping)} dryRun=${String(dryRun)}\n`,
  )

  let cursorId = startId
  let processed = 0
  let done = false
  let remediated = 0
  let remediationCandidates = 0
  const counters: Record<CswOwnerLinkStatus, number> = {
    linked_ok: 0,
    linked_mapping_mismatch: 0,
    owner_link_missing: 0,
    canonical_wallet_mismatch: 0,
    canonical_wallet_missing: 0,
    embedded_eoa_missing: 0,
    rpc_error: 0,
  }

  while (!done) {
    const batch = await fetchProfileBatchForSource(readSource, {
      cursorId,
      batchSize,
      profileId: profileId > 0 ? profileId : null,
    })
    if (batch.length === 0) break

    for (const profile of batch) {
      const embeddedEoa = profile.primaryEmbeddedEoa ?? profile.embeddedWallet
      const canonicalFromFlag = profile.canonicalWallet
      const legacyWallets = uniqueAddresses([
        profile.primarySmartWallet,
        profile.cswAddress,
        profile.baseSubAccount,
      ])
      const canonicalWallet = canonicalFromFlag ?? legacyWallets[0] ?? null

      const smartWalletCandidates = uniqueAddresses([
        ...(await fetchSmartWalletCandidatesForSource(readSource, profile.id)),
        ...legacyWallets,
      ])

      let ownerLinked = false
      let suggestedCanonicalWallet: Address | null = null
      let rpcError: string | null = null
      const ownerMatchCandidates: Address[] = []

      if (embeddedEoa && canonicalWallet) {
        try {
          ownerLinked = await isOwner({
            publicClient: client,
            smartWallet: canonicalWallet,
            ownerAddress: embeddedEoa,
            cache: ownerCache,
          })
          if (ownerLinked) ownerMatchCandidates.push(canonicalWallet)
        } catch (error) {
          rpcError = error instanceof Error ? error.message : String(error ?? 'rpc_error')
        }

        if (!rpcError && (autoReconcileMapping || !ownerLinked)) {
          for (const candidate of smartWalletCandidates) {
            if (candidate.toLowerCase() === canonicalWallet.toLowerCase()) continue
            try {
              const candidateOwner = await isOwner({
                publicClient: client,
                smartWallet: candidate,
                ownerAddress: embeddedEoa,
                cache: ownerCache,
              })
              if (candidateOwner) {
                ownerMatchCandidates.push(candidate)
                if (!suggestedCanonicalWallet) suggestedCanonicalWallet = candidate
                if (!autoReconcileMapping && !ownerLinked) break
              }
            } catch (error) {
              // Skip this candidate and continue scanning others.
              void error
            }
          }
        }
      }

      const classified = computeClassification({
        canonicalWallet,
        canonicalFromFlag,
        legacyWallets,
        embeddedEoa,
        ownerLinked,
        suggestedCanonicalWallet,
        rpcError,
      })
      let finalStatus = classified.status
      let finalReason = classified.reason

      const metadata: Record<string, unknown> = {
        canonicalSource: canonicalFromFlag ? 'profile_wallets_flag' : canonicalWallet ? 'legacy_fallback' : 'none',
        smartWalletCandidates,
        legacyWallets,
        ownerLinked,
        ownerMatchCandidates: toCanonicalArray(ownerMatchCandidates),
      }
      if (suggestedCanonicalWallet) metadata.suggestedCanonicalWallet = suggestedCanonicalWallet

      if (autoReconcileMapping) {
        const decision = decideAutoReconcile({
          status: classified.status,
          ownerLinked,
          canonicalWallet,
          canonicalFromFlag,
          ownerMatchCandidates,
        })
        metadata.autoReconcileDecision = decision
        if (decision.canReconcile && canonicalWallet) {
          remediationCandidates += 1
          if (dryRun) {
            metadata.autoReconcilePlanned = true
          } else {
            await reconcileCanonicalMappingInDb({
              db: readSource.db,
              profileId: profile.id,
              canonicalSmartWallet: canonicalWallet,
              reconciledBy: 'csw-owner-link-backfill',
              reason: decision.reason,
            })
            remediated += 1
            finalStatus = 'linked_ok'
            finalReason = 'auto_reconciled_mapping'
            metadata.autoReconciled = true
          }
        }
      }

      counters[finalStatus] += 1

      if (!dryRun) {
        await upsertCswOwnerLinkStatus(readSource.db, {
          profileId: profile.id,
          privyUserId: profile.privyUserId,
          embeddedEoa,
          canonicalSmartWallet: canonicalWallet,
          ownerLinked,
          status: finalStatus,
          reason: finalReason,
          suggestedCanonicalSmartWallet: suggestedCanonicalWallet,
          metadata,
        })
      }

      processed += 1
      cursorId = Math.max(cursorId, profile.id)

      process.stdout.write(
        `[csw-owner-link-backfill] profile=${String(profile.id)} status=${classified.status} final=${finalStatus} canonical=${canonicalWallet ?? 'null'} embedded=${embeddedEoa ?? 'null'} suggested=${suggestedCanonicalWallet ?? 'null'}\n`,
      )

      if (profileId > 0) {
        done = true
        break
      }
      if (maxProfiles > 0 && processed >= maxProfiles) {
        done = true
        break
      }
    }
  }

  process.stdout.write(`[csw-owner-link-backfill] processed=${String(processed)} dryRun=${String(dryRun)}\n`)
  process.stdout.write(
    `[csw-owner-link-backfill] remediationCandidates=${String(remediationCandidates)} remediated=${String(remediated)}\n`,
  )
  process.stdout.write(
    `[csw-owner-link-backfill] counts=${JSON.stringify(counters)}\n`,
  )
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  process.stderr.write(`[csw-owner-link-backfill] failed: ${message}\n`)
  process.exit(1)
})
