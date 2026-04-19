/**
 * Architecture B Phase 2 — UserOperation submitter with caps + preflight.
 *
 * Why this exists
 * ---------------
 * Phase 1 (PR #290) mapped raw insufficient-funds errors from the legacy
 * Privy-EOA `eth_sendTransaction` path to a friendly refusal. That path is
 * structurally broken: the EOA is never funded.
 *
 * Phase 2 migrates `/keepr send` to route writes through the user's Coinbase
 * Smart Wallet (CSW) via `sendUserOperation` with a paymaster, behind the
 * `ARCH_B_SEND_VIA_USEROP` feature flag. This module is the single choke
 * point that gates every UserOp submission with:
 *
 *   1. Execution-readiness check (hard-fail if issuer is not provisioned).
 *   2. Per-transaction value cap (from `command_issuer_execution_context`).
 *   3. Per-day value cap (profile-scoped, across vaults).
 *   4. Defensive balance preflight on the CSW itself (defense in depth —
 *      even with a paymaster, unusual paymaster policy failures could fall
 *      back to the CSW paying; we refuse early if the CSW can't cover the
 *      intended transfer value plus a small gas cushion).
 *   5. Insufficient-funds mapping on any UserOp submission error.
 *
 * On any refusal, the daily spend counter is rolled back so a refused
 * attempt never consumes a user's daily budget.
 *
 * Trust boundaries
 * ----------------
 * - `issuer` context is always obtained from `resolveCommandIssuerContext*`
 *   (server-side DB), never from a client payload.
 * - Bundler URL + Privy wallet id are server-env / server-DB only.
 * - This module does NOT resolve profiles — the caller is responsible for
 *   passing an already-resolved `CommandIssuerContext`.
 *
 * Invariants preserved
 * --------------------
 * - Hard-fail semantics: no silent fallback to the legacy EOA path.
 * - Fail-closed on caps: caps check must return `allowed` before submit.
 * - Preflight is fail-open (RPC errors do not block — the submission error
 *   path still maps insufficient-funds to a friendly refusal).
 */

import type { Address, Hex, PublicClient } from 'viem'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

import { logger } from '../infra/logger.js'
import {
  type CommandIssuerContext,
  readIssuerDailySpend,
  recordIssuerDailySpend,
  rollbackIssuerDailySpend,
} from './commandIssuerContext.js'
import {
  type CoinbaseSmartWalletCall,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from './privyCoinbaseSmartWallet.js'
import {
  buildSpendPermissionCalls,
  isSpendPermissionApproved,
} from './spendPermission.js'
import {
  DEFAULT_GAS_BUFFER_WEI,
  buildInsufficientFundsRefusal,
  checkWalletBalancePreflight,
  getBasePreflightPublicClient,
  isInsufficientFundsError,
} from './walletBalancePreflight.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Public refusal / success shape
// ---------------------------------------------------------------------------

export type UserOpSubmissionSuccess = {
  ok: true
  userOpHash: `0x${string}`
  txHash: `0x${string}`
  smartWallet: `0x${string}`
  ownerAddress: `0x${string}`
  ownerIndex: number
}

export type UserOpRefusal =
  | {
      ok: false
      code: 'cap_exceeded'
      scope: 'per_tx' | 'daily'
      limitWei: bigint
      requestedWei: bigint
      alreadySpentWei?: bigint
      response: string
    }
  | {
      ok: false
      code: 'insufficient_funds'
      balanceWei: bigint
      requiredWei: bigint
      response: string
    }
  | {
      ok: false
      code: 'bundler_unavailable'
      response: string
    }
  | {
      ok: false
      code: 'userop_failed'
      retryable: boolean
      errorMessage: string
      response: string
    }
  | {
      ok: false
      code: 'sub_account_feature_disabled'
      response: string
    }
  | {
      ok: false
      code: 'sub_account_spend_permission_revoked'
      response: string
    }
  | {
      ok: false
      code: 'sub_account_spend_permission_expired'
      response: string
    }
  | {
      ok: false
      code: 'sub_account_parent_insufficient_funds'
      balanceWei: bigint
      requiredWei: bigint
      response: string
    }

export type UserOpSubmissionResult = UserOpSubmissionSuccess | UserOpRefusal

// ---------------------------------------------------------------------------
// Bundler URL resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the CDP paymaster+bundler URL from env. Matches the priority used
 * by `xmtpQueueExecutor.ts` so Phase 2 and queue executor stay aligned.
 * Returns null instead of throwing so the submitter can return a structured
 * refusal rather than a thrown error.
 */
export function resolveBundlerUrl(): string | null {
  const direct =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  return direct || null
}

// ---------------------------------------------------------------------------
// Caps check
// ---------------------------------------------------------------------------

type CapsCheckOutcome =
  | { allowed: true; dailyAlreadySpentWei: bigint }
  | {
      allowed: false
      scope: 'per_tx' | 'daily'
      limitWei: bigint
      requestedWei: bigint
      alreadySpentWei: bigint
      message: string
    }

/**
 * Friendly refusal copy for cap violations. Keeps wei out of user-visible
 * text; callers can include wei in structured logs separately.
 */
function buildCapExceededRefusal(params: {
  scope: 'per_tx' | 'daily'
  limitWei: bigint
  requestedWei: bigint
}): string {
  if (params.scope === 'per_tx') {
    return (
      "This trade can't be executed right now — it exceeds the per-transaction cap. " +
      'Adjust the amount or contact setup to raise your limit.'
    )
  }
  return (
    "This trade can't be executed right now — it would exceed your daily limit. " +
    'Try again tomorrow or contact setup to raise your limit.'
  )
}

async function checkCaps(params: {
  issuer: CommandIssuerContext
  valueWei: bigint
}): Promise<CapsCheckOutcome> {
  // Per-tx cap: strict upper bound on a single UserOp value.
  if (params.valueWei > params.issuer.perTxCapWei) {
    return {
      allowed: false,
      scope: 'per_tx',
      limitWei: params.issuer.perTxCapWei,
      requestedWei: params.valueWei,
      alreadySpentWei: 0n,
      message: buildCapExceededRefusal({
        scope: 'per_tx',
        limitWei: params.issuer.perTxCapWei,
        requestedWei: params.valueWei,
      }),
    }
  }

  // Daily cap: read today's profile-scoped spend and check against limit.
  const alreadySpentWei = await readIssuerDailySpend(params.issuer.profileId)
  if (alreadySpentWei + params.valueWei > params.issuer.dailyCapWei) {
    return {
      allowed: false,
      scope: 'daily',
      limitWei: params.issuer.dailyCapWei,
      requestedWei: params.valueWei,
      alreadySpentWei,
      message: buildCapExceededRefusal({
        scope: 'daily',
        limitWei: params.issuer.dailyCapWei,
        requestedWei: params.valueWei,
      }),
    }
  }

  return { allowed: true, dailyAlreadySpentWei: alreadySpentWei }
}

// ---------------------------------------------------------------------------
// Gas buffer (env-overridable)
// ---------------------------------------------------------------------------

function resolveGasBufferWei(): bigint {
  const raw = (process.env.ARCH_B_GAS_BUFFER_WEI ?? '').trim()
  if (!raw) return DEFAULT_GAS_BUFFER_WEI
  try {
    const parsed = BigInt(raw)
    return parsed > 0n ? parsed : DEFAULT_GAS_BUFFER_WEI
  } catch {
    return DEFAULT_GAS_BUFFER_WEI
  }
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

export type SubmitUserOpInput = {
  issuer: CommandIssuerContext
  calls: CoinbaseSmartWalletCall[]
  /**
   * Total native ETH value that leaves the CSW as a consequence of `calls`.
   * For native ETH transfers this equals the ETH value of the transfer; for
   * ERC-20 transfers this is 0. Used for caps + preflight math only.
   */
  valueWei: bigint
  /**
   * Optional pre-constructed viem PublicClient (for tests). If omitted, a
   * shared Base client is used.
   */
  publicClient?: PublicClient | null
  /**
   * Optional bundler URL override (for tests). If omitted, env is read.
   */
  bundlerUrl?: string | null
  /** Optional log correlation id. */
  correlationId?: string
  /** Passed through to the viem account-abstraction simulator. */
  simulate?: boolean
}

/**
 * Submit a UserOperation on the issuer's CSW, gated by caps + preflight.
 * On any refusal, the caller sees a typed result and should surface the
 * `response` string to the user. On submission errors mapped to
 * insufficient-funds, the same friendly refusal is returned.
 */
export async function submitUserOpOrRefuse(
  input: SubmitUserOpInput,
): Promise<UserOpSubmissionResult> {
  const { issuer } = input
  const correlationId = input.correlationId ?? 'arch-b/send'

  // --- 1. Caps check ------------------------------------------------------
  const caps = await checkCaps({ issuer, valueWei: input.valueWei })
  if (!caps.allowed) {
    logger.warn('[arch-b/userop] cap exceeded', {
      correlationId,
      profileId: issuer.profileId,
      smartWallet: issuer.smartWallet,
      scope: caps.scope,
      limitWei: caps.limitWei.toString(),
      requestedWei: caps.requestedWei.toString(),
      alreadySpentWei: caps.alreadySpentWei.toString(),
    })
    return {
      ok: false,
      code: 'cap_exceeded',
      scope: caps.scope,
      limitWei: caps.limitWei,
      requestedWei: caps.requestedWei,
      alreadySpentWei: caps.alreadySpentWei,
      response: caps.message,
    }
  }

  // --- 1b. Sub-account gating --------------------------------------------
  // When the issuer row has sub-account fields populated, the feature flag
  // must be on AND the spend permission must be live. We hard-fail on any
  // failure — no silent fallback to the direct-CSW path, since the row has
  // been explicitly migrated and the direct-CSW path may no longer work.
  if (issuer.subAccount) {
    if (!isArchBSubAccountsEnabled()) {
      logger.warn('[arch-b/userop] sub-account issuer but feature disabled; refusing', {
        correlationId,
        profileId: issuer.profileId,
        subAccountAddress: issuer.subAccount.subAccountAddress,
      })
      return {
        ok: false,
        code: 'sub_account_feature_disabled',
        response:
          "This trade can't be executed right now — the sub-account execution path is not enabled. Please try again shortly.",
      }
    }
    if (issuer.subAccount.spendPermission.revokedAt != null) {
      logger.warn('[arch-b/userop] sub-account spend permission revoked; refusing', {
        correlationId,
        profileId: issuer.profileId,
        subAccountAddress: issuer.subAccount.subAccountAddress,
        revokedAt: issuer.subAccount.spendPermission.revokedAt.toISOString(),
      })
      return {
        ok: false,
        code: 'sub_account_spend_permission_revoked',
        response:
          "This trade can't be executed right now — the spending permission has been revoked. Contact setup to re-authorize.",
      }
    }
    if (issuer.subAccount.spendPermission.endAt.getTime() < Date.now()) {
      logger.warn('[arch-b/userop] sub-account spend permission expired; refusing', {
        correlationId,
        profileId: issuer.profileId,
        subAccountAddress: issuer.subAccount.subAccountAddress,
        endAt: issuer.subAccount.spendPermission.endAt.toISOString(),
      })
      return {
        ok: false,
        code: 'sub_account_spend_permission_expired',
        response:
          "This trade can't be executed right now — the spending permission has expired. Contact setup to re-authorize.",
      }
    }
  }

  // --- 2. Bundler URL -----------------------------------------------------
  const bundlerUrl = input.bundlerUrl ?? resolveBundlerUrl()
  if (!bundlerUrl) {
    logger.error('[arch-b/userop] bundler url missing; refusing', {
      correlationId,
      profileId: issuer.profileId,
    })
    return {
      ok: false,
      code: 'bundler_unavailable',
      response:
        "This trade can't be executed right now — the bundler is temporarily unavailable. Please try again shortly.",
    }
  }

  // --- 3. Public client ---------------------------------------------------
  const publicClient =
    input.publicClient ??
    (createPublicClient({
      chain: base,
      transport: http((process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'),
    }) as unknown as PublicClient)

  // --- 4. Defensive balance preflight ------------------------------------
  // For legacy rows (no sub-account): check the CSW balance — the CSW pays.
  // For sub-account rows: the PARENT CSW holds the balance; funding flows
  // through the spend permission each UserOp. Sub-account itself may hold 0.
  if (input.valueWei > 0n) {
    const balanceSource: Address = issuer.subAccount
      ? issuer.subAccount.parentCswAddress
      : issuer.smartWallet
    try {
      const preflight = await checkWalletBalancePreflight({
        publicClient: getBasePreflightPublicClient(),
        wallet: balanceSource,
        valueWei: input.valueWei,
        gasBufferWei: resolveGasBufferWei(),
      })
      if (preflight.sufficient === false) {
        logger.warn('[arch-b/userop] balance preflight insufficient', {
          correlationId,
          profileId: issuer.profileId,
          smartWallet: issuer.smartWallet,
          balanceSource,
          subAccountPath: Boolean(issuer.subAccount),
          balanceWei: preflight.balanceWei.toString(),
          requiredWei: preflight.requiredWei.toString(),
        })
        if (issuer.subAccount) {
          return {
            ok: false,
            code: 'sub_account_parent_insufficient_funds',
            balanceWei: preflight.balanceWei,
            requiredWei: preflight.requiredWei,
            response: preflight.message,
          }
        }
        return {
          ok: false,
          code: 'insufficient_funds',
          balanceWei: preflight.balanceWei,
          requiredWei: preflight.requiredWei,
          response: preflight.message,
        }
      }
    } catch (error) {
      logger.warn('[arch-b/userop] balance preflight threw; proceeding', {
        correlationId,
        profileId: issuer.profileId,
        smartWallet: issuer.smartWallet,
        subAccountPath: Boolean(issuer.subAccount),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // --- 5. Reserve daily spend (before submit, to avoid double-spend races)
  let reservedAmount: bigint = 0n
  if (input.valueWei > 0n) {
    const reserve = await recordIssuerDailySpend({
      profileId: issuer.profileId,
      amountWei: input.valueWei,
    })
    if (!reserve.ok) {
      logger.error('[arch-b/userop] failed to reserve daily spend; refusing', {
        correlationId,
        profileId: issuer.profileId,
        error: reserve.error,
      })
      return {
        ok: false,
        code: 'userop_failed',
        retryable: true,
        errorMessage: `daily_spend_reserve_failed:${reserve.error}`,
        response:
          "This trade can't be executed right now — daily limits storage is temporarily unavailable. Please try again shortly.",
      }
    }
    reservedAmount = input.valueWei
  }

  // --- 6. Build effective calls (prepend spend permission for sub-account)
  let effectiveCalls: CoinbaseSmartWalletCall[] = input.calls
  let submitWallet: Address = issuer.smartWallet
  if (issuer.subAccount) {
    submitWallet = issuer.subAccount.subAccountAddress
    let isApprovedOnChain = false
    try {
      isApprovedOnChain = await isSpendPermissionApproved({
        publicClient,
        permission: issuer.subAccount.spendPermission.payload,
      })
    } catch (error) {
      // Fail-open: include approveWithSignature. The manager short-circuits
      // if the permission is already approved, so an extra call is harmless.
      logger.warn('[arch-b/userop] isSpendPermissionApproved threw; assuming not approved', {
        correlationId,
        profileId: issuer.profileId,
        subAccountAddress: issuer.subAccount.subAccountAddress,
        error: error instanceof Error ? error.message : String(error),
      })
      isApprovedOnChain = false
    }
    const spendCalls = buildSpendPermissionCalls({
      permission: issuer.subAccount.spendPermission.payload,
      signature: issuer.subAccount.spendPermission.signature,
      amountWei: input.valueWei,
      isApprovedOnChain,
    })
    effectiveCalls = [...spendCalls, ...input.calls]
  }

  // --- 7. Submit UserOperation -------------------------------------------
  try {
    const result = await sendPrivyCoinbaseSmartWalletUserOperation({
      publicClient,
      bundlerUrl,
      walletId: issuer.privyOwnerWalletId,
      smartWallet: submitWallet,
      ownerAddress: issuer.ownerEoa,
      ownerIndex: issuer.ownerIndex,
      calls: effectiveCalls,
      simulate: input.simulate ?? false,
    })

    logger.info('[arch-b/userop] submitted', {
      correlationId,
      profileId: issuer.profileId,
      smartWallet: issuer.smartWallet,
      ownerIndex: result.ownerIndex,
      valueWei: input.valueWei.toString(),
      userOpHash: result.userOpHash,
      txHash: result.txHash,
    })

    return {
      ok: true,
      userOpHash: result.userOpHash,
      txHash: result.txHash,
      smartWallet: result.smartWallet,
      ownerAddress: result.ownerAddress,
      ownerIndex: result.ownerIndex,
    }
  } catch (error) {
    // Rollback reserved daily spend so a failed submission doesn't consume
    // the user's budget.
    if (reservedAmount > 0n) {
      try {
        await rollbackIssuerDailySpend({ profileId: issuer.profileId, amountWei: reservedAmount })
      } catch (rollbackError) {
        logger.error('[arch-b/userop] rollback of reserved daily spend failed', {
          correlationId,
          profileId: issuer.profileId,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        })
      }
    }

    // Map insufficient-funds submission errors to the friendly refusal.
    if (isInsufficientFundsError(error)) {
      logger.warn('[arch-b/userop] submission returned insufficient-funds', {
        correlationId,
        profileId: issuer.profileId,
        smartWallet: issuer.smartWallet,
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        ok: false,
        code: 'insufficient_funds',
        balanceWei: 0n,
        requiredWei: 0n,
        response: buildInsufficientFundsRefusal({ balanceWei: 0n, requiredWei: 0n }),
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    const retryable =
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { retryable?: unknown }).retryable === 'boolean'
        ? Boolean((error as { retryable?: boolean }).retryable)
        : false

    logger.error('[arch-b/userop] submission failed', {
      correlationId,
      profileId: issuer.profileId,
      smartWallet: issuer.smartWallet,
      retryable,
      error: errorMessage,
    })

    return {
      ok: false,
      code: 'userop_failed',
      retryable,
      errorMessage,
      response: retryable
        ? "This trade can't be executed right now — a temporary bundler issue occurred. Please try again shortly."
        : `Transfer failed: ${errorMessage.slice(0, 180)}`,
    }
  }
}

// ---------------------------------------------------------------------------
// Feature-flag helper — used by callers (sendCommand.ts) to gate between
// the legacy EOA path and the Arch B UserOp path.
// ---------------------------------------------------------------------------

/** True iff `ARCH_B_SEND_VIA_USEROP` is truthy in env. */
export function isArchBSendViaUserOpEnabled(): boolean {
  const raw = (process.env.ARCH_B_SEND_VIA_USEROP ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/**
 * True iff `ARCH_B_SUB_ACCOUNTS_ENABLED` is truthy in env.
 *
 * When off (default), sub-account issuer rows are refused with
 * `sub_account_feature_disabled` — preserving the invariant that a
 * mis-provisioned row never silently falls back to the legacy direct-CSW path.
 * Legacy rows (subAccount === null) are unaffected by this flag.
 */
export function isArchBSubAccountsEnabled(): boolean {
  const raw = (process.env.ARCH_B_SUB_ACCOUNTS_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** True iff `ARCH_B_COIN_BUY_VIA_USEROP` is truthy in env. */
export function isArchBCoinBuyViaUserOpEnabled(): boolean {
  const raw = (process.env.ARCH_B_COIN_BUY_VIA_USEROP ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** True iff `ARCH_B_COIN_SELL_VIA_USEROP` is truthy in env. */
export function isArchBCoinSellViaUserOpEnabled(): boolean {
  return String(process.env.ARCH_B_COIN_SELL_VIA_USEROP ?? '').trim() === '1'
}

/**
 * True iff `ARCH_B_TREND_RESERVE_VIA_USEROP` is truthy in env.
 *
 * When on, `/coin trend reserve` routes the TrendCoin deploy through the
 * command issuer's CSW via `submitUserOpOrRefuse` (Arch B Phase 4) instead
 * of the legacy Privy-managed agent EOA path.
 */
export function isArchBTrendReserveViaUserOpEnabled(): boolean {
  const raw = (process.env.ARCH_B_TREND_RESERVE_VIA_USEROP ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}
