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

/**
 * EIP-712 SpendPermission payload shape, exactly matching the
 * `SpendPermissionManager` struct on Base mainnet. Bigints are serialized as
 * decimal strings for JSONB-round-trip safety.
 */
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
  const allowance =
    typeof obj.allowance === 'string' || typeof obj.allowance === 'number'
      ? String(obj.allowance)
      : null
  const period =
    typeof obj.period === 'number' || typeof obj.period === 'string'
      ? Number(obj.period)
      : NaN
  const start =
    typeof obj.start === 'number' || typeof obj.start === 'string'
      ? Number(obj.start)
      : NaN
  const end =
    typeof obj.end === 'number' || typeof obj.end === 'string' ? Number(obj.end) : NaN
  const salt = typeof obj.salt === 'string' ? obj.salt : null
  const extraData = typeof obj.extraData === 'string' ? obj.extraData : null

  if (!account || !spender || !token) return null
  if (!allowance) return null
  try {
    const parsed = BigInt(allowance)
    if (parsed < 0n) return null
  } catch {
    return null
  }
  if (!Number.isFinite(period) || period <= 0) return null
  if (!Number.isFinite(start) || start < 0) return null
  if (!Number.isFinite(end) || end <= 0) return null
  if (!salt || !isHex(salt)) return null
  if (!extraData || !isHex(extraData)) return null

  return {
    account,
    spender,
    token,
    allowance,
    period,
    start,
    end,
    salt,
    extraData,
  }
}

function parseSubAccount(row: Record<string, unknown>): CommandIssuerSubAccount | null {
  const subAccountAddress = normalizeAddress(row.sub_account_address)
  if (!subAccountAddress) return null

  const parentCswAddress = normalizeAddress(row.parent_csw_address)
  const signature = typeof row.spend_permission_signature === 'string' ? row.spend_permission_signature : null
  const hash = typeof row.spend_permission_hash === 'string' ? row.spend_permission_hash : null
  const allowanceRaw =
    row.spend_allowance_wei !== null && row.spend_allowance_wei !== undefined
      ? String(row.spend_allowance_wei)
      : null
  const periodRaw =
    row.spend_period_seconds !== null && row.spend_period_seconds !== undefined
      ? Number(row.spend_period_seconds)
      : NaN
  const endAtRaw = row.spend_permission_end_at
  const revokedAtRaw = row.spend_permission_revoked_at

  if (!parentCswAddress) {
    logger.warn('[arch-b/context] sub_account_address present without parent_csw_address; skipping sub-account', {
      subAccountAddress,
    })
    return null
  }
  if (!signature || !isHex(signature)) {
    logger.warn('[arch-b/context] sub-account missing or malformed signature; skipping', {
      subAccountAddress,
    })
    return null
  }
  if (!hash || !isHex(hash)) {
    logger.warn('[arch-b/context] sub-account missing or malformed permission hash; skipping', {
      subAccountAddress,
    })
    return null
  }
  if (!allowanceRaw) {
    logger.warn('[arch-b/context] sub-account missing allowance_wei; skipping', {
      subAccountAddress,
    })
    return null
  }
  let allowanceWei: bigint
  try {
    allowanceWei = BigInt(allowanceRaw)
  } catch {
    logger.warn('[arch-b/context] sub-account allowance_wei not parseable; skipping', {
      subAccountAddress,
      allowanceRaw,
    })
    return null
  }
  if (!Number.isFinite(periodRaw) || periodRaw <= 0) {
    logger.warn('[arch-b/context] sub-account period_seconds invalid; skipping', {
      subAccountAddress,
      periodRaw,
    })
    return null
  }
  if (!endAtRaw) {
    logger.warn('[arch-b/context] sub-account end_at missing; skipping', { subAccountAddress })
    return null
  }
  const endAt = new Date(String(endAtRaw))
  if (Number.isNaN(endAt.getTime())) {
    logger.warn('[arch-b/context] sub-account end_at not parseable; skipping', {
      subAccountAddress,
      endAtRaw,
    })
    return null
  }
  const payload = parseSpendPermissionPayload(row.spend_permission_payload)
  if (!payload) {
    logger.warn('[arch-b/context] sub-account spend_permission_payload invalid; skipping', {
      subAccountAddress,
    })
    return null
  }

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
    // Tombstone-aware: excludes execution contexts whose profile has been
    // merged away. If a stranded context exists on a tombstoned profile
    // (shouldn't happen post-merge-primitive extension, but defensive),
    // the JOIN on `profiles.merged_into_profile_id IS NULL` drops it
    // rather than returning it as a live authority.
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
    // Tombstone-aware: if the caller passes a merged-away profile id,
    // follow `merged_into_profile_id` to the canonical survivor before
    // reading the context. Caller-side code that tracked a stale id
    // (pre-merge) resolves correctly.
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

  let subAccountAddress: Address | null = null
  let parentCswAddress: Address | null = null
  let spendPayloadJson: string | null = null
  let spendSignature: string | null = null
  let spendHash: string | null = null
  let spendAllowanceStr: string | null = null
  let spendPeriodSeconds: number | null = null
  let spendEndAtIso: string | null = null

  if (params.subAccount) {
    subAccountAddress = normalizeAddress(params.subAccount.subAccountAddress)
    parentCswAddress = normalizeAddress(params.subAccount.parentCswAddress)
    if (!subAccountAddress || !parentCswAddress) {
      return { ok: false, error: 'invalid_sub_account_address' }
    }
    const sp = params.subAccount.spendPermission
    if (!sp.signature || !/^0x[0-9a-fA-F]*$/.test(sp.signature)) {
      return { ok: false, error: 'invalid_spend_permission_signature' }
    }
    if (!sp.hash || !/^0x[0-9a-fA-F]*$/.test(sp.hash)) {
      return { ok: false, error: 'invalid_spend_permission_hash' }
    }
    if (sp.allowanceWei <= 0n) return { ok: false, error: 'invalid_spend_permission_allowance' }
    if (!Number.isInteger(sp.periodSeconds) || sp.periodSeconds <= 0) {
      return { ok: false, error: 'invalid_spend_permission_period' }
    }
    if (Number.isNaN(sp.endAt.getTime())) {
      return { ok: false, error: 'invalid_spend_permission_end_at' }
    }
    spendSignature = sp.signature
    spendHash = sp.hash
    spendAllowanceStr = sp.allowanceWei.toString()
    spendPeriodSeconds = sp.periodSeconds
    spendEndAtIso = sp.endAt.toISOString()
    spendPayloadJson = JSON.stringify(sp.payload)
  }

  try {
    await db.sql`
      INSERT INTO command_issuer_execution_context (
        profile_id, smart_wallet_address, privy_owner_wallet_id, owner_eoa_address,
        owner_index, paymaster_policy, per_tx_cap_wei, daily_cap_wei,
        provisioned_by, revoked_at, revoked_reason, updated_at,
        sub_account_address, parent_csw_address,
        spend_permission_payload, spend_permission_signature, spend_permission_hash,
        spend_allowance_wei, spend_period_seconds, spend_permission_end_at,
        spend_permission_revoked_at
      ) VALUES (
        ${params.profileId}, ${smartWallet}, ${params.privyOwnerWalletId}, ${ownerEoa},
        ${ownerIndex}, ${paymasterPolicy}, ${perTxStr}::NUMERIC, ${dailyStr}::NUMERIC,
        ${provisionedBy}, NULL, NULL, now(),
        ${subAccountAddress}, ${parentCswAddress},
        ${spendPayloadJson}::JSONB, ${spendSignature}, ${spendHash},
        ${spendAllowanceStr}::NUMERIC, ${spendPeriodSeconds}, ${spendEndAtIso}::TIMESTAMPTZ,
        NULL
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        smart_wallet_address        = EXCLUDED.smart_wallet_address,
        privy_owner_wallet_id       = EXCLUDED.privy_owner_wallet_id,
        owner_eoa_address           = EXCLUDED.owner_eoa_address,
        owner_index                 = EXCLUDED.owner_index,
        paymaster_policy            = EXCLUDED.paymaster_policy,
        per_tx_cap_wei              = EXCLUDED.per_tx_cap_wei,
        daily_cap_wei               = EXCLUDED.daily_cap_wei,
        provisioned_by              = EXCLUDED.provisioned_by,
        revoked_at                  = NULL,
        revoked_reason              = NULL,
        updated_at                  = now(),
        sub_account_address         = COALESCE(EXCLUDED.sub_account_address, command_issuer_execution_context.sub_account_address),
        parent_csw_address          = COALESCE(EXCLUDED.parent_csw_address, command_issuer_execution_context.parent_csw_address),
        spend_permission_payload    = COALESCE(EXCLUDED.spend_permission_payload, command_issuer_execution_context.spend_permission_payload),
        spend_permission_signature  = COALESCE(EXCLUDED.spend_permission_signature, command_issuer_execution_context.spend_permission_signature),
        spend_permission_hash       = COALESCE(EXCLUDED.spend_permission_hash, command_issuer_execution_context.spend_permission_hash),
        spend_allowance_wei         = COALESCE(EXCLUDED.spend_allowance_wei, command_issuer_execution_context.spend_allowance_wei),
        spend_period_seconds        = COALESCE(EXCLUDED.spend_period_seconds, command_issuer_execution_context.spend_period_seconds),
        spend_permission_end_at     = COALESCE(EXCLUDED.spend_permission_end_at, command_issuer_execution_context.spend_permission_end_at),
        spend_permission_revoked_at = CASE
          WHEN EXCLUDED.sub_account_address IS NOT NULL
            THEN NULL
          ELSE command_issuer_execution_context.spend_permission_revoked_at
        END
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
 * Update just the sub-account columns on an existing execution-context row.
 * Used by PR-B's provisioning endpoint after the parent-signed SpendPermission
 * has been verified. Fails if no row exists for the profile (no implicit
 * create — caller must provision the base context first).
 */
export async function provisionSubAccountSpendPermission(params: {
  profileId: number
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
}): Promise<{ ok: true; context: CommandIssuerContext } | { ok: false; error: string }> {
  const subAccountAddress = normalizeAddress(params.subAccountAddress)
  const parentCswAddress = normalizeAddress(params.parentCswAddress)
  if (!subAccountAddress || !parentCswAddress) {
    return { ok: false, error: 'invalid_address' }
  }
  const sp = params.spendPermission
  if (!sp.signature || !/^0x[0-9a-fA-F]*$/.test(sp.signature)) {
    return { ok: false, error: 'invalid_spend_permission_signature' }
  }
  if (!sp.hash || !/^0x[0-9a-fA-F]*$/.test(sp.hash)) {
    return { ok: false, error: 'invalid_spend_permission_hash' }
  }
  if (sp.allowanceWei <= 0n) return { ok: false, error: 'invalid_spend_permission_allowance' }
  if (!Number.isInteger(sp.periodSeconds) || sp.periodSeconds <= 0) {
    return { ok: false, error: 'invalid_spend_permission_period' }
  }
  if (Number.isNaN(sp.endAt.getTime())) {
    return { ok: false, error: 'invalid_spend_permission_end_at' }
  }
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  const payloadJson = JSON.stringify(sp.payload)
  const allowanceStr = sp.allowanceWei.toString()
  const endAtIso = sp.endAt.toISOString()

  try {
    const { rows } = await db.sql`
      UPDATE command_issuer_execution_context SET
        sub_account_address         = ${subAccountAddress},
        parent_csw_address          = ${parentCswAddress},
        spend_permission_payload    = ${payloadJson}::JSONB,
        spend_permission_signature  = ${sp.signature},
        spend_permission_hash       = ${sp.hash},
        spend_allowance_wei         = ${allowanceStr}::NUMERIC,
        spend_period_seconds        = ${sp.periodSeconds},
        spend_permission_end_at     = ${endAtIso}::TIMESTAMPTZ,
        spend_permission_revoked_at = NULL,
        updated_at                  = now()
      WHERE profile_id = ${params.profileId}
      RETURNING profile_id
    `
    if (!rows || rows.length === 0) {
      return { ok: false, error: 'context_row_missing' }
    }
    const reread = await resolveCommandIssuerContextByProfileId(params.profileId)
    if (reread.status !== 'ready') {
      return { ok: false, error: 'provision_reread_failed' }
    }
    return { ok: true, context: reread.context }
  } catch (error) {
    logger.error('[arch-b/context] provisionSubAccountSpendPermission failed', {
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
 * Revoke JUST the sub-account spend permission on a context row.
 *
 * Distinct from `revokeCommandIssuerContext` above, which revokes the
 * entire context (kills delegation + execution + sub-account together).
 * This narrower revoke lets users turn off bot-initiated spending of
 * their parent CSW's funds while keeping the Privy delegation and
 * sub-account intact — they can re-provision a new spend permission
 * later without re-enrolling Privy.
 *
 * Only flips `spend_permission_revoked_at`. The submitter preflight
 * rejects any UserOp whose issuer context has this column set, which
 * is what actually stops in-chat commands from debiting the parent.
 *
 * Returns 'not_provisioned' if the row exists but has no sub-account,
 * or 'context_row_missing' if there's no row at all.
 */
export async function revokeSubAccountSpendPermission(params: {
  profileId: number
}): Promise<
  | { ok: true; alreadyRevoked: boolean }
  | {
      ok: false
      error: 'db_unavailable' | 'db_write_failed' | 'not_provisioned' | 'context_row_missing'
    }
> {
  if (!isDbConfigured()) return { ok: false, error: 'db_unavailable' }
  const db = await getDb()
  if (!db) return { ok: false, error: 'db_unavailable' }

  try {
    const { rows } = await db.sql`
      SELECT
        sub_account_address,
        spend_permission_revoked_at
      FROM command_issuer_execution_context
      WHERE profile_id = ${params.profileId}
      LIMIT 1
    `
    const row = rows?.[0] as
      | {
          sub_account_address: string | null
          spend_permission_revoked_at: string | Date | null
        }
      | undefined
    if (!row) return { ok: false, error: 'context_row_missing' }
    if (!row.sub_account_address) return { ok: false, error: 'not_provisioned' }
    const alreadyRevoked = row.spend_permission_revoked_at !== null

    await db.sql`
      UPDATE command_issuer_execution_context
      SET
        spend_permission_revoked_at = COALESCE(spend_permission_revoked_at, now()),
        updated_at                  = now()
      WHERE profile_id = ${params.profileId}
    `
    return { ok: true, alreadyRevoked }
  } catch (error) {
    logger.error('[arch-b/context] revokeSubAccountSpendPermission failed', {
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
