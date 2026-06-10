import { erc20Abi, parseAbi, type Address } from 'viem'

import { getDb } from '../db/postgres.js'
import { getKeeprBaseRpcUrls } from '../keepr/keeprGating.js'
import { getAlfaClubPublicClient } from '../wallet/alfaclub.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'

const ALFA_CREATOR_KEY_POOL_ABI = parseAbi([
  'function quoteBuyKeys(uint256 keyAmount) view returns (uint256 creatorCoinAmountIn)',
])

const BPS_BASE = 10_000n

type RoomAccessStatus = 'pending' | 'active' | 'grace' | 'removed' | 'unknown_stale'

export type AlfaClubRoomAccessPolicy = {
  roomId: string
  tokenId: string
  creatorCoinAddress: `0x${string}`
  poolAddress: `0x${string}`
  keyAmountRaw: string
  enterThresholdBps: number
  exitThresholdBps: number
  graceHours: number
  enabled: boolean
}

export type AlfaClubRoomAccessMembership = {
  roomId: string
  walletAddress: `0x${string}`
  status: RoomAccessStatus
  creatorCoinBalanceRaw: string | null
  quoteThresholdRaw: string | null
  lastCheckedAt: string | null
  lastEligibleAt: string | null
  graceStartedAt: string | null
  failureReason: string | null
}

type EligibilityReason =
  | 'balance>=enter_threshold'
  | 'balance>=exit_threshold'
  | 'balance<enter_threshold'
  | 'balance<exit_threshold'
  | 'onchain_read_failed'

type EligibilityEvidence = {
  creatorCoinBalanceRaw: string
  quoteThresholdRaw: string
  enterThresholdRaw: string
  exitThresholdRaw: string
  blockNumber: number | null
  rpcUrl: string | null
}

type EligibilityResult = {
  canEnter: boolean
  canStayActive: boolean
  reason: EligibilityReason
  evidence: EligibilityEvidence
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(trimmed)) return null
  return trimmed as `0x${string}`
}

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

function mapPolicy(row: any): AlfaClubRoomAccessPolicy | null {
  const roomId = normalizeRoomId(row?.room_id)
  const creatorCoinAddress = normalizeAddress(row?.creator_coin_address)
  const poolAddress = normalizeAddress(row?.pool_address)
  if (!roomId || !creatorCoinAddress || !poolAddress) return null
  return {
    roomId,
    tokenId: String(row.token_id ?? ''),
    creatorCoinAddress,
    poolAddress,
    keyAmountRaw: String(row.key_amount_raw ?? '1'),
    enterThresholdBps: Number(row.enter_threshold_bps ?? 10_000),
    exitThresholdBps: Number(row.exit_threshold_bps ?? 9_000),
    graceHours: Number(row.grace_hours ?? 24),
    enabled: Boolean(row.enabled),
  }
}

function mapMembership(row: any): AlfaClubRoomAccessMembership | null {
  const roomId = normalizeRoomId(row?.room_id)
  const walletAddress = normalizeAddress(row?.wallet_address)
  if (!roomId || !walletAddress) return null
  return {
    roomId,
    walletAddress,
    status: String(row.status ?? 'pending') as RoomAccessStatus,
    creatorCoinBalanceRaw:
      row.creator_coin_balance_raw === null || row.creator_coin_balance_raw === undefined
        ? null
        : String(row.creator_coin_balance_raw),
    quoteThresholdRaw:
      row.quote_threshold_raw === null || row.quote_threshold_raw === undefined
        ? null
        : String(row.quote_threshold_raw),
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
    lastEligibleAt: row.last_eligible_at ? new Date(row.last_eligible_at).toISOString() : null,
    graceStartedAt: row.grace_started_at ? new Date(row.grace_started_at).toISOString() : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
  }
}

function applyBps(value: bigint, bps: number): bigint {
  const normalized = BigInt(Math.max(0, Math.min(20_000, Math.floor(bps))))
  return (value * normalized) / BPS_BASE
}

async function checkRoomEligibility(params: {
  walletAddress: `0x${string}`
  policy: AlfaClubRoomAccessPolicy
  rpcUrls?: string[]
}): Promise<EligibilityResult> {
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  const keyAmount = BigInt(params.policy.keyAmountRaw)
  const urls =
    Array.isArray(params.rpcUrls) && params.rpcUrls.length > 0
      ? params.rpcUrls
      : getKeeprBaseRpcUrls()

  for (const url of urls) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(url, { timeout: 12_000 }),
      })

      let blockNumber: number | null = null
      try {
        blockNumber = Number(await client.getBlockNumber())
      } catch {
        blockNumber = null
      }

      const [quoteRaw, balanceRaw] = await Promise.all([
        client.readContract({
          address: params.policy.poolAddress as Address,
          abi: ALFA_CREATOR_KEY_POOL_ABI,
          functionName: 'quoteBuyKeys',
          args: [keyAmount],
        }) as Promise<bigint>,
        client.readContract({
          address: params.policy.creatorCoinAddress as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [params.walletAddress as Address],
        }) as Promise<bigint>,
      ])

      const enterThreshold = applyBps(quoteRaw, params.policy.enterThresholdBps)
      const exitThreshold = applyBps(quoteRaw, params.policy.exitThresholdBps)
      const canEnter = balanceRaw >= enterThreshold
      const canStayActive = balanceRaw >= exitThreshold

      let reason: EligibilityReason = 'balance<enter_threshold'
      if (canEnter) reason = 'balance>=enter_threshold'
      else if (canStayActive) reason = 'balance>=exit_threshold'
      else if (balanceRaw < exitThreshold) reason = 'balance<exit_threshold'

      return {
        canEnter,
        canStayActive,
        reason,
        evidence: {
          creatorCoinBalanceRaw: balanceRaw.toString(),
          quoteThresholdRaw: quoteRaw.toString(),
          enterThresholdRaw: enterThreshold.toString(),
          exitThresholdRaw: exitThreshold.toString(),
          blockNumber: Number.isFinite(blockNumber ?? NaN) ? blockNumber : null,
          rpcUrl: url,
        },
      }
    } catch {
      continue
    }
  }

  return {
    canEnter: false,
    canStayActive: false,
    reason: 'onchain_read_failed',
    evidence: {
      creatorCoinBalanceRaw: '0',
      quoteThresholdRaw: '0',
      enterThresholdRaw: '0',
      exitThresholdRaw: '0',
      blockNumber: null,
      rpcUrl: null,
    },
  }
}

export async function readAlfaClubRoomAccessPolicy(roomId: string): Promise<AlfaClubRoomAccessPolicy | null> {
  const db = await getDb()
  if (!db) return null
  await ensureAlfaClubVigilanteSchema()
  const normalizedRoomId = normalizeRoomId(roomId)
  if (!normalizedRoomId) return null
  const res = await db.sql`
    SELECT * FROM alfaclub.room_access_policies
    WHERE room_id = ${normalizedRoomId}
    LIMIT 1;
  `
  return res.rows?.[0] ? mapPolicy(res.rows[0]) : null
}

export async function upsertAlfaClubRoomAccessPolicy(params: {
  roomId: string
  tokenId: string
  creatorCoinAddress: `0x${string}`
  poolAddress: `0x${string}`
  keyAmountRaw?: string | null
  enterThresholdBps?: number | null
  exitThresholdBps?: number | null
  graceHours?: number | null
  enabled?: boolean
  actorAddress?: `0x${string}` | null
}): Promise<AlfaClubRoomAccessPolicy> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureAlfaClubVigilanteSchema()

  const roomId = normalizeRoomId(params.roomId)
  if (!roomId) throw new Error('invalid_room_id')
  const creatorCoinAddress = normalizeAddress(params.creatorCoinAddress)
  if (!creatorCoinAddress) throw new Error('invalid_creator_coin_address')
  const poolAddress = normalizeAddress(params.poolAddress)
  if (!poolAddress) throw new Error('invalid_pool_address')
  const keyAmountRaw = String(params.keyAmountRaw ?? '1').trim()
  if (!/^\d+$/.test(keyAmountRaw) || BigInt(keyAmountRaw) <= 0n) throw new Error('invalid_key_amount_raw')
  const enterThresholdBps = Math.max(0, Math.min(20_000, Math.floor(params.enterThresholdBps ?? 10_000)))
  const exitThresholdBps = Math.max(0, Math.min(20_000, Math.floor(params.exitThresholdBps ?? 9_000)))
  if (exitThresholdBps > enterThresholdBps) throw new Error('invalid_threshold_bps')
  const graceHours = Math.max(0, Math.min(720, Math.floor(params.graceHours ?? 24)))

  await db.sql`
    INSERT INTO alfaclub.room_access_policies (
      room_id,
      token_id,
      creator_coin_address,
      pool_address,
      key_amount_raw,
      enter_threshold_bps,
      exit_threshold_bps,
      grace_hours,
      enabled,
      created_by,
      updated_by,
      updated_at
    ) VALUES (
      ${roomId},
      ${params.tokenId},
      ${creatorCoinAddress},
      ${poolAddress},
      ${keyAmountRaw},
      ${enterThresholdBps},
      ${exitThresholdBps},
      ${graceHours},
      ${params.enabled ?? false},
      ${params.actorAddress ?? null},
      ${params.actorAddress ?? null},
      NOW()
    )
    ON CONFLICT (room_id) DO UPDATE SET
      token_id = EXCLUDED.token_id,
      creator_coin_address = EXCLUDED.creator_coin_address,
      pool_address = EXCLUDED.pool_address,
      key_amount_raw = EXCLUDED.key_amount_raw,
      enter_threshold_bps = EXCLUDED.enter_threshold_bps,
      exit_threshold_bps = EXCLUDED.exit_threshold_bps,
      grace_hours = EXCLUDED.grace_hours,
      enabled = EXCLUDED.enabled,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW();
  `

  const policy = await readAlfaClubRoomAccessPolicy(roomId)
  if (!policy) throw new Error('policy_upsert_failed')
  return policy
}

export async function readAlfaClubRoomAccessMembership(params: {
  roomId: string
  walletAddress: `0x${string}`
}): Promise<AlfaClubRoomAccessMembership | null> {
  const db = await getDb()
  if (!db) return null
  await ensureAlfaClubVigilanteSchema()
  const roomId = normalizeRoomId(params.roomId)
  const walletAddress = normalizeAddress(params.walletAddress)
  if (!roomId || !walletAddress) return null
  const res = await db.sql`
    SELECT * FROM alfaclub.room_access_memberships
    WHERE room_id = ${roomId}
      AND wallet_address = ${walletAddress}
    LIMIT 1;
  `
  return res.rows?.[0] ? mapMembership(res.rows[0]) : null
}

async function writeMembership(params: {
  roomId: string
  walletAddress: `0x${string}`
  status: RoomAccessStatus
  creatorCoinBalanceRaw?: string | null
  quoteThresholdRaw?: string | null
  failureReason?: string | null
}): Promise<AlfaClubRoomAccessMembership> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureAlfaClubVigilanteSchema()

  const roomId = normalizeRoomId(params.roomId)
  if (!roomId) throw new Error('invalid_room_id')
  const walletAddress = normalizeAddress(params.walletAddress)
  if (!walletAddress) throw new Error('invalid_wallet_address')

  await db.sql`
    INSERT INTO alfaclub.room_access_memberships (
      room_id,
      wallet_address,
      status,
      creator_coin_balance_raw,
      quote_threshold_raw,
      last_checked_at,
      last_eligible_at,
      grace_started_at,
      failure_reason,
      updated_at
    ) VALUES (
      ${roomId},
      ${walletAddress},
      ${params.status},
      ${params.creatorCoinBalanceRaw ?? null},
      ${params.quoteThresholdRaw ?? null},
      NOW(),
      ${params.status === 'active' ? new Date() : null},
      ${params.status === 'grace' ? new Date() : null},
      ${params.failureReason ?? null},
      NOW()
    )
    ON CONFLICT (room_id, wallet_address) DO UPDATE SET
      status = EXCLUDED.status,
      creator_coin_balance_raw = EXCLUDED.creator_coin_balance_raw,
      quote_threshold_raw = EXCLUDED.quote_threshold_raw,
      last_checked_at = NOW(),
      last_eligible_at = CASE
        WHEN EXCLUDED.status = 'active' THEN NOW()
        ELSE alfaclub.room_access_memberships.last_eligible_at
      END,
      grace_started_at = CASE
        WHEN EXCLUDED.status = 'grace' THEN COALESCE(alfaclub.room_access_memberships.grace_started_at, NOW())
        WHEN EXCLUDED.status = 'active' THEN NULL
        ELSE alfaclub.room_access_memberships.grace_started_at
      END,
      failure_reason = EXCLUDED.failure_reason,
      updated_at = NOW();
  `

  const membership = await readAlfaClubRoomAccessMembership({ roomId, walletAddress })
  if (!membership) throw new Error('membership_write_failed')
  return membership
}

export async function joinAlfaClubRoomAccess(params: {
  roomId: string
  walletAddress: `0x${string}`
}): Promise<{
  policy: AlfaClubRoomAccessPolicy
  membership: AlfaClubRoomAccessMembership
  eligible: boolean
  reason: EligibilityReason
}> {
  const policy = await readAlfaClubRoomAccessPolicy(params.roomId)
  if (!policy || !policy.enabled) throw new Error('alfaclub_room_access_not_enabled')

  const eligibility = await checkRoomEligibility({
    walletAddress: params.walletAddress,
    policy,
  })
  const membership = await writeMembership({
    roomId: policy.roomId,
    walletAddress: params.walletAddress,
    status: eligibility.canEnter ? 'active' : eligibility.reason === 'onchain_read_failed' ? 'unknown_stale' : 'pending',
    creatorCoinBalanceRaw: eligibility.evidence.creatorCoinBalanceRaw,
    quoteThresholdRaw: eligibility.evidence.quoteThresholdRaw,
    failureReason: eligibility.canEnter ? null : eligibility.reason,
  })

  return { policy, membership, eligible: eligibility.canEnter, reason: eligibility.reason }
}

export async function recheckAlfaClubRoomAccessMemberships(params: {
  roomId: string
  limit?: number
}): Promise<{ checked: number; autoEntered: number; removed: number; stale: number }> {
  const policy = await readAlfaClubRoomAccessPolicy(params.roomId)
  if (!policy || !policy.enabled) return { checked: 0, autoEntered: 0, removed: 0, stale: 0 }
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureAlfaClubVigilanteSchema()

  const limit = Math.max(1, Math.min(250, Math.floor(params.limit ?? 100)))
  const members = await db.sql`
    SELECT * FROM alfaclub.room_access_memberships
    WHERE room_id = ${policy.roomId}
      AND status IN ('active', 'grace', 'pending', 'removed', 'unknown_stale')
    ORDER BY last_checked_at NULLS FIRST, updated_at ASC
    LIMIT ${limit};
  `

  let checked = 0
  let autoEntered = 0
  let removed = 0
  let stale = 0

  for (const row of members.rows ?? []) {
    const membership = mapMembership(row)
    if (!membership) continue
    checked += 1
    const eligibility = await checkRoomEligibility({
      walletAddress: membership.walletAddress,
      policy,
    })

    if (eligibility.reason === 'onchain_read_failed') {
      stale += 1
      await writeMembership({
        roomId: policy.roomId,
        walletAddress: membership.walletAddress,
        status: 'unknown_stale',
        creatorCoinBalanceRaw: eligibility.evidence.creatorCoinBalanceRaw,
        quoteThresholdRaw: eligibility.evidence.quoteThresholdRaw,
        failureReason: eligibility.reason,
      })
      continue
    }

    if (eligibility.canEnter) {
      const wasActive = membership.status === 'active'
      await writeMembership({
        roomId: policy.roomId,
        walletAddress: membership.walletAddress,
        status: 'active',
        creatorCoinBalanceRaw: eligibility.evidence.creatorCoinBalanceRaw,
        quoteThresholdRaw: eligibility.evidence.quoteThresholdRaw,
        failureReason: null,
      })
      if (!wasActive) autoEntered += 1
      continue
    }

    if (eligibility.canStayActive && membership.status === 'active') {
      await writeMembership({
        roomId: policy.roomId,
        walletAddress: membership.walletAddress,
        status: 'active',
        creatorCoinBalanceRaw: eligibility.evidence.creatorCoinBalanceRaw,
        quoteThresholdRaw: eligibility.evidence.quoteThresholdRaw,
        failureReason: 'balance>=exit_threshold',
      })
      continue
    }

    const graceStartedAt = membership.graceStartedAt ? new Date(membership.graceStartedAt).getTime() : Date.now()
    const graceExpired = Date.now() - graceStartedAt > policy.graceHours * 60 * 60 * 1000
    if (!graceExpired) {
      await writeMembership({
        roomId: policy.roomId,
        walletAddress: membership.walletAddress,
        status: 'grace',
        creatorCoinBalanceRaw: eligibility.evidence.creatorCoinBalanceRaw,
        quoteThresholdRaw: eligibility.evidence.quoteThresholdRaw,
        failureReason: eligibility.reason,
      })
      continue
    }

    await writeMembership({
      roomId: policy.roomId,
      walletAddress: membership.walletAddress,
      status: 'removed',
      creatorCoinBalanceRaw: eligibility.evidence.creatorCoinBalanceRaw,
      quoteThresholdRaw: eligibility.evidence.quoteThresholdRaw,
      failureReason: eligibility.reason,
    })
    removed += 1
  }

  return { checked, autoEntered, removed, stale }
}

export async function preloadAlfaClubRoomAccessPolicyPoolAddress(params: {
  roomId: string
  creatorCoinAddress: `0x${string}`
  tokenId: string
}): Promise<`0x${string}` | null> {
  const roomId = normalizeRoomId(params.roomId)
  const creatorCoinAddress = normalizeAddress(params.creatorCoinAddress)
  if (!roomId || !creatorCoinAddress) return null
  const tokenId = BigInt(params.tokenId)

  const client = await getAlfaClubPublicClient()
  const factoryAddress = normalizeAddress(process.env.VITE_ALFA_CREATOR_KEY_LP_FACTORY)
  if (!factoryAddress) return null

  const ALFA_CREATOR_KEY_LP_FACTORY_ABI = parseAbi([
    'function getPool(address creatorCoin, uint256 tokenId) view returns (address)',
  ])

  try {
    const pool = (await client.readContract({
      address: factoryAddress as Address,
      abi: ALFA_CREATOR_KEY_LP_FACTORY_ABI,
      functionName: 'getPool',
      args: [creatorCoinAddress as Address, tokenId],
    })) as Address
    const normalizedPool = normalizeAddress(pool)
    if (!normalizedPool) return null
    if (normalizedPool === '0x0000000000000000000000000000000000000000') return null
    return normalizedPool
  } catch {
    return null
  }
}
