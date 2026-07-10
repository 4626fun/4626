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
  /** Retained for type compatibility; always null — Arch-B routes through parent CSW only. */
  subAccount: null
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
    subAccount: null,
  }
}

const LEGACY_SUB_ACCOUNT_ARTIFACT_COLUMNS = [
  'sub_account_address',
  'spend_permission_payload',
  'spend_permission_signature',
  'spend_permission_hash',
  'spend_allowance_wei',
  'spend_period_seconds',
] as const

function resolveEligibleRow(row: Record<string, unknown>): CommandIssuerResolution {
  const profileId = Number(row.profile_id)
  const revokedAt = row.revoked_at ? new Date(String(row.revoked_at)) : null
  if (revokedAt && Number.isFinite(revokedAt.getTime())) {
    return {
      status: 'revoked',
      profileId,
      revokedAt,
      reason: typeof row.revoked_reason === 'string' ? row.revoked_reason : null,
    }
  }

  if (row.spend_permission_revoked_at != null) {
    const spendPermissionRevokedAt = new Date(String(row.spend_permission_revoked_at))
    if (Number.isFinite(spendPermissionRevokedAt.getTime())) {
      return {
        status: 'revoked',
        profileId,
        revokedAt: spendPermissionRevokedAt,
        reason: 'legacy_spend_permission_revoked',
      }
    }
    return { status: 'not_provisioned', profileId }
  }

  const smartWallet = normalizeAddress(row.smart_wallet_address)
  const canonicalCsw = normalizeAddress(row.profile_csw_address)
  if (!smartWallet || !canonicalCsw || smartWallet !== canonicalCsw) {
    return { status: 'not_provisioned', profileId }
  }

  if (LEGACY_SUB_ACCOUNT_ARTIFACT_COLUMNS.some((column) => row[column] != null)) {
    return { status: 'not_provisioned', profileId }
  }

  if (row.spend_permission_end_at != null) {
    const permissionEndAt = new Date(String(row.spend_permission_end_at))
    if (!Number.isFinite(permissionEndAt.getTime()) || permissionEndAt.getTime() <= Date.now()) {
      return { status: 'not_provisioned', profileId }
    }
  }

  return { status: 'ready', context: rowToContext(row) }
}

export async function resolveCommandIssuerContextByAddress(address: string): Promise<CommandIssuerResolution> {
  const normalized = normalizeAddress(address)
  if (!normalized) return { status: 'not_provisioned', profileId: null }
  if (!isDbConfigured()) return { status: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { status: 'db_unavailable' }

  try {
    const { rows } = await db.sql`
      SELECT ctx.*, p.csw_address AS profile_csw_address
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
    return resolveEligibleRow(rows[0] as Record<string, unknown>)
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
      SELECT ctx.*, p.csw_address AS profile_csw_address
      FROM command_issuer_execution_context ctx
      JOIN target t ON t.live_id = ctx.profile_id
      JOIN profiles p ON p.id = ctx.profile_id
      LIMIT 1
    `
    if (!rows || rows.length === 0) return { status: 'not_provisioned', profileId }
    return resolveEligibleRow(rows[0] as Record<string, unknown>)
  } catch (error: any) {
    logger.error('[arch-b/context] resolveCommandIssuerContextByProfileId failed', { profileId, error: error?.message })
    return { status: 'db_unavailable' }
  }
}

export function isExecutionReady(resolution: CommandIssuerResolution): resolution is Extract<CommandIssuerResolution, { status: 'ready' }> {
  return resolution.status === 'ready'
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

  try {
    await db.sql`
      INSERT INTO command_issuer_execution_context (
        profile_id, smart_wallet_address, privy_owner_wallet_id, owner_eoa_address,
        owner_index, paymaster_policy, caps_version, per_tx_cap_wei, daily_cap_wei,
        provisioned_at, provisioned_by
      ) VALUES (
        ${params.profileId}, ${smartWallet}, ${params.privyOwnerWalletId}, ${ownerEoa},
        ${ownerIndex}, ${paymasterPolicy}, 1, ${params.perTxCapWei.toString()}, ${params.dailyCapWei.toString()},
        NOW(), ${provisionedBy}
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
        sub_account_address = NULL,
        parent_csw_address = NULL,
        spend_permission_payload = NULL,
        spend_permission_signature = NULL,
        spend_permission_hash = NULL,
        spend_allowance_wei = NULL,
        spend_period_seconds = NULL,
        spend_permission_end_at = NULL,
        spend_permission_revoked_at = NULL,
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

// ---------------------------------------------------------------------------
// Daily spend tracking for command issuers (used for rate limiting / quotas)
// Promoted here as part of completing the server-core move.
// ---------------------------------------------------------------------------

function getTodayYmd(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function readIssuerDailySpend(profileId: number): Promise<bigint> {
  if (!isDbConfigured()) return 0n
  const db = await getDb()
  if (!db) return 0n
  const ymd = getTodayYmd()
  try {
    const res = await db.sql`
      SELECT spent_wei FROM command_issuer_daily_spend
      WHERE profile_id = ${profileId} AND ymd = ${ymd}
      LIMIT 1
    `
    const row = res.rows?.[0]
    return row?.spent_wei ? BigInt(row.spent_wei) : 0n
  } catch {
    return 0n
  }
}

export async function recordIssuerDailySpend(params: {
  profileId: number
  amountWei: bigint
}): Promise<{ ok: true; newTotalWei: bigint } | { ok: false; error: string }> {
  const { profileId, amountWei } = params
  if (amountWei < 0n) {
    return { ok: false, error: 'negative_amount' }
  }
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  const ymd = getTodayYmd()
  try {
    const res = await db.sql`
      INSERT INTO command_issuer_daily_spend (profile_id, ymd, spent_wei, updated_at)
      VALUES (${profileId}, ${ymd}, ${amountWei}, NOW())
      ON CONFLICT (profile_id, ymd)
      DO UPDATE SET
        spent_wei = command_issuer_daily_spend.spent_wei + EXCLUDED.spent_wei,
        updated_at = NOW()
      RETURNING spent_wei
    `
    const newTotal = res.rows?.[0]?.spent_wei ? BigInt(res.rows[0].spent_wei) : amountWei
    return { ok: true, newTotalWei: newTotal }
  } catch (err: any) {
    logger.error('[command-issuer] recordIssuerDailySpend failed', { profileId, error: err?.message })
    return { ok: false, error: 'db_error' }
  }
}

export async function rollbackIssuerDailySpend(params: {
  profileId: number
  amountWei: bigint
}): Promise<void> {
  const { profileId, amountWei } = params
  if (amountWei <= 0n) return
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return

  const ymd = getTodayYmd()
  try {
    await db.sql`
      UPDATE command_issuer_daily_spend
      SET spent_wei = GREATEST(spent_wei - ${amountWei}, 0),
          updated_at = NOW()
      WHERE profile_id = ${profileId} AND ymd = ${ymd}
    `
  } catch (err: any) {
    logger.warn('[command-issuer] rollbackIssuerDailySpend failed (non-fatal)', { profileId, error: err?.message })
  }
}
