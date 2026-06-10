/**
 * Explore-targeted Ethos wallet backfill.
 *
 * Fetches Ethos scores for top creator_coins addresses (by 24h volume) plus
 * optional linked profile wallets and CSW owner EOAs — without scanning all
 * zora_csw_owners rows.
 *
 * Usage (from `frontend/` with DATABASE_URL + ETHOS_API_KEY):
 *   pnpm exec tsx scripts/ethos-creator-wallet-backfill.ts
 *
 * Resume is automatic via ethos_score_sync_state.sync_key =
 * `ethos_creator_wallet_backfill_v1` (stores numeric offset).
 *
 * Env:
 *   ETHOS_CREATOR_WALLET_BACKFILL_TOTAL_LIMIT=10000
 *   ETHOS_CREATOR_WALLET_BACKFILL_BATCH_SIZE=500
 *   ETHOS_CREATOR_WALLET_BACKFILL_MAX_BATCHES=100
 *   ETHOS_CREATOR_WALLET_BACKFILL_SLEEP_MS=300
 *   ETHOS_CREATOR_WALLET_BACKFILL_SKIP_FRESH=1
 *   ETHOS_CREATOR_WALLET_BACKFILL_INCLUDE_PROFILE_WALLETS=1
 *   ETHOS_CREATOR_WALLET_BACKFILL_INCLUDE_CSW_OWNERS=1
 *   ETHOS_CREATOR_WALLET_BACKFILL_REFRESH_PROJECTION=1
 *   ETHOS_CREATOR_WALLET_BACKFILL_REFRESH_EACH_BATCH=0
 *   ETHOS_CREATOR_WALLET_BACKFILL_PROJECTION_LIMIT=50000
 *   ETHOS_CREATOR_WALLET_BACKFILL_CHAIN_ID=8453
 */
import { getDb, isDbConfigured } from '../server/_lib/db/postgres.js'
import {
  materializeCanonicalEthosScores,
  syncEthosUserkeyScores,
} from '../server/_lib/identity/ethosCanonicalScores.js'
import { refreshCreatorEthosProjection } from '../server/_lib/zora/creatorEthosProjection.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code?: number) => never
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>

const SYNC_KEY = 'ethos_creator_wallet_backfill_v1'
const ADDRESS_RE = /^0x[a-f0-9]{40}$/
const MATCHED_FRESH_HOURS = 6

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? '')
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readArg(flag: string): string | null {
  for (let i = 2; i < process.argv.length; i += 1) {
    const token = process.argv[i]
    if (token === flag) {
      const value = process.argv[i + 1]
      return typeof value === 'string' && value.trim() ? value.trim() : null
    }
    if (token.startsWith(`${flag}=`)) {
      const value = token.slice(flag.length + 1)
      return value.trim() ? value.trim() : null
    }
  }
  return null
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const lowered = value.trim().toLowerCase()
  return ADDRESS_RE.test(lowered) ? lowered : null
}

async function readOffsetCursor(db: Db): Promise<number> {
  const result = await db.sql`
    SELECT cursor_after
    FROM public.ethos_score_sync_state
    WHERE sync_key = ${SYNC_KEY}
    LIMIT 1;
  `
  const raw = result.rows?.[0]?.cursor_after
  const parsed = Number(typeof raw === 'string' ? raw.trim() : raw)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

async function writeOffsetCursor(db: Db, offset: number): Promise<void> {
  await db.sql`
    INSERT INTO public.ethos_score_sync_state (
      sync_key,
      cursor_after,
      last_synced_at,
      updated_at
    ) VALUES (
      ${SYNC_KEY},
      ${String(Math.max(0, Math.floor(offset)))},
      NOW(),
      NOW()
    )
    ON CONFLICT (sync_key) DO UPDATE
    SET
      cursor_after = EXCLUDED.cursor_after,
      last_synced_at = NOW(),
      updated_at = NOW();
  `
}

async function readProjectionSummary(db: Db): Promise<{
  total: number
  scored: number
  walletCached: number
}> {
  const result = await db.sql`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE ethos_score IS NOT NULL)::bigint AS scored,
      COUNT(*) FILTER (WHERE ethos_score_source = 'wallet_cached')::bigint AS wallet_cached
    FROM public.v_explore_creators -- unified view for Explore-style data (see docs);
  `
  const row = result.rows?.[0] ?? {}
  return {
    total: Number(row.total ?? 0),
    scored: Number(row.scored ?? 0),
    walletCached: Number(row.wallet_cached ?? 0),
  }
}

async function fetchTopCreatorBatch(params: {
  db: Db
  chainId: number
  offset: number
  limit: number
}): Promise<Array<{ creatorAddress: string; volume24hUsd: number | null }>> {
  const rows = await params.db.sql`
    WITH ranked AS (
      SELECT
        lower(cc.creator_address) AS creator_address,
        cc.volume_24h_usd,
        ROW_NUMBER() OVER (
          PARTITION BY lower(cc.creator_address)
          ORDER BY
            cc.volume_24h_usd DESC NULLS LAST,
            cc.market_cap_usd DESC NULLS LAST,
            cc.created_at DESC NULLS LAST,
            cc.coin_address ASC
        ) AS creator_coin_rank
      FROM creator_coins cc
      WHERE cc.chain_id = ${params.chainId}
    )
    SELECT creator_address, volume_24h_usd
    FROM ranked
    WHERE creator_coin_rank = 1
    ORDER BY volume_24h_usd DESC NULLS LAST, creator_address ASC
    LIMIT ${params.limit}
    OFFSET ${Math.max(0, params.offset)};
  `

  return (rows.rows ?? [])
    .map((row: { creator_address: unknown; volume_24h_usd: unknown }) => {
      const creatorAddress = normalizeAddress(row.creator_address)
      if (!creatorAddress) return null
      const volumeRaw =
        typeof row.volume_24h_usd === 'number' ? row.volume_24h_usd : Number(row.volume_24h_usd)
      const volume24hUsd = Number.isFinite(volumeRaw) ? volumeRaw : null
      return { creatorAddress, volume24hUsd }
    })
    .filter((row): row is { creatorAddress: string; volume24hUsd: number | null } => Boolean(row))
}

async function expandLinkedWalletAddresses(params: {
  db: Db
  creatorAddresses: string[]
  includeProfileWallets: boolean
  includeCswOwners: boolean
}): Promise<string[]> {
  const addresses = new Set<string>()
  for (const creator of params.creatorAddresses) {
    addresses.add(creator)
  }
  if (params.creatorAddresses.length === 0) return []

  if (params.includeProfileWallets) {
    const profileRows = await params.db.sql`
      SELECT
        lower(NULLIF(trim(p.signing_eoa), '')) AS signing_eoa,
        lower(NULLIF(trim(p.primary_wallet), '')) AS primary_wallet,
        lower(NULLIF(trim(p.payout_recipient), '')) AS payout_recipient,
        lower(NULLIF(trim(p.smart_wallet_address), '')) AS smart_wallet_address,
        lower(NULLIF(trim(p.privy_wallet_address), '')) AS privy_wallet_address
      FROM public.zora_profiles p
      WHERE lower(NULLIF(trim(p.signing_eoa), '')) = ANY(${params.creatorAddresses}::text[])
         OR lower(NULLIF(trim(p.primary_wallet), '')) = ANY(${params.creatorAddresses}::text[])
         OR lower(NULLIF(trim(p.payout_recipient), '')) = ANY(${params.creatorAddresses}::text[])
         OR lower(NULLIF(trim(p.smart_wallet_address), '')) = ANY(${params.creatorAddresses}::text[])
         OR lower(NULLIF(trim(p.privy_wallet_address), '')) = ANY(${params.creatorAddresses}::text[]);
    `
    for (const row of profileRows.rows ?? []) {
      for (const key of [
        'signing_eoa',
        'primary_wallet',
        'payout_recipient',
        'smart_wallet_address',
        'privy_wallet_address',
      ] as const) {
        const normalized = normalizeAddress(row[key])
        if (normalized) addresses.add(normalized)
      }
    }
  }

  if (params.includeCswOwners) {
    const ownerRows = await params.db.sql`
      SELECT
        lower(zco.csw_address) AS csw_address,
        lower(NULLIF(zco.base_owner, '')) AS base_owner,
        owner_eoa
      FROM public.zora_csw_owners zco
      CROSS JOIN LATERAL unnest(COALESCE(zco.current_owners, ARRAY[]::text[])) AS owner_eoa
      WHERE lower(zco.csw_address) = ANY(${params.creatorAddresses}::text[]);
    `
    for (const row of ownerRows.rows ?? []) {
      const csw = normalizeAddress(row.csw_address)
      if (csw) addresses.add(csw)
      const baseOwner = normalizeAddress(row.base_owner)
      if (baseOwner) addresses.add(baseOwner)
      const owner = normalizeAddress(row.owner_eoa)
      if (owner) addresses.add(owner)
    }
  }

  return Array.from(addresses)
}

async function filterUserkeysNeedingSync(params: {
  db: Db
  userkeys: string[]
  skipFresh: boolean
}): Promise<string[]> {
  if (!params.skipFresh || params.userkeys.length === 0) return params.userkeys
  const rows = await params.db.sql`
    WITH keys AS (
      SELECT unnest(${params.userkeys}::text[]) AS ethos_userkey
    )
    SELECT k.ethos_userkey
    FROM keys k
    LEFT JOIN public.ethos_userkey_scores s
      ON s.ethos_userkey = k.ethos_userkey
    WHERE s.ethos_userkey IS NULL
       OR s.status <> 'matched'
       OR s.fetched_at IS NULL
       OR s.fetched_at < NOW() - (${MATCHED_FRESH_HOURS} * INTERVAL '1 hour');
  `
  return (rows.rows ?? [])
    .map((row: { ethos_userkey: unknown }) => String(row.ethos_userkey ?? ''))
    .filter((value) => value.length > 0)
}

async function main(): Promise<void> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = await getDb()
  if (!db) throw new Error('db_unavailable')

  const chainId = readIntEnv('ETHOS_CREATOR_WALLET_BACKFILL_CHAIN_ID', 8453, 1, 999_999)
  const totalLimit = readIntEnv('ETHOS_CREATOR_WALLET_BACKFILL_TOTAL_LIMIT', 10_000, 1, 250_000)
  const batchSize = readIntEnv('ETHOS_CREATOR_WALLET_BACKFILL_BATCH_SIZE', 500, 50, 5000)
  const maxBatches = readIntEnv('ETHOS_CREATOR_WALLET_BACKFILL_MAX_BATCHES', 100, 1, 10_000)
  const sleepMs = readIntEnv('ETHOS_CREATOR_WALLET_BACKFILL_SLEEP_MS', 300, 0, 10_000)
  const projectionLimit = readIntEnv('ETHOS_CREATOR_WALLET_BACKFILL_PROJECTION_LIMIT', 50_000, 100, 250_000)
  const skipFresh = readBoolEnv('ETHOS_CREATOR_WALLET_BACKFILL_SKIP_FRESH', true)
  const includeProfileWallets = readBoolEnv('ETHOS_CREATOR_WALLET_BACKFILL_INCLUDE_PROFILE_WALLETS', true)
  const includeCswOwners = readBoolEnv('ETHOS_CREATOR_WALLET_BACKFILL_INCLUDE_CSW_OWNERS', true)
  const refreshProjection = readBoolEnv('ETHOS_CREATOR_WALLET_BACKFILL_REFRESH_PROJECTION', true)
  const refreshEachBatch = readBoolEnv('ETHOS_CREATOR_WALLET_BACKFILL_REFRESH_EACH_BATCH', false)

  const argOffset = readArg('--offset')
  const argTotalLimit = readArg('--total-limit')
  const resetCursor =
    process.argv.includes('--reset') || readBoolEnv('ETHOS_CREATOR_WALLET_BACKFILL_RESET', false)

  let offset =
    argOffset !== null
      ? (() => {
          const parsed = Number(argOffset)
          return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
        })()
      : await readOffsetCursor(db)
  if (resetCursor) offset = 0

  const effectiveTotalLimit =
    argTotalLimit !== null
      ? (() => {
          const parsed = Number(argTotalLimit)
          if (!Number.isFinite(parsed)) return totalLimit
          return Math.max(1, Math.min(250_000, Math.floor(parsed)))
        })()
      : totalLimit

  const before = await readProjectionSummary(db)
  console.info('[ethos-creator-wallet-backfill] start', {
    chainId,
    offset,
    effectiveTotalLimit,
    batchSize,
    maxBatches,
    skipFresh,
    includeProfileWallets,
    includeCswOwners,
    refreshProjection,
    refreshEachBatch,
    projectionLimit,
    before,
  })

  let processedCreators = 0
  let expandedAddresses = 0
  let syncedUserkeys = 0
  let skippedFreshUserkeys = 0
  let projectionRefreshedRows = 0

  for (let batch = 1; batch <= maxBatches; batch += 1) {
    if (offset >= effectiveTotalLimit) {
      console.info('[ethos-creator-wallet-backfill] reached_total_limit', { offset, effectiveTotalLimit })
      break
    }

    const remaining = effectiveTotalLimit - offset
    const thisBatchSize = Math.min(batchSize, remaining)
    const creators = await fetchTopCreatorBatch({
      db,
      chainId,
      offset,
      limit: thisBatchSize,
    })
    if (creators.length === 0) {
      console.info('[ethos-creator-wallet-backfill] complete_no_more_creators', { batch, offset })
      break
    }

    const creatorAddresses = creators.map((row) => row.creatorAddress)
    const linkedAddresses = await expandLinkedWalletAddresses({
      db,
      creatorAddresses,
      includeProfileWallets,
      includeCswOwners,
    })
    const allUserkeys = linkedAddresses.map((address) => `address:${address}`)
    const userkeysToSync = await filterUserkeysNeedingSync({
      db,
      userkeys: allUserkeys,
      skipFresh,
    })
    skippedFreshUserkeys += allUserkeys.length - userkeysToSync.length

    let syncResult = { attempted: 0, updated: 0, failed: 0, processedUserkeys: [] as string[] }
    if (userkeysToSync.length > 0) {
      syncResult = await syncEthosUserkeyScores({
        db,
        forceUserkeys: userkeysToSync,
        chunkSize: 100,
      })
      await materializeCanonicalEthosScores({
        db,
        userkeys: syncResult.processedUserkeys,
        limit: syncResult.processedUserkeys.length,
      })
    }

    let batchProjectionRows = 0
    if (refreshProjection && refreshEachBatch) {
      const projection = await refreshCreatorEthosProjection({
        db,
        limit: projectionLimit,
      })
      batchProjectionRows = projection.refreshedRows
      projectionRefreshedRows += batchProjectionRows
    }

    processedCreators += creatorAddresses.length
    expandedAddresses += linkedAddresses.length
    syncedUserkeys += syncResult.updated
    offset += creators.length
    await writeOffsetCursor(db, offset)

    console.info('[ethos-creator-wallet-backfill] batch', {
      batch,
      creators: creatorAddresses.length,
      linkedAddresses: linkedAddresses.length,
      userkeysToSync: userkeysToSync.length,
      skippedFreshUserkeys: allUserkeys.length - userkeysToSync.length,
      syncAttempted: syncResult.attempted,
      syncUpdated: syncResult.updated,
      syncFailed: syncResult.failed,
      projectionRefreshedRows: batchProjectionRows,
      offset,
      effectiveTotalLimit,
    })

    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs))
    }
  }

  if (refreshProjection && !refreshEachBatch) {
    const projection = await refreshCreatorEthosProjection({
      db,
      limit: projectionLimit,
    })
    projectionRefreshedRows = projection.refreshedRows
    console.info('[ethos-creator-wallet-backfill] final_projection_refresh', {
      refreshedRows: projection.refreshedRows,
      appliedLimit: projection.appliedLimit,
    })
  }

  const after = await readProjectionSummary(db)
  console.info('[ethos-creator-wallet-backfill] done', {
    processedCreators,
    expandedAddresses,
    syncedUserkeys,
    skippedFreshUserkeys,
    projectionRefreshedRows,
    finalOffset: offset,
    before,
    after,
  })
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown_error'
  const stack = error instanceof Error ? error.stack : null
  console.error('[ethos-creator-wallet-backfill] failed', { error: message, stack })
  process.exit(1)
})
