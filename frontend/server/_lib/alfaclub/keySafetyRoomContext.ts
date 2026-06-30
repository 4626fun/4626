import type { Address } from 'viem'

import { getWalletPortfolio } from '../lens/debankPortfolio.js'
import { getDb } from '../db/postgres.js'
import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  getAlfaClubPublicClient,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import {
  computeHostKeyShare,
  readStakedSupply,
  readUserStakedKeysForAddresses,
  resolveStakingPoolAddress,
} from './alfaclubStakeReads.js'
import { getClearinghouseState } from './hyperliquid.js'
import {
  poolFeeBaselineUsdc,
  type AlfaRoomTier,
  type AlfaRoomType,
} from '../../../src/lib/alfaclub/keyDefense.js'
import { materializeRoomDisplayFields } from './roomDisplayLabels.js'

declare const process: { env: Record<string, string | undefined> }

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const TIER_BY_ONCHAIN: Record<number, AlfaRoomTier> = {
  0: 'casual',
  1: 'club',
  2: 'exclusive',
}
const ROOM_TYPE_BY_ONCHAIN: Record<number, AlfaRoomType> = {
  0: 'trading',
  1: 'social',
}

/** A non-creator key holder known from room chat activity (roster + last-reported key count). */
export type KeySafetyKnownHolder = {
  address: string
  label: string | null
  avatarUrl: string | null
  /** Last key count this holder reported in chat ingest (may be stale). */
  keys: number | null
}

export type KeySafetyRoomListItem = {
  roomId: string
  roomName: string
  /** Human label, e.g. "AKITA by wenakita". */
  displayLabel: string
  creatorHandle: string | null
  tier: AlfaRoomTier | null
  roomType: AlfaRoomType | null
  keySupply: number | null
  volumeUsdc: number | null
}

export type KeySafetyRoomContext = KeySafetyRoomListItem & {
  tokenId: string
  creatorAddress: string | null
  /** Wallet-held host keys (FriendKey balanceOf creator). */
  hostWalletKeys: number
  /** Host keys currently staked in the room pool. */
  hostStakedKeys: number
  /** Wallet + staked host keys — used for ownership share. */
  hostKeys: number
  hostSharePercent: number
  /** Room-wide staked key count. */
  stakedSupply: number
  /** Host staked keys as % of total supply. */
  hostStakeRatioPercent: number | null
  /** Room staked keys as % of total supply. */
  stakeRatioPercent: number | null
  distributionPotUsdc: number | null
  feeBaselinePotUsdc: number
  /** Pot used for hostile-buyer modeling (live trading fund when resolved). */
  attackModelPotUsdc: number
  attackPotSource: 'treasury' | 'distribution_fund' | 'fee_baseline'
  suggestedPotUsdc: number
  potSource: 'treasury' | 'distribution_fund' | 'fee_baseline'
  totalTreasuryUsdc: number | null
  hyperliquidAccountValueUsd: number | null
  debankTotalUsd: number | null
  /** AlfaClub app / trading fund wallet used for DeBank and Hyperliquid reads. */
  tradingWalletAddress: string | null
  treasuryWalletSource: 'override' | 'snapshot' | 'profile_embedded' | 'creator_fallback'
  /** Non-creator holders known from room chat activity (partial roster, sorted by reported keys). */
  knownOtherHolders: KeySafetyKnownHolder[]
  sources: {
    keySupply: 'onchain' | 'snapshot'
    hostWalletKeys: 'onchain' | 'snapshot'
    hostStakedKeys: 'onchain' | 'snapshot' | 'unavailable'
    stakedSupply: 'onchain' | 'unavailable'
    tier: 'onchain' | 'snapshot'
    roomType: 'onchain' | 'snapshot'
  }
}

export type KeySafetyRoomResolveOptions = {
  /** App trading wallet for treasury reads; does not affect FriendKey owner-key math. */
  tradingWalletOverride?: string | null
}

function normalizeEvmAddress(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!EVM_ADDRESS_RE.test(value)) return null
  return value.toLowerCase()
}

/** Trading fund wallet from snapshot/explore ingest when the room row exists but is incomplete. */
async function lookupTradingWalletHint(roomId: string): Promise<string | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const result = await db.sql`
      select coalesce(
        (select coalesce(
          nullif(trim(s.raw->'room'->>'tradingWallet'), ''),
          nullif(trim(s.raw->'room'->>'walletAddress'), ''),
          nullif(trim(s.raw->'room'->>'portfolioWallet'), ''),
          nullif(trim(s.raw->'room'->>'hyperliquidWallet'), '')
        )
         from public.alfaclub_rooms_snapshot s
         where s.room_id::text = ${roomId}
         limit 1),
        (select coalesce(
          nullif(trim(e.raw->'room'->>'tradingWallet'), ''),
          nullif(trim(e.raw->'room'->>'walletAddress'), ''),
          nullif(trim(e.raw->'room'->>'portfolioWallet'), ''),
          nullif(trim(e.raw->'room'->>'hyperliquidWallet'), '')
        )
         from public.alfaclub_explore_latest e
         where e.room_id::text = ${roomId}
         order by e.ingested_at desc nulls last
         limit 1)
      ) as trading_wallet;
    `
    const row = (result.rows ?? [])[0] as { trading_wallet: string | null } | undefined
    return normalizeEvmAddress(parseString(row?.trading_wallet))
  } catch {
    return null
  }
}

/**
 * Operator-maintained roomId → trading-wallet map for rooms whose app/Hyperliquid wallet
 * is not discoverable from snapshot/explore ingest or a 4626 profile.
 *
 * `ALFACLUB_TRADING_WALLET_MAP_JSON='{"1659":"0xEbF94fA19DB7d2E7905dEcD01DaE4ea9eb4C1FF2"}'`
 */
export function lookupTradingWalletFromEnv(roomId: string): string | null {
  const raw = (process.env.ALFACLUB_TRADING_WALLET_MAP_JSON ?? '').trim()
  if (!raw) return null
  try {
    const map = JSON.parse(raw) as Record<string, unknown>
    const value = map[roomId] ?? map[String(roomId)]
    return typeof value === 'string' ? normalizeEvmAddress(value) : null
  } catch {
    return null
  }
}

/** App trading wallet linked to the room creator's 4626 profile (when it differs from the CSW). */
async function lookupAppWalletByCreator(creatorAddress: string | null): Promise<string | null> {
  const creator = normalizeEvmAddress(creatorAddress)
  if (!creator) return null
  const db = await getDb()
  if (!db) return null
  try {
    const result = await db.sql`
      select lower(primary_embedded_eoa) as wallet
      from public.profiles
      where lower(csw_address) = ${creator}
        and primary_embedded_eoa is not null
        and lower(primary_embedded_eoa) <> ${creator}
      limit 1;
    `
    const row = (result.rows ?? [])[0] as { wallet: string | null } | undefined
    return normalizeEvmAddress(parseString(row?.wallet))
  } catch {
    return null
  }
}

/**
 * Roster of non-creator holders known from room chat ingest.
 *
 * Source of truth for "who is in the room" beyond the creator. Uses the most recent
 * username/avatar/key-count each distinct sender reported. This is a *known* (partial)
 * roster — holders who never chatted will not appear — so the UI labels it accordingly.
 */
async function lookupKnownOtherHolders(
  roomId: string,
  creatorAddress: string | null,
): Promise<KeySafetyKnownHolder[]> {
  const db = await getDb()
  if (!db) return []
  const creator = normalizeEvmAddress(creatorAddress) ?? '0x'
  try {
    const result = await db.sql`
      select distinct on (lower(sender_address))
        lower(sender_address) as address,
        username,
        avatar_url,
        keys_count
      from alfaclub.chat_ingest
      where room_id = ${roomId}
        and sender_address is not null
        and length(trim(sender_address)) > 0
        and lower(sender_address) <> ${creator}
        and coalesce(is_bot, false) = false
      order by lower(sender_address), message_date desc nulls last, ingested_at desc
      limit 300;
    `
    const rows = (result.rows ?? []) as Array<{
      address: string | null
      username: string | null
      avatar_url: string | null
      keys_count: number | string | null
    }>
    const holders = rows
      .map((r): KeySafetyKnownHolder | null => {
        const address = normalizeEvmAddress(r.address)
        if (!address) return null
        const keys = parseNumber(r.keys_count)
        return {
          address,
          label: parseString(r.username),
          avatarUrl: parseString(r.avatar_url),
          keys: keys != null && keys >= 0 ? Math.floor(keys) : null,
        }
      })
      .filter((h): h is KeySafetyKnownHolder => h != null)
    holders.sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0))
    return holders.slice(0, 50)
  } catch {
    return []
  }
}

export function resolveTreasuryWallet(params: {
  tradingWalletOverride: string | null
  envMapWallet: string | null
  snapshotTradingWallet: string | null
  appWalletFromProfile: string | null
  creatorAddress: string | null
}): { address: string | null; source: KeySafetyRoomContext['treasuryWalletSource'] } {
  const override = normalizeEvmAddress(params.tradingWalletOverride)
  if (override) return { address: override, source: 'override' }

  const fromEnv = normalizeEvmAddress(params.envMapWallet)
  if (fromEnv) return { address: fromEnv, source: 'override' }

  const fromSnapshot = normalizeEvmAddress(params.snapshotTradingWallet)
  if (fromSnapshot) return { address: fromSnapshot, source: 'snapshot' }

  const creator = normalizeEvmAddress(params.creatorAddress)
  const fromProfile = normalizeEvmAddress(params.appWalletFromProfile)
  if (fromProfile && fromProfile !== creator) {
    return { address: fromProfile, source: 'profile_embedded' }
  }

  if (creator) return { address: creator, source: 'creator_fallback' }

  return { address: null, source: 'creator_fallback' }
}

/** On-chain wallet (DeBank) + Hyperliquid margin account for the same trading wallet. */
export function combineTreasuryTotalUsd(
  debankTotalUsd: number | null,
  hyperliquidAccountValueUsd: number | null,
): number | null {
  const parts = [debankTotalUsd, hyperliquidAccountValueUsd].filter(
    (value): value is number => value != null && Number.isFinite(value) && value > 0,
  )
  return parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) : null
}

type SnapshotRow = {
  room_id: string
  room_name: string | null
  creator_twitter_username: string | null
  creator_address: string | null
  room_type: string | null
  tier: string | null
  volume_col_raw: string | null
  volume_raw: string | null
  supply_col_raw: string | null
  supply_raw: string | null
  fund_size_raw: string | null
  pot_raw: string | null
  host_keys_raw: string | null
  host_staked_keys_raw: string | null
  treasury_wallet_raw: string | null
  cached_display_label: string | null
}

function parseString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(value)) return parseString(value[0] ?? null)
  return null
}

function parseNumber(value: unknown): number | null {
  const parsed = parseString(value)
  if (!parsed) return null
  const n = Number(parsed)
  return Number.isFinite(n) ? n : null
}

function normalizeMaybeUsdc(raw: number | null): number | null {
  if (!Number.isFinite(raw ?? NaN)) return null
  const value = Number(raw)
  if (value >= 1_000_000) return value / 1_000_000
  return value
}

function normalizeTier(raw: string | null): AlfaRoomTier | null {
  const value = (raw ?? '').trim().toLowerCase()
  switch (value) {
    case 'casual':
      return 'casual'
    case 'club':
      return 'club'
    case 'exclusive':
      return 'exclusive'
    default:
      return null
  }
}

function normalizeRoomType(raw: string | null): AlfaRoomType | null {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'trading') return 'trading'
  if (value === 'social') return 'social'
  return null
}

function collectOwnerAddresses(...candidates: Array<string | null | undefined>): Address[] {
  const seen = new Set<string>()
  const out: Address[] = []
  for (const candidate of candidates) {
    const value = (candidate ?? '').trim().toLowerCase()
    if (!EVM_ADDRESS_RE.test(value) || seen.has(value)) continue
    seen.add(value)
    out.push(value as Address)
  }
  return out
}

async function readOwnerWalletKeys(
  client: AlfaClubPublicClientLike,
  tokenId: bigint,
  ownerAddresses: readonly Address[],
): Promise<number> {
  if (ownerAddresses.length === 0) return 0
  let total = 0
  for (const owner of ownerAddresses) {
    try {
      const balance = (await client.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'balanceOf',
        args: [owner, tokenId],
      })) as bigint
      if (typeof balance === 'bigint' && balance > 0n) total += Number(balance)
    } catch {
      // skip failed reads
    }
  }
  return Number.isFinite(total) && total >= 0 ? total : 0
}

function pickFirstAddress(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const value = (candidate ?? '').trim().toLowerCase()
    if (EVM_ADDRESS_RE.test(value)) return value
  }
  return null
}

export function resolveSuggestedPotUsdc(params: {
  distributionPotUsdc: number | null
  feeBaselinePotUsdc: number
  totalTreasuryUsdc: number | null
}): { suggestedPotUsdc: number; potSource: KeySafetyRoomContext['potSource'] } {
  const treasury = params.totalTreasuryUsdc
  if (Number.isFinite(treasury ?? NaN) && (treasury ?? 0) > 0) {
    return { suggestedPotUsdc: treasury!, potSource: 'treasury' }
  }
  if (Number.isFinite(params.distributionPotUsdc ?? NaN) && (params.distributionPotUsdc ?? 0) > 0) {
    return { suggestedPotUsdc: params.distributionPotUsdc!, potSource: 'distribution_fund' }
  }
  return { suggestedPotUsdc: params.feeBaselinePotUsdc, potSource: 'fee_baseline' }
}

/** Pot size for key-defense modeling — live trading fund when resolved, else snapshot fund, else fee baseline. */
export function resolveAttackModelPotUsdc(params: {
  distributionPotUsdc: number | null
  feeBaselinePotUsdc: number
  totalTreasuryUsdc: number | null
}): { attackModelPotUsdc: number; attackPotSource: KeySafetyRoomContext['attackPotSource'] } {
  const treasury = params.totalTreasuryUsdc
  if (Number.isFinite(treasury ?? NaN) && (treasury ?? 0) > 0) {
    return { attackModelPotUsdc: treasury!, attackPotSource: 'treasury' }
  }
  if (Number.isFinite(params.distributionPotUsdc ?? NaN) && (params.distributionPotUsdc ?? 0) > 0) {
    return {
      attackModelPotUsdc: params.distributionPotUsdc!,
      attackPotSource: 'distribution_fund',
    }
  }
  return {
    attackModelPotUsdc: params.feeBaselinePotUsdc,
    attackPotSource: 'fee_baseline',
  }
}

async function readOnchainRoomMetrics(
  client: AlfaClubPublicClientLike,
  tokenId: bigint,
  creatorAddress: Address | null,
): Promise<{
  keySupply: number | null
  hostWalletKeys: number | null
  tier: AlfaRoomTier | null
  roomType: AlfaRoomType | null
}> {
  try {
    const reads = await Promise.all([
      client.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'totalSupply',
        args: [tokenId],
      }),
      creatorAddress
        ? client.readContract({
            address: ALFACLUB.friendKey,
            abi: FRIEND_KEY_ABI,
            functionName: 'balanceOf',
            args: [creatorAddress, tokenId],
          })
        : Promise.resolve(null),
      client.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'roomTiers',
        args: [tokenId],
      }),
      client.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'roomTypes',
        args: [tokenId],
      }),
    ])

    const totalSupply = typeof reads[0] === 'bigint' ? Number(reads[0]) : null
    const hostBalance = typeof reads[1] === 'bigint' ? Number(reads[1]) : null
    const tierRaw = typeof reads[2] === 'number' || typeof reads[2] === 'bigint' ? Number(reads[2]) : null
    const roomTypeRaw =
      typeof reads[3] === 'number' || typeof reads[3] === 'bigint' ? Number(reads[3]) : null

    return {
      keySupply: Number.isFinite(totalSupply ?? NaN) && (totalSupply ?? 0) > 0 ? totalSupply : null,
      hostWalletKeys:
        Number.isFinite(hostBalance ?? NaN) && (hostBalance ?? 0) >= 0 ? hostBalance : null,
      tier: tierRaw != null ? TIER_BY_ONCHAIN[tierRaw] ?? null : null,
      roomType: roomTypeRaw != null ? ROOM_TYPE_BY_ONCHAIN[roomTypeRaw] ?? null : null,
    }
  } catch {
    return { keySupply: null, hostWalletKeys: null, tier: null, roomType: null }
  }
}

async function lookupCreatorIndexRow(roomId: string): Promise<{
  mintedAtBlock: bigint | null
  stakingPool: Address | null
}> {
  const db = await getDb()
  if (!db) return { mintedAtBlock: null, stakingPool: null }
  try {
    const result = await db.sql`
      select minted_at_block::text as minted_at_block, staking_pool
      from public.alfaclub_creators
      where token_id = ${roomId}
      limit 1;
    `
    const row = (result.rows ?? [])[0] as
      | { minted_at_block: string | null; staking_pool: string | null }
      | undefined
    if (!row) return { mintedAtBlock: null, stakingPool: null }
    const mintedAtBlock =
      row.minted_at_block && /^\d+$/.test(row.minted_at_block)
        ? BigInt(row.minted_at_block)
        : null
    const poolRaw = (row.staking_pool ?? '').trim().toLowerCase()
    const stakingPool =
      EVM_ADDRESS_RE.test(poolRaw) && poolRaw !== '0x0000000000000000000000000000000000000000'
        ? (poolRaw as Address)
        : null
    return { mintedAtBlock, stakingPool }
  } catch {
    return { mintedAtBlock: null, stakingPool: null }
  }
}

async function resolveCreatorAddress(
  tokenId: bigint,
  client: AlfaClubPublicClientLike,
  snapshotCreator: string | null,
): Promise<string | null> {
  const fromSnapshot = pickFirstAddress(snapshotCreator)
  if (fromSnapshot) return fromSnapshot
  try {
    const creator = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [tokenId],
    })) as Address
    return pickFirstAddress(creator)
  } catch {
    return null
  }
}

async function readTreasuryUsd(walletAddress: string | null): Promise<{
  debankTotalUsd: number | null
  hyperliquidAccountValueUsd: number | null
  totalTreasuryUsdc: number | null
}> {
  if (!walletAddress) {
    return { debankTotalUsd: null, hyperliquidAccountValueUsd: null, totalTreasuryUsdc: null }
  }

  const [portfolio, hlState] = await Promise.all([
    getWalletPortfolio(walletAddress, { topTokenCount: 0 }),
    getClearinghouseState(walletAddress),
  ])

  const debankTotalUsd =
    portfolio && Number.isFinite(portfolio.totalUsdValue) ? portfolio.totalUsdValue : null
  const hyperliquidAccountValueUsd =
    hlState && Number.isFinite(hlState.accountValueUsd ?? NaN) ? hlState.accountValueUsd : null

  const totalTreasuryUsdc = combineTreasuryTotalUsd(debankTotalUsd, hyperliquidAccountValueUsd)

  return { debankTotalUsd, hyperliquidAccountValueUsd, totalTreasuryUsdc }
}

function resolveRoomLabelFields(
  row: Pick<SnapshotRow, 'room_id' | 'room_name' | 'creator_twitter_username' | 'cached_display_label'>,
) {
  return materializeRoomDisplayFields({
    roomId: row.room_id,
    roomName: parseString(row.room_name),
    creatorHandle: parseString(row.creator_twitter_username),
    cachedDisplayLabel: parseString(row.cached_display_label),
  })
}

async function lookupFallbackRoomLabels(roomId: string): Promise<{
  roomName: string | null
  creatorHandle: string | null
  cachedDisplayLabel: string | null
}> {
  const db = await getDb()
  if (!db) {
    return { roomName: null, creatorHandle: null, cachedDisplayLabel: null }
  }
  try {
    const result = await db.sql`
      select
        lc.display_label as cached_display_label,
        e.room_name,
        e.creator_twitter_username
      from (select ${roomId}::text as room_id) target
      left join alfaclub.room_label_cache lc on lc.room_id = target.room_id
      left join lateral (
        select e2.room_name, e2.creator_twitter_username
        from public.alfaclub_explore_latest e2
        where e2.room_id::text = target.room_id
        order by e2.ingested_at desc nulls last
        limit 1
      ) e on true
      limit 1;
    `
    const row = (result.rows ?? [])[0] as
      | {
          cached_display_label: string | null
          room_name: string | null
          creator_twitter_username: string | null
        }
      | undefined
    return {
      roomName: parseString(row?.room_name),
      creatorHandle: parseString(row?.creator_twitter_username),
      cachedDisplayLabel: parseString(row?.cached_display_label),
    }
  } catch {
    return { roomName: null, creatorHandle: null, cachedDisplayLabel: null }
  }
}

/** When snapshot ingest lags, resolve trading rooms directly from FriendKey onchain state. */
async function buildOnchainFallbackRow(roomId: string): Promise<SnapshotRow | null> {
  const tokenId = BigInt(roomId)
  const client = await getAlfaClubPublicClient()
  const creatorAddress = await resolveCreatorAddress(tokenId, client, null)
  const onchain = await readOnchainRoomMetrics(client, tokenId, creatorAddress as Address | null)
  if (onchain.roomType === 'social') return null
  if (!onchain.keySupply || onchain.keySupply <= 0) {
    try {
      const exists = (await client.readContract({
        address: ALFACLUB.friendKey,
        abi: FRIEND_KEY_ABI,
        functionName: 'exists',
        args: [tokenId],
      })) as boolean
      if (!exists) return null
    } catch {
      return null
    }
  }

  const labels = await lookupFallbackRoomLabels(roomId)
  const tradingWalletHint = await lookupTradingWalletHint(roomId)
  return {
    room_id: roomId,
    room_name: labels.roomName,
    creator_twitter_username: labels.creatorHandle,
    cached_display_label: labels.cachedDisplayLabel,
    creator_address: creatorAddress,
    room_type: onchain.roomType ?? 'trading',
    tier: onchain.tier ?? 'club',
    volume_col_raw: null,
    volume_raw: null,
    supply_col_raw: onchain.keySupply != null ? String(onchain.keySupply) : null,
    supply_raw: null,
    fund_size_raw: null,
    pot_raw: null,
    host_keys_raw: null,
    host_staked_keys_raw: null,
    treasury_wallet_raw: tradingWalletHint,
  }
}

async function fetchSnapshotRowForRoomId(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  roomId: string,
): Promise<SnapshotRow | undefined> {
  const result = await db.sql`
    select
      s.room_id::text as room_id,
      coalesce(
        nullif(trim(s.room_name), ''),
        nullif(trim(s.raw->'metadata'->>'name'), ''),
        nullif(trim(s.raw->'room'->>'name'), ''),
        nullif(trim(s.raw->'room'->>'title'), ''),
        nullif(trim(e.room_name), ''),
        nullif(trim(lc.display_label), ''),
        case
          when nullif(trim(s.sn), '') is not null and nullif(trim(s.sn), '') !~ '^[0-9]+$'
            then nullif(trim(s.sn), '')
          else null
        end
      ) as room_name,
      coalesce(
        nullif(trim(s.creator_twitter_username), ''),
        nullif(trim(s.raw->'creator'->>'twitter_username'), ''),
        nullif(trim(s.raw->'creator'->>'username'), ''),
        nullif(trim(s.raw->'room'->>'creatorUsername'), ''),
        nullif(trim(s.raw->'room'->>'username'), ''),
        nullif(trim(e.creator_twitter_username), ''),
        nullif(trim(chat.username), '')
      ) as creator_twitter_username,
      lc.display_label as cached_display_label,
      lower(nullif(s.creator_address, '')) as creator_address,
      s.room_type,
      s.tier,
      s.volume::text as volume_col_raw,
      nullif(s.raw->'room'->>'volume', '') as volume_raw,
      s.current_supply::text as supply_col_raw,
      coalesce(
        nullif(s.raw->'room'->>'keySupply', ''),
        nullif(s.raw->'room'->>'keysSupply', ''),
        nullif(s.raw->'room'->>'totalSupply', '')
      ) as supply_raw,
      s.fund_size::text as fund_size_raw,
      coalesce(
        nullif(s.raw->'room'->>'tradingFundBalance', ''),
        nullif(s.raw->'room'->>'poolBalance', ''),
        nullif(s.raw->'room'->>'fundBalance', ''),
        nullif(s.raw->'room'->>'stakingPoolBalance', '')
      ) as pot_raw,
      coalesce(
        nullif(s.raw->'room'->>'creatorKeyBalance', ''),
        nullif(s.raw->'room'->>'hostKeyBalance', ''),
        nullif(s.raw->'room'->>'creatorKeys', ''),
        nullif(s.raw->'room'->>'hostKeys', '')
      ) as host_keys_raw,
      coalesce(
        nullif(s.raw->'room'->>'creatorStakedKeys', ''),
        nullif(s.raw->'room'->>'hostStakedKeys', ''),
        nullif(s.raw->'room'->>'ownerStakedKeys', ''),
        nullif(s.raw->'room'->>'creatorStakedBalance', '')
      ) as host_staked_keys_raw,
      coalesce(
        nullif(s.raw->'room'->>'tradingWallet', ''),
        nullif(s.raw->'room'->>'walletAddress', ''),
        nullif(s.raw->'room'->>'portfolioWallet', ''),
        nullif(s.raw->'room'->>'hyperliquidWallet', '')
      ) as treasury_wallet_raw
    from public.alfaclub_rooms_snapshot s
    left join alfaclub.room_label_cache lc on lc.room_id = s.room_id::text
    left join lateral (
      select e2.creator_twitter_username, e2.room_name
      from public.alfaclub_explore_latest e2
      where e2.room_id = s.room_id
      order by e2.ingested_at desc nulls last
      limit 1
    ) e on true
    left join lateral (
      select ci.username
      from alfaclub.chat_ingest ci
      where ci.room_id = s.room_id::text
        and lower(ci.sender_address) = lower(s.creator_address)
        and ci.username is not null
        and length(trim(ci.username)) > 0
      order by ci.message_date desc nulls last, ci.ingested_at desc
      limit 1
    ) chat on true
    where s.room_id::text = ${roomId}
      and lower(coalesce(s.room_type, '')) = 'trading'
    limit 1;
  `
  return (result.rows ?? [])[0] as SnapshotRow | undefined
}

function snapshotRowToListItem(row: SnapshotRow): KeySafetyRoomListItem {
  const supplyRaw = parseNumber(row.supply_col_raw) ?? parseNumber(row.supply_raw)
  const volumeRaw = parseNumber(row.volume_col_raw) ?? parseNumber(row.volume_raw)
  const labels = resolveRoomLabelFields(row)
  return {
    roomId: row.room_id,
    roomName: labels.roomName,
    displayLabel: labels.displayLabel,
    creatorHandle: labels.creatorHandle,
    tier: normalizeTier(row.tier),
    roomType: normalizeRoomType(row.room_type),
    keySupply: Number.isFinite(supplyRaw ?? NaN) && (supplyRaw ?? 0) > 0 ? Math.floor(supplyRaw!) : null,
    volumeUsdc: normalizeMaybeUsdc(volumeRaw),
  }
}

export async function listKeySafetyRooms(limit = 40): Promise<KeySafetyRoomListItem[]> {
  const db = await getDb()
  if (!db) return []

  const result = await db.sql`
    select
      s.room_id::text as room_id,
      coalesce(
        nullif(trim(s.room_name), ''),
        nullif(trim(s.raw->'metadata'->>'name'), ''),
        nullif(trim(s.raw->'room'->>'name'), ''),
        nullif(trim(s.raw->'room'->>'title'), ''),
        nullif(trim(e.room_name), ''),
        nullif(trim(lc.display_label), ''),
        case
          when nullif(trim(s.sn), '') is not null and nullif(trim(s.sn), '') !~ '^[0-9]+$'
            then nullif(trim(s.sn), '')
          else null
        end
      ) as room_name,
      coalesce(
        nullif(trim(s.creator_twitter_username), ''),
        nullif(trim(s.raw->'creator'->>'twitter_username'), ''),
        nullif(trim(s.raw->'creator'->>'username'), ''),
        nullif(trim(s.raw->'room'->>'creatorUsername'), ''),
        nullif(trim(s.raw->'room'->>'username'), ''),
        nullif(trim(e.creator_twitter_username), ''),
        nullif(trim(chat.username), '')
      ) as creator_twitter_username,
      lc.display_label as cached_display_label,
      s.room_type,
      s.tier,
      s.volume::text as volume_col_raw,
      nullif(s.raw->'room'->>'volume', '') as volume_raw,
      s.current_supply::text as supply_col_raw,
      coalesce(
        nullif(s.raw->'room'->>'keySupply', ''),
        nullif(s.raw->'room'->>'keysSupply', ''),
        nullif(s.raw->'room'->>'totalSupply', '')
      ) as supply_raw,
      null::text as fund_size_raw,
      null::text as pot_raw,
      null::text as host_keys_raw,
      null::text as treasury_wallet_raw,
      null::text as creator_address
    from public.alfaclub_rooms_snapshot s
    left join alfaclub.room_label_cache lc on lc.room_id = s.room_id::text
    left join lateral (
      select e2.creator_twitter_username, e2.room_name
      from public.alfaclub_explore_latest e2
      where e2.room_id = s.room_id
      order by e2.ingested_at desc nulls last
      limit 1
    ) e on true
    left join lateral (
      select ci.username
      from alfaclub.chat_ingest ci
      where ci.room_id = s.room_id::text
        and lower(ci.sender_address) = lower(s.creator_address)
        and ci.username is not null
        and length(trim(ci.username)) > 0
      order by ci.message_date desc nulls last, ci.ingested_at desc
      limit 1
    ) chat on true
    where lower(coalesce(s.room_type, '')) = 'trading'
      and lower(coalesce(s.tier, '')) in ('casual', 'club', 'exclusive')
    order by coalesce(
      s.volume,
      case
        when nullif(s.raw->'room'->>'volume', '') ~ '^[0-9]+(\\.[0-9]+)?$'
          then (s.raw->'room'->>'volume')::numeric
        else null
      end
    ) desc nulls last
    limit ${Math.min(80, Math.max(5, limit))};
  `

  return ((result.rows ?? []) as SnapshotRow[]).map(snapshotRowToListItem)
}

export async function resolveKeySafetyRoomContext(
  roomId: string,
  options?: KeySafetyRoomResolveOptions,
): Promise<KeySafetyRoomContext | null> {
  const normalizedRoomId = roomId.trim()
  if (!/^\d+$/.test(normalizedRoomId)) return null

  const db = await getDb()
  let row = db ? await fetchSnapshotRowForRoomId(db, normalizedRoomId) : undefined
  if (!row) {
    row = (await buildOnchainFallbackRow(normalizedRoomId)) ?? undefined
  }
  if (!row) return null

  const tradingWalletHint = row.treasury_wallet_raw
    ? null
    : await lookupTradingWalletHint(normalizedRoomId)

  const tokenId = BigInt(normalizedRoomId)
  const client = await getAlfaClubPublicClient()
  const creatorAddress = await resolveCreatorAddress(tokenId, client, row.creator_address)
  const appWalletFromProfile = await lookupAppWalletByCreator(creatorAddress)
  const knownOtherHolders = await lookupKnownOtherHolders(normalizedRoomId, creatorAddress)
  const indexRow = await lookupCreatorIndexRow(normalizedRoomId)
  const [onchain, stakingPool] = await Promise.all([
    readOnchainRoomMetrics(client, tokenId, creatorAddress as Address | null),
    indexRow.stakingPool
      ? Promise.resolve(indexRow.stakingPool)
      : resolveStakingPoolAddress(client, tokenId),
  ])

  const ownerAddresses = collectOwnerAddresses(creatorAddress)

  const stakedSupplyRaw = await readStakedSupply(client, stakingPool, tokenId)

  const snapshotSupply = parseNumber(row.supply_col_raw) ?? parseNumber(row.supply_raw)
  const keySupply =
    onchain.keySupply ??
    (Number.isFinite(snapshotSupply ?? NaN) && (snapshotSupply ?? 0) > 0
      ? Math.floor(snapshotSupply!)
      : null)

  const stakedSupply = Number(stakedSupplyRaw)
  const stakedSupplyValue =
    Number.isFinite(stakedSupply) && stakedSupply >= 0 ? stakedSupply : 0

  const stakeFromBlock =
    indexRow.mintedAtBlock != null && indexRow.mintedAtBlock > 5000n
      ? indexRow.mintedAtBlock - 5000n
      : indexRow.mintedAtBlock ?? undefined

  const hostStakedKeysOnchain = await readUserStakedKeysForAddresses(client, stakingPool, ownerAddresses, {
    fromBlock: stakeFromBlock,
    tokenId,
    poolStakedSupply: stakedSupplyRaw,
  })

  const snapshotHostKeys = parseNumber(row.host_keys_raw)
  const ownerWalletKeys = await readOwnerWalletKeys(client, tokenId, ownerAddresses)
  const hostWalletCandidates = [
    onchain.hostWalletKeys,
    ownerWalletKeys,
    Number.isFinite(snapshotHostKeys ?? NaN) ? Math.floor(snapshotHostKeys!) : null,
  ].filter((value): value is number => value != null && value >= 0)
  const hostWalletKeys = hostWalletCandidates.length > 0 ? Math.max(...hostWalletCandidates) : 0
  const hostWalletSource: 'onchain' | 'snapshot' =
    onchain.hostWalletKeys != null &&
    (snapshotHostKeys == null || onchain.hostWalletKeys >= Math.floor(snapshotHostKeys))
      ? 'onchain'
      : 'snapshot'

  const snapshotHostStaked = parseNumber(row.host_staked_keys_raw)
  const hostStakedKeys =
    hostStakedKeysOnchain ??
    (Number.isFinite(snapshotHostStaked ?? NaN) ? Math.floor(snapshotHostStaked!) : 0)
  const hostStakedSource: 'onchain' | 'snapshot' | 'unavailable' =
    hostStakedKeysOnchain != null
      ? 'onchain'
      : Number.isFinite(snapshotHostStaked ?? NaN)
        ? 'snapshot'
        : 'unavailable'
  const stakedSupplySource: 'onchain' | 'unavailable' =
    stakingPool != null ? 'onchain' : 'unavailable'

  const { hostKeys, hostSharePercent, stakeRatioPercent: hostStakeRatioPercent } =
    computeHostKeyShare({
      keySupply,
      hostWalletKeys,
      hostStakedKeys,
    })
  const roomStakeRatioPercent =
    keySupply != null && keySupply > 0
      ? Math.min(100, Math.max(0, Math.round((stakedSupplyValue / keySupply) * 100)))
      : null

  const tier = onchain.tier ?? normalizeTier(row.tier)
  const roomType = onchain.roomType ?? normalizeRoomType(row.room_type) ?? 'trading'
  if (roomType !== 'trading') return null
  const resolvedTier = tier ?? 'club'

  const distributionPotUsdc = normalizeMaybeUsdc(
    parseNumber(row.fund_size_raw) ?? parseNumber(row.pot_raw),
  )
  const feeBaselinePotUsdc =
    keySupply != null && keySupply > 0
      ? poolFeeBaselineUsdc(roomType, resolvedTier, keySupply)
      : 0

  const treasuryResolved = resolveTreasuryWallet({
    tradingWalletOverride: options?.tradingWalletOverride ?? null,
    envMapWallet: lookupTradingWalletFromEnv(normalizedRoomId),
    snapshotTradingWallet: row.treasury_wallet_raw ?? tradingWalletHint,
    appWalletFromProfile,
    creatorAddress,
  })
  const treasuryWalletForReads =
    treasuryResolved.source === 'creator_fallback' ? null : treasuryResolved.address
  const treasury = await readTreasuryUsd(treasuryWalletForReads)
  const { attackModelPotUsdc, attackPotSource } = resolveAttackModelPotUsdc({
    distributionPotUsdc,
    feeBaselinePotUsdc,
    totalTreasuryUsdc: treasury.totalTreasuryUsdc,
  })
  const { suggestedPotUsdc, potSource } = resolveSuggestedPotUsdc({
    distributionPotUsdc,
    feeBaselinePotUsdc,
    totalTreasuryUsdc: treasury.totalTreasuryUsdc,
  })

  const labels = resolveRoomLabelFields(row)

  return {
    roomId: normalizedRoomId,
    tokenId: normalizedRoomId,
    roomName: labels.roomName,
    displayLabel: labels.displayLabel,
    creatorHandle: labels.creatorHandle,
    creatorAddress,
    tier: resolvedTier,
    roomType,
    keySupply,
    volumeUsdc: normalizeMaybeUsdc(parseNumber(row.volume_col_raw) ?? parseNumber(row.volume_raw)),
    hostWalletKeys,
    hostStakedKeys,
    hostKeys,
    hostSharePercent,
    stakedSupply: stakedSupplyValue,
    hostStakeRatioPercent,
    stakeRatioPercent: roomStakeRatioPercent,
    distributionPotUsdc,
    feeBaselinePotUsdc,
    attackModelPotUsdc,
    attackPotSource,
    suggestedPotUsdc,
    potSource,
    totalTreasuryUsdc: treasury.totalTreasuryUsdc,
    hyperliquidAccountValueUsd: treasury.hyperliquidAccountValueUsd,
    debankTotalUsd: treasury.debankTotalUsd,
    tradingWalletAddress: treasuryResolved.address,
    treasuryWalletSource: treasuryResolved.source,
    knownOtherHolders,
    sources: {
      keySupply: onchain.keySupply != null ? 'onchain' : 'snapshot',
      hostWalletKeys: hostWalletSource,
      hostStakedKeys: hostStakedSource,
      stakedSupply: stakedSupplySource,
      tier: onchain.tier != null ? 'onchain' : 'snapshot',
      roomType: onchain.roomType != null ? 'onchain' : 'snapshot',
    },
  }
}
