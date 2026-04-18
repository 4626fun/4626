/**
 * Architecture B Phase 2 — command issuer execution context.
 *
 * Resolves a Telegram command issuer (by their sender wallet address or
 * Telegram user id) into the canonical execution context required to submit
 * a UserOperation on their Coinbase Smart Wallet:
 *
 *   senderWallet or telegramUserId
 *       └─ profile_wallets / telegram_user_links
 *           └─ profile_id
 *               └─ command_issuer_execution_context
 *                   └─ { smartWallet, privyOwnerWalletId, ownerEoa, ownerIndex, caps }
 *
 * This is the **only** gate that distinguishes "linked" from "execution-ready".
 * A profile is execution-ready iff a non-revoked row exists in
 * command_issuer_execution_context. Everything else (token-kind guards,
 * preflight, daily spend) runs on top of this.
 *
 * Security invariants
 * -------------------
 * - Resolution is server-only. Input addresses are read from trusted DB rows,
 *   never taken from client payloads.
 * - Revoked rows (`revoked_at IS NOT NULL`) are treated as not-provisioned.
 * - Missing rows always hard-fail (no silent fallback to the legacy EOA path).
 * - Caps are read from the row, not from env on the hot path.
 */

import type { Address } from 'viem'

import { getDb, isDbConfigured } from '../db/postgres.js'
import { logger } from '../infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Read an environment variable as a positive bigint, returning `fallback` if
 * the variable is absent, empty, non-numeric, or non-positive.
 * Shared by user-facing arch-b handlers and the admin provisioning endpoint.
 */
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
  }
}

/**
 * Resolve the execution context for a wallet address that issued a command
 * (typically `params.senderWallet` in command handlers). The address is
 * reverse-looked-up to a profile via `profile_wallets`, then the active
 * `command_issuer_execution_context` row is returned.
 */
export async function resolveCommandIssuerContextByAddress(
  address: string,
): Promise<CommandIssuerResolution> {
  const normalized = normalizeAddress(address)
  if (!normalized) return { status: 'not_provisioned', profileId: null }
  if (!isDbConfigured()) return { status: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { status: 'db_unavailable' }

  try {
    const { rows } = await db.sql`
      SELECT ctx.*
      FROM command_issuer_execution_context ctx
      JOIN profile_wallets pw ON pw.profile_id = ctx.profile_id
      WHERE LOWER(pw.address) = ${normalized}
         OR LOWER(pw.canonical_csw_address) = ${normalized}
         OR LOWER(ctx.smart_wallet_address) = ${normalized}
      ORDER BY ctx.provisioned_at DESC
      LIMIT 1
    `
    if (!rows || rows.length === 0) {
      return { status: 'not_provisioned', profileId: null }
    }
    const row = rows[0] as Record<string, unknown>
    const ctx = rowToContext(row)
    if (ctx.revokedAt) {
      return {
        status: 'revoked',
        profileId: ctx.profileId,
        revokedAt: ctx.revokedAt,
        reason: row.revoked_reason ? String(row.revoked_reason) : null,
      }
    }
    return { status: 'ready', context: ctx }
  } catch (error) {
    logger.error('[arch-b/context] resolveCommandIssuerContextByAddress query failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { status: 'db_unavailable' }
  }
}

/**
 * Resolve execution context directly by profile id (used by admin provisioning
 * endpoints and tests).
 */
export async function resolveCommandIssuerContextByProfileId(
  profileId: number,
): Promise<CommandIssuerResolution> {
  if (!Number.isInteger(profileId) || profileId <= 0) {
    return { status: 'not_provisioned', profileId: null }
  }
  if (!isDbConfigured()) return { status: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { status: 'db_unavailable' }

  try {
    const { rows } = await db.sql`
      SELECT * FROM command_issuer_execution_context
      WHERE profile_id = ${profileId}
      LIMIT 1
    `
    if (!rows || rows.length === 0) {
      return { status: 'not_provisioned', profileId }
    }
    const row = rows[0] as Record<string, unknown>
    const ctx = rowToContext(row)
    if (ctx.revokedAt) {
      return {
        status: 'revoked',
        profileId: ctx.profileId,
        revokedAt: ctx.revokedAt,
        reason: row.revoked_reason ? String(row.revoked_reason) : null,
      }
    }
    return { status: 'ready', context: ctx }
  } catch (error) {
    logger.error('[arch-b/context] resolveCommandIssuerContextByProfileId query failed', {
      profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { status: 'db_unavailable' }
  }
}

/**
 * Type-narrow helper: true iff resolution returned a non-revoked, provisioned
 * context.
 */
export function isExecutionReady(
  resolution: CommandIssuerResolution,
): resolution is Extract<CommandIssuerResolution, { status: 'ready' }> {
  return resolution.status === 'ready'
}

/**
 * Provision (or re-provision) an execution context for a profile.
 * Called only from admin surfaces — never from the hot path.
 */
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
  if (!smartWallet || !ownerEoa) {
    return { ok: false, error: 'invalid_address' }
  }
  if (!params.privyOwnerWalletId || typeof params.privyOwnerWalletId !== 'string') {
    return { ok: false, error: 'invalid_privy_wallet_id' }
  }
  if (params.perTxCapWei <= 0n || params.dailyCapWei <= 0n) {
    return { ok: false, error: 'invalid_caps' }
  }
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  const ownerIndex = Number.isFinite(params.ownerIndex) ? Math.max(0, Math.floor(Number(params.ownerIndex))) : 0
  const paymasterPolicy = (params.paymasterPolicy ?? 'cdp_default').slice(0, 64)
  const perTxStr = params.perTxCapWei.toString()
  const dailyStr = params.dailyCapWei.toString()
  const provisionedBy = params.provisionedBy ? String(params.provisionedBy).slice(0, 128) : null

  try {
    await db.sql`
      INSERT INTO command_issuer_execution_context (
        profile_id, smart_wallet_address, privy_owner_wallet_id, owner_eoa_address,
        owner_index, paymaster_policy, per_tx_cap_wei, daily_cap_wei,
        provisioned_by, revoked_at, revoked_reason, updated_at
      ) VALUES (
        ${params.profileId}, ${smartWallet}, ${params.privyOwnerWalletId}, ${ownerEoa},
        ${ownerIndex}, ${paymasterPolicy}, ${perTxStr}::NUMERIC, ${dailyStr}::NUMERIC,
        ${provisionedBy}, NULL, NULL, now()
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        smart_wallet_address  = EXCLUDED.smart_wallet_address,
        privy_owner_wallet_id = EXCLUDED.privy_owner_wallet_id,
        owner_eoa_address     = EXCLUDED.owner_eoa_address,
        owner_index           = EXCLUDED.owner_index,
        paymaster_policy      = EXCLUDED.paymaster_policy,
        per_tx_cap_wei        = EXCLUDED.per_tx_cap_wei,
        daily_cap_wei         = EXCLUDED.daily_cap_wei,
        provisioned_by        = EXCLUDED.provisioned_by,
        revoked_at            = NULL,
        revoked_reason        = NULL,
        updated_at            = now()
    `
    const reread = await resolveCommandIssuerContextByProfileId(params.profileId)
    if (reread.status !== 'ready') {
      return { ok: false, error: 'provision_reread_failed' }
    }
    return { ok: true, context: reread.context }
  } catch (error) {
    logger.error('[arch-b/context] provision upsert failed', {
      profileId: params.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: 'db_write_failed' }
  }
}

/**
 * Soft-revoke an execution context. The row stays for audit but
 * `isExecutionReady` returns false after this.
 */
export async function revokeCommandIssuerContext(params: {
  profileId: number
  reason: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  try {
    await db.sql`
      UPDATE command_issuer_execution_context
      SET revoked_at = COALESCE(revoked_at, now()),
          revoked_reason = ${params.reason.slice(0, 256)},
          updated_at = now()
      WHERE profile_id = ${params.profileId}
    `
    return { ok: true }
  } catch (error) {
    logger.error('[arch-b/context] revoke failed', {
      profileId: params.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: 'db_write_failed' }
  }
}

/**
 * Durable per-profile daily spend: increments today's counter atomically
 * and returns the new total. Used by the submitter to enforce dailyCapWei
 * **across vaults**, whereas the legacy `recordDailySpend` in sendCommand.ts
 * is keyed per vault.
 *
 * Rollback (decrement) is available via `adjustIssuerDailySpend` with a
 * negative amount; the CHECK constraint prevents underflow.
 */
export async function recordIssuerDailySpend(params: {
  profileId: number
  amountWei: bigint
}): Promise<{ ok: true; newTotalWei: bigint } | { ok: false; error: string }> {
  if (params.amountWei < 0n) return { ok: false, error: 'negative_amount' }
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  const ymd = new Date().toISOString().slice(0, 10)
  const amountStr = params.amountWei.toString()

  try {
    const { rows } = await db.sql`
      INSERT INTO command_issuer_daily_spend (profile_id, ymd, spent_wei, updated_at)
      VALUES (${params.profileId}, ${ymd}::DATE, ${amountStr}::NUMERIC, now())
      ON CONFLICT (profile_id, ymd) DO UPDATE SET
        spent_wei = command_issuer_daily_spend.spent_wei + EXCLUDED.spent_wei,
        updated_at = now()
      RETURNING spent_wei
    `
    const total = rows?.[0]?.spent_wei ?? '0'
    return { ok: true, newTotalWei: BigInt(String(total)) }
  } catch (error) {
    logger.error('[arch-b/context] recordIssuerDailySpend failed', {
      profileId: params.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: 'db_write_failed' }
  }
}

/**
 * Roll back a previously-recorded spend (e.g., after a submission failure).
 * Subtracts `amountWei` from today's counter. Uses GREATEST to prevent
 * the value from going negative even under unexpected ordering.
 */
export async function rollbackIssuerDailySpend(params: {
  profileId: number
  amountWei: bigint
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (params.amountWei < 0n) return { ok: false, error: 'negative_amount' }
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  const ymd = new Date().toISOString().slice(0, 10)
  const amountStr = params.amountWei.toString()

  try {
    await db.sql`
      UPDATE command_issuer_daily_spend
      SET spent_wei = GREATEST(0::NUMERIC, spent_wei - ${amountStr}::NUMERIC),
          updated_at = now()
      WHERE profile_id = ${params.profileId} AND ymd = ${ymd}::DATE
    `
    return { ok: true }
  } catch (error) {
    logger.error('[arch-b/context] rollbackIssuerDailySpend failed', {
      profileId: params.profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: 'db_write_failed' }
  }
}

/**
 * Read today's spend total without mutation. Used for preflight cap checks.
 */
export async function readIssuerDailySpend(
  profileId: number,
): Promise<bigint> {
  if (!isDbConfigured()) return 0n
  const db = await getDb()
  if (!db) return 0n

  const ymd = new Date().toISOString().slice(0, 10)
  try {
    const { rows } = await db.sql`
      SELECT spent_wei FROM command_issuer_daily_spend
      WHERE profile_id = ${profileId} AND ymd = ${ymd}::DATE
      LIMIT 1
    `
    if (!rows || rows.length === 0) return 0n
    return BigInt(String(rows[0].spent_wei ?? '0'))
  } catch (error) {
    logger.warn('[arch-b/context] readIssuerDailySpend failed; returning 0', {
      profileId,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0n
  }
}
