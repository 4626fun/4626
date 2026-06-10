import type { Address } from 'viem'

import { getDb } from '../db/postgres.js'
import { checkSharesEligibility } from '../keepr/keeprGating.js'
import { enqueueKeeprAction, getKeeprVaultByVaultAddress } from '../keepr/keeprRegistry.js'
import { ensureChatSchema } from '../db/schemaBootstrap.js'
import { normalizeChatAddress } from './presence.js'

export type VaultChatPolicy = {
  vaultAddress: `0x${string}`
  groupId: string | null
  creatorAddress: `0x${string}` | null
  shareTokenAddress: `0x${string}` | null
  minHoldingRaw: string
  graceHours: number
  enabled: boolean
}

export type VaultChatMembership = {
  vaultAddress: `0x${string}`
  walletAddress: `0x${string}`
  status: string
  balanceRaw: string | null
  lastCheckedAt: string | null
  lastEligibleAt: string | null
  graceStartedAt: string | null
  failureReason: string | null
}

function toAddress(value: unknown): `0x${string}` | null {
  return normalizeChatAddress(value)
}

function mapPolicy(row: any): VaultChatPolicy | null {
  const vaultAddress = toAddress(row?.vault_address)
  if (!vaultAddress) return null
  return {
    vaultAddress,
    groupId: row.group_id ? String(row.group_id) : null,
    creatorAddress: toAddress(row.creator_address),
    shareTokenAddress: toAddress(row.share_token_address),
    minHoldingRaw: String(row.min_holding_raw ?? '0'),
    graceHours: Number(row.grace_hours ?? 24),
    enabled: Boolean(row.enabled),
  }
}

function mapMembership(row: any): VaultChatMembership | null {
  const vaultAddress = toAddress(row?.vault_address)
  const walletAddress = toAddress(row?.wallet_address)
  if (!vaultAddress || !walletAddress) return null
  return {
    vaultAddress,
    walletAddress,
    status: String(row.status ?? 'pending'),
    balanceRaw: row.balance_raw === null || row.balance_raw === undefined ? null : String(row.balance_raw),
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
    lastEligibleAt: row.last_eligible_at ? new Date(row.last_eligible_at).toISOString() : null,
    graceStartedAt: row.grace_started_at ? new Date(row.grace_started_at).toISOString() : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
  }
}

export async function readVaultChatPolicy(vaultAddress: `0x${string}`): Promise<VaultChatPolicy | null> {
  const db = await getDb()
  if (!db) return null
  await ensureChatSchema(db)
  const normalized = String(vaultAddress).toLowerCase() as `0x${string}`
  const res = await db.sql`SELECT * FROM vault_chat_policies WHERE vault_address = ${normalized} LIMIT 1;`
  const direct = res.rows?.[0] ? mapPolicy(res.rows[0]) : null
  if (direct) return direct

  const keepr = await getKeeprVaultByVaultAddress(normalized)
  if (!keepr) return null
  return {
    vaultAddress: normalized,
    groupId: keepr.groupId,
    creatorAddress: keepr.canonicalOwnerAddress,
    shareTokenAddress: keepr.shareTokenAddress,
    minHoldingRaw: keepr.minShares ?? '0',
    graceHours: 24,
    enabled: keepr.gatingEnabled,
  }
}

export async function upsertVaultChatPolicy(params: {
  vaultAddress: `0x${string}`
  groupId?: string | null
  creatorAddress?: `0x${string}` | null
  shareTokenAddress?: `0x${string}` | null
  minHoldingRaw?: string | null
  graceHours?: number | null
  enabled?: boolean
  actorAddress?: `0x${string}` | null
}): Promise<VaultChatPolicy> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureChatSchema(db)

  const vaultAddress = String(params.vaultAddress).toLowerCase() as `0x${string}`
  const minHoldingRaw = String(params.minHoldingRaw ?? '0').trim()
  if (!/^\d+$/.test(minHoldingRaw)) throw new Error('invalid_min_holding_raw')
  const graceHours = Math.max(0, Math.min(720, Math.floor(params.graceHours ?? 24)))

  await db.sql`
    INSERT INTO vault_chat_policies (
      vault_address,
      group_id,
      creator_address,
      share_token_address,
      min_holding_raw,
      grace_hours,
      enabled,
      created_by,
      updated_by,
      updated_at
    ) VALUES (
      ${vaultAddress},
      ${params.groupId ?? null},
      ${params.creatorAddress ? String(params.creatorAddress).toLowerCase() : null},
      ${params.shareTokenAddress ? String(params.shareTokenAddress).toLowerCase() : null},
      ${minHoldingRaw},
      ${graceHours},
      ${params.enabled ?? false},
      ${params.actorAddress ? String(params.actorAddress).toLowerCase() : null},
      ${params.actorAddress ? String(params.actorAddress).toLowerCase() : null},
      NOW()
    )
    ON CONFLICT (vault_address) DO UPDATE SET
      group_id = EXCLUDED.group_id,
      creator_address = EXCLUDED.creator_address,
      share_token_address = EXCLUDED.share_token_address,
      min_holding_raw = EXCLUDED.min_holding_raw,
      grace_hours = EXCLUDED.grace_hours,
      enabled = EXCLUDED.enabled,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW();
  `

  const policy = await readVaultChatPolicy(vaultAddress)
  if (!policy) throw new Error('policy_upsert_failed')
  return policy
}

export async function readVaultChatMembership(params: {
  vaultAddress: `0x${string}`
  walletAddress: `0x${string}`
}): Promise<VaultChatMembership | null> {
  const db = await getDb()
  if (!db) return null
  await ensureChatSchema(db)
  const res = await db.sql`
    SELECT * FROM vault_chat_memberships
    WHERE vault_address = ${String(params.vaultAddress).toLowerCase()}
      AND wallet_address = ${String(params.walletAddress).toLowerCase()}
    LIMIT 1;
  `
  return res.rows?.[0] ? mapMembership(res.rows[0]) : null
}

async function writeMembership(params: {
  vaultAddress: `0x${string}`
  walletAddress: `0x${string}`
  status: string
  balanceRaw?: string | null
  failureReason?: string | null
  addActionId?: number | null
  removeActionId?: number | null
}): Promise<VaultChatMembership> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureChatSchema(db)

  await db.sql`
    INSERT INTO vault_chat_memberships (
      vault_address,
      wallet_address,
      status,
      balance_raw,
      last_checked_at,
      last_eligible_at,
      grace_started_at,
      add_action_id,
      remove_action_id,
      failure_reason,
      updated_at
    ) VALUES (
      ${params.vaultAddress},
      ${params.walletAddress},
      ${params.status},
      ${params.balanceRaw ?? null},
      NOW(),
      ${params.status === 'active' ? new Date() : null},
      ${params.status === 'grace' ? new Date() : null},
      ${params.addActionId ?? null},
      ${params.removeActionId ?? null},
      ${params.failureReason ?? null},
      NOW()
    )
    ON CONFLICT (vault_address, wallet_address) DO UPDATE SET
      status = EXCLUDED.status,
      balance_raw = EXCLUDED.balance_raw,
      last_checked_at = NOW(),
      last_eligible_at = CASE WHEN EXCLUDED.status = 'active' THEN NOW() ELSE vault_chat_memberships.last_eligible_at END,
      grace_started_at = CASE
        WHEN EXCLUDED.status = 'grace' THEN COALESCE(vault_chat_memberships.grace_started_at, NOW())
        WHEN EXCLUDED.status = 'active' THEN NULL
        ELSE vault_chat_memberships.grace_started_at
      END,
      add_action_id = COALESCE(EXCLUDED.add_action_id, vault_chat_memberships.add_action_id),
      remove_action_id = COALESCE(EXCLUDED.remove_action_id, vault_chat_memberships.remove_action_id),
      failure_reason = EXCLUDED.failure_reason,
      updated_at = NOW();
  `
  const membership = await readVaultChatMembership(params)
  if (!membership) throw new Error('membership_write_failed')
  return membership
}

export async function joinVaultChat(params: {
  vaultAddress: `0x${string}`
  walletAddress: `0x${string}`
}): Promise<{ policy: VaultChatPolicy; membership: VaultChatMembership; actionId: number | null; eligible: boolean }> {
  const policy = await readVaultChatPolicy(params.vaultAddress)
  if (!policy || !policy.enabled) throw new Error('vault_chat_not_enabled')
  if (!policy.groupId) throw new Error('vault_chat_group_missing')
  if (!policy.shareTokenAddress) throw new Error('vault_chat_share_token_missing')

  const minHolding = BigInt(policy.minHoldingRaw || '0')
  const eligibility = await checkSharesEligibility({
    wallet: params.walletAddress as Address,
    shareToken: policy.shareTokenAddress as Address,
    minShares: minHolding,
  })

  if (!eligibility.eligible) {
    const membership = await writeMembership({
      vaultAddress: policy.vaultAddress,
      walletAddress: params.walletAddress,
      status: eligibility.reason === 'onchain_read_failed' ? 'unknown_stale' : 'pending',
      balanceRaw: eligibility.evidence.shareBalance,
      failureReason: eligibility.reason,
    })
    return { policy, membership, actionId: null, eligible: false }
  }

  const action = await enqueueKeeprAction({
    vaultAddress: policy.vaultAddress,
    groupId: policy.groupId,
    actionType: 'xmtp.group.add_member',
    action: {
      action: 'xmtp.group.add_member',
      wallet: params.walletAddress,
      reason: 'vault_chat_join',
    },
    dedupeKey: `vault-chat:add:${policy.vaultAddress}:${params.walletAddress}`,
  })
  const membership = await writeMembership({
    vaultAddress: policy.vaultAddress,
    walletAddress: params.walletAddress,
    status: 'active',
    balanceRaw: eligibility.evidence.shareBalance,
    addActionId: action.id,
  })
  return { policy, membership, actionId: action.id, eligible: true }
}

export async function recheckVaultChatMemberships(params: {
  vaultAddress: `0x${string}`
  limit?: number
}): Promise<{ checked: number; removed: number; stale: number }> {
  const policy = await readVaultChatPolicy(params.vaultAddress)
  if (!policy || !policy.enabled || !policy.groupId || !policy.shareTokenAddress) {
    return { checked: 0, removed: 0, stale: 0 }
  }
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureChatSchema(db)

  const limit = Math.max(1, Math.min(250, Math.floor(params.limit ?? 100)))
  const members = await db.sql`
    SELECT * FROM vault_chat_memberships
    WHERE vault_address = ${policy.vaultAddress}
      AND status IN ('active', 'grace', 'unknown_stale')
    ORDER BY last_checked_at NULLS FIRST, updated_at ASC
    LIMIT ${limit};
  `

  let checked = 0
  let removed = 0
  let stale = 0
  const minHolding = BigInt(policy.minHoldingRaw || '0')

  for (const row of members.rows ?? []) {
    const membership = mapMembership(row)
    if (!membership) continue
    checked += 1
    const eligibility = await checkSharesEligibility({
      wallet: membership.walletAddress as Address,
      shareToken: policy.shareTokenAddress as Address,
      minShares: minHolding,
    })
    if (eligibility.reason === 'onchain_read_failed') {
      stale += 1
      await writeMembership({
        vaultAddress: policy.vaultAddress,
        walletAddress: membership.walletAddress,
        status: 'unknown_stale',
        balanceRaw: eligibility.evidence.shareBalance,
        failureReason: eligibility.reason,
      })
      continue
    }
    if (eligibility.eligible) {
      await writeMembership({
        vaultAddress: policy.vaultAddress,
        walletAddress: membership.walletAddress,
        status: 'active',
        balanceRaw: eligibility.evidence.shareBalance,
      })
      continue
    }

    const graceStartedAt = membership.graceStartedAt ? new Date(membership.graceStartedAt).getTime() : Date.now()
    const graceExpired = Date.now() - graceStartedAt > policy.graceHours * 60 * 60 * 1000
    if (!graceExpired) {
      await writeMembership({
        vaultAddress: policy.vaultAddress,
        walletAddress: membership.walletAddress,
        status: 'grace',
        balanceRaw: eligibility.evidence.shareBalance,
        failureReason: eligibility.reason,
      })
      continue
    }

    const action = await enqueueKeeprAction({
      vaultAddress: policy.vaultAddress,
      groupId: policy.groupId,
      actionType: 'xmtp.group.remove_member',
      action: {
        action: 'xmtp.group.remove_member',
        wallet: membership.walletAddress,
        reason: 'vault_chat_eligibility_lapsed',
      },
      dedupeKey: `vault-chat:remove:${policy.vaultAddress}:${membership.walletAddress}`,
    })
    await writeMembership({
      vaultAddress: policy.vaultAddress,
      walletAddress: membership.walletAddress,
      status: 'removed',
      balanceRaw: eligibility.evidence.shareBalance,
      removeActionId: action.id,
      failureReason: eligibility.reason,
    })
    removed += 1
  }

  return { checked, removed, stale }
}
