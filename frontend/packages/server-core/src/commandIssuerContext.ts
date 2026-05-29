/**
 * Architecture B Phase 2 — command issuer execution context.
 *
 * This is the canonical implementation (moved from server/_lib during the 2026-05 audit).
 *
 * Resolves a command issuer (wallet address or Telegram user) into the execution
 * context required to submit UserOps on their behalf.
 */

import type { Address } from 'viem'

import { getDb, isDbConfigured } from './db.js'
import { logger } from './observability.js'

declare const process: { env: Record<string, string | undefined> }

export function envBigInt(key: string, fallback: bigint): bigint {
  const raw = (process.env[key] ?? '').trim()
  if (!raw) return fallback
  try {
    const v = BigInt(raw)
    return v > 0n ? v : fallback
  } catch {
    return fallback
  }
}

export type ExecutionReadiness = 'ready' | 'not_provisioned' | 'revoked' | 'db_unavailable'

export type SpendPermissionPayload = {
  account: Address
  spender: Address
  token: Address
  allowance: string
  period: number
  start: number
  end: number
  salt: string
  extraData: string
}

export type CommandIssuerSubAccount = {
  subAccountAddress: Address
  parentCswAddress: Address
  spendPermission: {
    payload: SpendPermissionPayload
    signature: `0x${string}`
    hash: `0x${string}`
    allowanceWei: bigint
    periodSeconds: number
    endAt: Date
    revokedAt: Date | null
  }
}

export type CommandIssuerContext = {
  profileId: number
  smartWallet: Address
  privyOwnerWalletId: string
  ownerEoa: Address
  ownerIndex: number
  paymasterPolicy: string
  capsVersion: number
  perTxCapWei: bigint
  dailyCapWei: bigint
  provisionedAt: Date
  revokedAt: Date | null
  subAccount: CommandIssuerSubAccount | null
}

export type CommandIssuerResolution =
  | { status: 'ready'; context: CommandIssuerContext }
  | { status: 'not_provisioned'; profileId: number | null }
  | { status: 'revoked'; profileId: number; revokedAt: Date; reason: string | null }
  | { status: 'db_unavailable' }

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? (trimmed as Address) : null
}

function isHex(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)
}

function parseSpendPermissionPayload(raw: unknown): SpendPermissionPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const account = normalizeAddress(obj.account)
  const spender = normalizeAddress(obj.spender)
  const token = normalizeAddress(obj.token)
  const allowance = typeof obj.allowance === 'string' || typeof obj.allowance === 'number' ? String(obj.allowance) : null
  const period = typeof obj.period === 'number' || typeof obj.period === 'string' ? Number(obj.period) : NaN
  const start = typeof obj.start === 'number' || typeof obj.start === 'string' ? Number(obj.start) : NaN
  const end = typeof obj.end === 'number' || typeof obj.end === 'string' ? Number(obj.end) : NaN
  const salt = typeof obj.salt === 'string' ? obj.salt : null
  const extraData = typeof obj.extraData === 'string' ? obj.extraData : null

  if (!account || !spender || !token || !allowance) return null
  try { if (BigInt(allowance) < 0n) return null } catch { return null }
  if (!Number.isFinite(period) || period <= 0) return null
  if (!Number.isFinite(start) || start < 0) return null
  if (!Number.isFinite(end) || end <= 0) return null
  if (!salt || !isHex(salt)) return null
  if (!extraData || !isHex(extraData)) return null

  return { account, spender, token, allowance, period, start, end, salt, extraData }
}

function parseSubAccount(row: Record<string, unknown>): CommandIssuerSubAccount | null {
  const subAccountAddress = normalizeAddress(row.sub_account_address)
  if (!subAccountAddress) return null
  const parentCswAddress = normalizeAddress(row.parent_csw_address)
  const signature = typeof row.spend_permission_signature === 'string' ? row.spend_permission_signature : null
  const hash = typeof row.spend_permission_hash === 'string' ? row.spend_permission_hash : null
  const allowanceRaw = row.spend_allowance_wei != null ? String(row.spend_allowance_wei) : null
  const periodRaw = row.spend_period_seconds != null ? Number(row.spend_period_seconds) : NaN
  const endAtRaw = row.spend_permission_end_at
  const revokedAtRaw = row.spend_permission_revoked_at

  if (!parentCswAddress || !signature || !isHex(signature) || !hash || !isHex(hash) || !allowanceRaw) {
    return null
  }
  let allowanceWei: bigint
  try { allowanceWei = BigInt(allowanceRaw) } catch { return null }
  if (!Number.isFinite(periodRaw) || periodRaw <= 0) return null
  if (!endAtRaw) return null
  const endAt = new Date(String(endAtRaw))
  if (Number.isNaN(endAt.getTime())) return null
  const payload = parseSpendPermissionPayload(row.spend_permission_payload)
  if (!payload) return null

  return {
    subAccountAddress,
    parentCswAddress,
    spendPermission: {
      payload,
      signature: signature as `0x${string}`,
      hash: hash as `0x${string}`,
      allowanceWei,
      periodSeconds: periodRaw,
      endAt,
      revokedAt: revokedAtRaw ? new Date(String(revokedAtRaw)) : null,
    },
  }
}

function rowToContext(row: Record<string, unknown>): CommandIssuerContext {
  return {
    profileId: Number(row.profile_id),
    smartWallet: String(row.smart_wallet_address).toLowerCase() as Address,
    privyOwnerWalletId: String(row.privy_owner_wallet_id),
    ownerEoa: String(row.owner_eoa_address).toLowerCase() as Address,
    ownerIndex: Number(row.owner_index),
    paymasterPolicy: String(row.paymaster_policy),
    capsVersion: Number(row.caps_version),
    perTxCapWei: BigInt(String(row.per_tx_cap_wei)),
    dailyCapWei: BigInt(String(row.daily_cap_wei)),
    provisionedAt: new Date(String(row.provisioned_at)),
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    subAccount: parseSubAccount(row),
  }
}

export async function resolveCommandIssuerContextByAddress(address: string): Promise<CommandIssuerResolution> {
  const normalized = normalizeAddress(address)
  if (!normalized) return { status: 'not_provisioned', profileId: null }
  if (!isDbConfigured()) return { status: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { status: 'db_unavailable' }

  try {
    const { rows } = await db.sql`
      SELECT ctx.*
      FROM command_issuer_execution_context ctx
      JOIN profiles p ON p.id = ctx.profile_id
      JOIN profile_wallets pw ON pw.profile_id = ctx.profile_id
      WHERE p.merged_into_profile_id IS NULL
        AND (
          LOWER(pw.address) = ${normalized}
          OR LOWER(pw.canonical_csw_address) = ${normalized}
          OR LOWER(ctx.smart_wallet_address) = ${normalized}
        )
      ORDER BY ctx.provisioned_at DESC
      LIMIT 1
    `
    if (!rows || rows.length === 0) return { status: 'not_provisioned', profileId: null }
    const ctx = rowToContext(rows[0] as Record<string, unknown>)
    if (ctx.revokedAt) {
      return { status: 'revoked', profileId: ctx.profileId, revokedAt: ctx.revokedAt, reason: (rows[0] as any).revoked_reason ?? null }
    }
    return { status: 'ready', context: ctx }
  } catch (error: any) {
    logger.error('[arch-b/context] resolveCommandIssuerContextByAddress failed', { error: error?.message })
    return { status: 'db_unavailable' }
  }
}

export async function resolveCommandIssuerContextByProfileId(profileId: number): Promise<CommandIssuerResolution> {
  if (!Number.isInteger(profileId) || profileId <= 0) return { status: 'not_provisioned', profileId: null }
  if (!isDbConfigured()) return { status: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { status: 'db_unavailable' }

  try {
    const { rows } = await db.sql`
      WITH target AS (
        SELECT COALESCE(p.merged_into_profile_id, p.id) AS live_id
        FROM profiles p
        WHERE p.id = ${profileId}
        LIMIT 1
      )
      SELECT ctx.*
      FROM command_issuer_execution_context ctx
      JOIN target t ON t.live_id = ctx.profile_id
      LIMIT 1
    `
    if (!rows || rows.length === 0) return { status: 'not_provisioned', profileId }
    const ctx = rowToContext(rows[0] as Record<string, unknown>)
    if (ctx.revokedAt) {
      return { status: 'revoked', profileId: ctx.profileId, revokedAt: ctx.revokedAt, reason: (rows[0] as any).revoked_reason ?? null }
    }
    return { status: 'ready', context: ctx }
  } catch (error: any) {
    logger.error('[arch-b/context] resolveCommandIssuerContextByProfileId failed', { profileId, error: error?.message })
    return { status: 'db_unavailable' }
  }
}

export function isExecutionReady(resolution: CommandIssuerResolution): resolution is Extract<CommandIssuerResolution, { status: 'ready' }> {
  return resolution.status === 'ready'
}

export type ProvisionSubAccountInput = {
  subAccountAddress: string
  parentCswAddress: string
  spendPermission: {
    payload: SpendPermissionPayload
    signature: `0x${string}`
    hash: `0x${string}`
    allowanceWei: bigint
    periodSeconds: number
    endAt: Date
  }
}

export async function provisionCommandIssuerContext(params: {
  profileId: number
  smartWallet: string
  privyOwnerWalletId: string
  ownerEoa: string
  ownerIndex?: number
  perTxCapWei: bigint
  dailyCapWei: bigint
  paymasterPolicy?: string
  provisionedBy?: string | null
  subAccount?: ProvisionSubAccountInput | null
}): Promise<{ ok: true; context: CommandIssuerContext } | { ok: false; error: string }> {
  const smartWallet = normalizeAddress(params.smartWallet)
  const ownerEoa = normalizeAddress(params.ownerEoa)
  if (!smartWallet || !ownerEoa) return { ok: false, error: 'invalid_address' }
  if (!params.privyOwnerWalletId) return { ok: false, error: 'invalid_privy_wallet_id' }
  if (params.perTxCapWei <= 0n || params.dailyCapWei <= 0n) return { ok: false, error: 'invalid_caps' }
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  const ownerIndex = Number.isFinite(params.ownerIndex) ? Math.max(0, Math.floor(Number(params.ownerIndex))) : 0
  const paymasterPolicy = (params.paymasterPolicy ?? 'cdp_default').slice(0, 64)
  const provisionedBy = params.provisionedBy ? String(params.provisionedBy).slice(0, 128) : null

  let subAccountAddress: Address | null = null
  let parentCswAddress: Address | null = null
  let spendPayloadJson: string | null = null

  if (params.subAccount) {
    subAccountAddress = normalizeAddress(params.subAccount.subAccountAddress)
    parentCswAddress = normalizeAddress(params.subAccount.parentCswAddress)
    if (!subAccountAddress || !parentCswAddress) return { ok: false, error: 'invalid_subaccount_address' }
    spendPayloadJson = JSON.stringify(params.subAccount.spendPermission.payload)
  }

  try {
    await db.sql`
      INSERT INTO command_issuer_execution_context (
        profile_id, smart_wallet_address, privy_owner_wallet_id, owner_eoa_address,
        owner_index, paymaster_policy, caps_version, per_tx_cap_wei, daily_cap_wei,
        provisioned_at, provisioned_by, sub_account_address, parent_csw_address,
        spend_permission_payload, spend_permission_signature, spend_permission_hash,
        spend_allowance_wei, spend_period_seconds, spend_permission_end_at
      ) VALUES (
        ${params.profileId}, ${smartWallet}, ${params.privyOwnerWalletId}, ${ownerEoa},
        ${ownerIndex}, ${paymasterPolicy}, 1, ${params.perTxCapWei.toString()}, ${params.dailyCapWei.toString()},
        NOW(), ${provisionedBy}, ${subAccountAddress}, ${parentCswAddress},
        ${spendPayloadJson}, ${params.subAccount?.spendPermission.signature ?? null},
        ${params.subAccount?.spendPermission.hash ?? null},
        ${params.subAccount?.spendPermission.allowanceWei.toString() ?? null},
        ${params.subAccount?.spendPermission.periodSeconds ?? null},
        ${params.subAccount?.spendPermission.endAt.toISOString() ?? null}
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        smart_wallet_address = EXCLUDED.smart_wallet_address,
        privy_owner_wallet_id = EXCLUDED.privy_owner_wallet_id,
        owner_eoa_address = EXCLUDED.owner_eoa_address,
        owner_index = EXCLUDED.owner_index,
        paymaster_policy = EXCLUDED.paymaster_policy,
        per_tx_cap_wei = EXCLUDED.per_tx_cap_wei,
        daily_cap_wei = EXCLUDED.daily_cap_wei,
        provisioned_at = NOW(),
        provisioned_by = EXCLUDED.provisioned_by,
        sub_account_address = EXCLUDED.sub_account_address,
        parent_csw_address = EXCLUDED.parent_csw_address,
        spend_permission_payload = EXCLUDED.spend_permission_payload,
        spend_permission_signature = EXCLUDED.spend_permission_signature,
        spend_permission_hash = EXCLUDED.spend_permission_hash,
        spend_allowance_wei = EXCLUDED.spend_allowance_wei,
        spend_period_seconds = EXCLUDED.spend_period_seconds,
        spend_permission_end_at = EXCLUDED.spend_permission_end_at,
        revoked_at = NULL,
        revoked_reason = NULL
    `

    const fresh = await resolveCommandIssuerContextByProfileId(params.profileId)
    if (fresh.status !== 'ready') return { ok: false, error: 'resolution_failed_after_provision' }
    return { ok: true, context: fresh.context }
  } catch (err: any) {
    logger.error('[arch-b/context] provisionCommandIssuerContext failed', { error: err?.message })
    return { ok: false, error: 'db_error' }
  }
}

export async function revokeCommandIssuerContext(profileId: number, reason?: string): Promise<boolean> {
  if (!isDbConfigured()) return false
  const db = await getDb()
  if (!db) return false
  try {
    await db.sql`
      UPDATE command_issuer_execution_context
      SET revoked_at = NOW(), revoked_reason = ${reason ?? null}
      WHERE profile_id = ${profileId} AND revoked_at IS NULL
    `
    return true
  } catch (err: any) {
    logger.error('[arch-b/context] revokeCommandIssuerContext failed', { profileId, error: err?.message })
    return false
  }
}

export async function revokeSubAccountSpendPermission(profileId: number): Promise<boolean> {
  if (!isDbConfigured()) return false
  const db = await getDb()
  if (!db) return false
  try {
    await db.sql`
      UPDATE command_issuer_execution_context
      SET sub_account_address = NULL, parent_csw_address = NULL,
          spend_permission_payload = NULL, spend_permission_signature = NULL,
          spend_permission_hash = NULL, spend_allowance_wei = NULL,
          spend_period_seconds = NULL, spend_permission_end_at = NULL,
          spend_permission_revoked_at = NOW()
      WHERE profile_id = ${profileId}
    `
    return true
  } catch (err: any) {
    logger.error('[arch-b/context] revokeSubAccountSpendPermission failed', { profileId, error: err?.message })
    return false
  }
}
