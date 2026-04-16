import type { AgentCapabilityResponse, AgentMembership, MembershipStatusReason } from '../../../api/_handlers/v1/agents/_accessSchemas.js'
import { checkSharesEligibility } from '../keepr/keeprGating.js'
import { ensureKeeprSchema } from '../keepr/keeprSchema.js'
import { getDb } from '../db/postgres.js'
import { ensureTelegramTradingSchema } from '../messaging/telegramTrading.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

type VaultAccessRow = {
  vault_address: string
  share_token_address: string
  group_id: string
  min_shares: string | null
  chain_id: number
  gating_enabled: boolean
  gating_mode: string
  join_locked: boolean
}

type TelegramRoomAccessRow = {
  vault_address: string
  share_token_address: string
  room_chat_id: string
  min_shares_raw: string
  grace_hours: number
}

type SharesEligibilitySnapshot = {
  qualified: boolean
  minBalance: string
  actualBalance: string
  statusReason: MembershipStatusReason
}

const MEMBERSHIP_ORDER: Record<AgentMembership['type'], number> = {
  xmtp: 0,
  telegram: 1,
  'vault-ui': 2,
  governance: 3,
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  const text = String(value ?? '').trim().toLowerCase()
  return isAddressLike(text) ? (text as `0x${string}`) : null
}

function toPositiveBigInt(raw: string | null | undefined, fallback: bigint): bigint {
  const text = String(raw ?? '').trim()
  if (!text) return fallback
  try {
    const parsed = BigInt(text)
    return parsed > 0n ? parsed : fallback
  } catch {
    return fallback
  }
}

function resolveStatusReason(params: { eligible: boolean; reason: string }): MembershipStatusReason {
  if (params.eligible) return 'qualified'
  if (params.reason === 'share_balance<threshold') return 'insufficient_balance'
  if (params.reason === 'onchain_read_failed') return 'unsupported_chain'
  return 'not_found'
}

async function computeEligibility(params: {
  wallet: `0x${string}`
  shareToken: `0x${string}`
  minBalance: bigint
  chainId: number
  cache: Map<string, SharesEligibilitySnapshot>
}): Promise<SharesEligibilitySnapshot> {
  const cacheKey = `${params.chainId}:${params.wallet}:${params.shareToken}:${params.minBalance.toString()}`
  const cached = params.cache.get(cacheKey)
  if (cached) return cached

  if (params.chainId !== 8453) {
    const unsupported: SharesEligibilitySnapshot = {
      qualified: false,
      minBalance: params.minBalance.toString(),
      actualBalance: '0',
      statusReason: 'unsupported_chain',
    }
    params.cache.set(cacheKey, unsupported)
    return unsupported
  }

  const eligibility = await checkSharesEligibility({
    wallet: params.wallet,
    shareToken: params.shareToken,
    minShares: params.minBalance,
  })

  const snapshot: SharesEligibilitySnapshot = {
    qualified: eligibility.eligible,
    minBalance: params.minBalance.toString(),
    actualBalance: String(eligibility.evidence.shareBalance),
    statusReason: resolveStatusReason({
      eligible: eligibility.eligible,
      reason: eligibility.reason,
    }),
  }
  params.cache.set(cacheKey, snapshot)
  return snapshot
}

function sortMemberships(memberships: AgentMembership[]): AgentMembership[] {
  return memberships.sort((a, b) => {
    const typeOrderA = MEMBERSHIP_ORDER[a.type]
    const typeOrderB = MEMBERSHIP_ORDER[b.type]
    if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB
    if (a.roomKey !== b.roomKey) return a.roomKey.localeCompare(b.roomKey)
    return a.shareToken.localeCompare(b.shareToken)
  })
}

async function readVaultAccessRows(db: Db, params: {
  chainId: number
  shareToken?: `0x${string}` | undefined
}): Promise<VaultAccessRow[]> {
  const filterShareToken = params.shareToken ? params.shareToken.toLowerCase() : null
  const result = await db.sql`
    SELECT
      vault_address,
      share_token_address,
      group_id,
      min_shares,
      chain_id,
      gating_enabled,
      gating_mode,
      join_locked
    FROM keepr_vaults
    WHERE chain_id = ${params.chainId}
      AND share_token_address IS NOT NULL
      AND (${filterShareToken} IS NULL OR LOWER(share_token_address) = ${filterShareToken})
    ORDER BY vault_address ASC;
  `
  return (result.rows ?? []) as VaultAccessRow[]
}

async function readTelegramRoomRows(db: Db, params: {
  chainId: number
  shareToken?: `0x${string}` | undefined
}): Promise<TelegramRoomAccessRow[]> {
  const filterShareToken = params.shareToken ? params.shareToken.toLowerCase() : null
  const result = await db.sql`
    SELECT
      p.vault_address,
      v.share_token_address,
      p.room_chat_id,
      p.min_shares_raw,
      p.grace_hours
    FROM telegram_holder_room_policies p
    INNER JOIN keepr_vaults v ON LOWER(v.vault_address) = LOWER(p.vault_address)
    WHERE p.enabled = true
      AND v.chain_id = ${params.chainId}
      AND v.share_token_address IS NOT NULL
      AND (${filterShareToken} IS NULL OR LOWER(v.share_token_address) = ${filterShareToken})
    ORDER BY p.room_chat_id ASC;
  `
  return (result.rows ?? []) as TelegramRoomAccessRow[]
}

function uniqueMemberships(memberships: AgentMembership[]): AgentMembership[] {
  const deduped = new Map<string, AgentMembership>()
  for (const membership of memberships) {
    const key = `${membership.type}::${membership.roomKey}::${membership.shareToken}`
    if (!deduped.has(key)) deduped.set(key, membership)
  }
  return Array.from(deduped.values())
}

export async function resolveAgentCapabilityResponse(params: {
  wallet: `0x${string}`
  chainId: number
  shareToken?: `0x${string}` | undefined
  resolverVersion?: number
  issuedAt?: Date
}): Promise<AgentCapabilityResponse> {
  const wallet = params.wallet.toLowerCase() as `0x${string}`
  const chainId = Math.max(1, Math.floor(Number(params.chainId) || 0))
  const resolverVersion = Math.max(1, Math.floor(Number(params.resolverVersion ?? 1)))
  const issuedAt = (params.issuedAt ?? new Date()).toISOString()
  const filterShareToken = params.shareToken ? (params.shareToken.toLowerCase() as `0x${string}`) : undefined

  const baseResponse: AgentCapabilityResponse = {
    schema: '4626-agent-capability-response-v1',
    wallet,
    chainId,
    resolverVersion,
    issuedAt,
    memberships: [],
  }

  const db = (await getDb()) as Db | null
  if (!db) return baseResponse

  await ensureKeeprSchema()
  await ensureTelegramTradingSchema(db as any)

  const [vaultRows, telegramRows] = await Promise.all([
    readVaultAccessRows(db, { chainId, shareToken: filterShareToken }),
    readTelegramRoomRows(db, { chainId, shareToken: filterShareToken }),
  ])

  const memberships: AgentMembership[] = []
  const eligibilityCache = new Map<string, SharesEligibilitySnapshot>()

  for (const row of vaultRows) {
    const vaultAddress = normalizeAddress(row.vault_address)
    const shareToken = normalizeAddress(row.share_token_address)
    if (!vaultAddress || !shareToken) continue
    const isGated = Boolean(row.gating_enabled) && String(row.gating_mode ?? 'shares').toLowerCase() === 'shares'
    const minShares = isGated ? toPositiveBigInt(row.min_shares, 1n) : 0n
    const eligibility = isGated
      ? await computeEligibility({
          wallet,
          shareToken,
          minBalance: minShares,
          chainId,
          cache: eligibilityCache,
        })
      : {
          qualified: true,
          minBalance: '0',
          actualBalance: '0',
          statusReason: 'qualified' as MembershipStatusReason,
        }

    const statusReason: MembershipStatusReason = row.join_locked ? 'revoked' : eligibility.statusReason
    const qualified = !row.join_locked && eligibility.qualified

    memberships.push({
      type: 'xmtp',
      shareToken,
      vault: vaultAddress,
      roomKey: `xmtp:${String(row.group_id ?? '').trim()}`,
      qualified,
      minBalance: eligibility.minBalance,
      actualBalance: eligibility.actualBalance,
      accessTokenRequired: true,
      statusReason,
    })

    memberships.push({
      type: 'vault-ui',
      shareToken,
      vault: vaultAddress,
      roomKey: `vault-ui:${vaultAddress}`,
      qualified,
      minBalance: eligibility.minBalance,
      actualBalance: eligibility.actualBalance,
      accessTokenRequired: true,
      statusReason,
    })

    memberships.push({
      type: 'governance',
      shareToken,
      vault: vaultAddress,
      roomKey: `governance:${shareToken}`,
      qualified,
      minBalance: eligibility.minBalance,
      actualBalance: eligibility.actualBalance,
      accessTokenRequired: true,
      statusReason,
    })
  }

  for (const row of telegramRows) {
    const vaultAddress = normalizeAddress(row.vault_address)
    const shareToken = normalizeAddress(row.share_token_address)
    const roomChatId = String(row.room_chat_id ?? '').trim()
    if (!vaultAddress || !shareToken || !roomChatId) continue
    const minShares = toPositiveBigInt(row.min_shares_raw, 1n)
    const eligibility = await computeEligibility({
      wallet,
      shareToken,
      minBalance: minShares,
      chainId,
      cache: eligibilityCache,
    })
    memberships.push({
      type: 'telegram',
      shareToken,
      vault: vaultAddress,
      roomKey: `telegram:${roomChatId}`,
      qualified: eligibility.qualified,
      minBalance: eligibility.minBalance,
      actualBalance: eligibility.actualBalance,
      gracePeriodSeconds: Math.max(0, Math.floor(Number(row.grace_hours) || 0)) * 3600,
      accessTokenRequired: true,
      statusReason: eligibility.statusReason,
    })
  }

  return {
    ...baseResponse,
    memberships: sortMemberships(uniqueMemberships(memberships)),
  }
}

export async function resolveMembershipForRoom(params: {
  wallet: `0x${string}`
  chainId: number
  shareToken: `0x${string}`
  roomKey: string
}): Promise<AgentMembership | null> {
  const response = await resolveAgentCapabilityResponse({
    wallet: params.wallet,
    chainId: params.chainId,
    shareToken: params.shareToken,
  })
  const normalizedShareToken = params.shareToken.toLowerCase()
  const normalizedRoomKey = String(params.roomKey ?? '').trim()
  return (
    response.memberships.find(
      (membership) =>
        membership.shareToken.toLowerCase() === normalizedShareToken &&
        membership.roomKey === normalizedRoomKey,
    ) ?? null
  )
}
