/**
 * Wallet balance preflight + insufficient-funds refusal mapping.
 *
 * Why this exists
 * ---------------
 * Every server-side agent-wallet `eth_sendTransaction` path in this repo
 * (Zora buy/sell/create, trend deploy, keepr transfer, trend funnel) currently
 * depends on the Privy-managed EOA holding enough native ETH on Base to cover
 * `gas * gasPrice + value`. Under the current EOA-per-creator model those
 * wallets are never funded, so every submission fails with an ugly raw error
 * that leaks to end users:
 *
 *   privy_http_400: {"error":"The total cost (gas * gas fee + value) of
 *   executing this transaction exceeds the balance of the account. Details:
 *   insufficient funds for gas * price + value: have 0 want 1244, ..."}
 *
 * This is a defensive unblock: do a cheap read-only balance check before
 * calling `walletRpc`, and if the wallet can't possibly cover the value,
 * return a friendly refusal and a structured log instead. It does not fix
 * the underlying architecture — the planned migration to routing these
 * calls through the user's Coinbase Smart Wallet (via sendUserOperation +
 * paymaster) is tracked separately in docs/architecture-b-design.md.
 *
 * Invariants preserved
 * --------------------
 * - Read-only: this module never mutates state or calls any write endpoint.
 * - Trust-boundary safe: no Privy/bundler credentials are touched.
 * - Fail-open on RPC errors: if balance lookup itself fails, we do NOT block
 *   the transaction — the underlying `walletRpc` path stays authoritative.
 *   The preflight is a UX upgrade, not a new gate.
 */

import type { Address } from 'viem'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

declare const process: { env: Record<string, string | undefined> }

/**
 * Hard floor. If `wallet.balance < requiredValue + GAS_BUFFER_WEI`, refuse.
 *
 * Calibrated to ~300k gas at 10 gwei. 1 gwei = 1e9 wei, so 10 gwei = 1e10 wei,
 * giving a buffer of 3e15 wei (~0.003 ETH). Previously this constant used 1e7
 * (0.01 gwei), which under-reserved the buffer by 1000x and let wallets with
 * only a few micro-ETH pass preflight and still fail inside Privy.
 */
export const DEFAULT_GAS_BUFFER_WEI = 300_000n * 10_000_000_000n // ~300k gas @ 10 gwei = 3e15 wei ≈ 0.003 ETH

export type PreflightOutcome =
  | {
      sufficient: true
      balanceWei: bigint
      requiredWei: bigint
    }
  | {
      sufficient: false
      balanceWei: bigint
      requiredWei: bigint
      reason: 'insufficient_funds'
      message: string
    }

export type PreflightSkipped = {
  sufficient: null
  reason: 'balance_lookup_failed'
  error: unknown
}

export type PreflightResult = PreflightOutcome | PreflightSkipped

export type PublicClientLike = {
  getBalance: (args: { address: Address; blockTag?: 'latest' | 'pending' }) => Promise<bigint>
}

/**
 * Shared Base public client for balance preflight reads. Callers may pass
 * their own client to `checkWalletBalancePreflight`; this factory is a
 * convenience for paths that don't already have one.
 */
export function getBasePreflightPublicClient(): PublicClientLike {
  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  return createPublicClient({ chain: base, transport: http(rpcUrl) }) as unknown as PublicClientLike
}

/**
 * Check whether `wallet` has enough native ETH to cover `valueWei` plus a
 * conservative gas buffer. Returns a structured outcome. On RPC failure,
 * returns `balance_lookup_failed` — callers should log and proceed (fail-open).
 */
export async function checkWalletBalancePreflight(params: {
  publicClient: PublicClientLike
  wallet: Address
  valueWei: bigint
  gasBufferWei?: bigint
}): Promise<PreflightResult> {
  const gasBufferWei = params.gasBufferWei ?? DEFAULT_GAS_BUFFER_WEI
  const requiredWei = (params.valueWei >= 0n ? params.valueWei : 0n) + gasBufferWei

  let balanceWei: bigint
  try {
    balanceWei = await params.publicClient.getBalance({ address: params.wallet, blockTag: 'latest' })
  } catch (error) {
    return {
      sufficient: null,
      reason: 'balance_lookup_failed',
      error,
    }
  }

  if (balanceWei >= requiredWei) {
    return { sufficient: true, balanceWei, requiredWei }
  }

  return {
    sufficient: false,
    balanceWei,
    requiredWei,
    reason: 'insufficient_funds',
    message: buildInsufficientFundsRefusal({ balanceWei, requiredWei }),
  }
}

/**
 * Friendly user-facing refusal string. Avoids raw Privy/wei jargon.
 * Wei values are included for logs but the message itself is user-safe.
 */
export function buildInsufficientFundsRefusal(params: {
  balanceWei: bigint
  requiredWei: bigint
}): string {
  return (
    "This trade can't be executed right now — the agent wallet needs funding before it can cover gas. " +
    'Contact setup or try again after it is topped up.'
  )
}

/**
 * Detect whether an error thrown from `walletRpc` (or any downstream
 * submission path) looks like an insufficient-funds failure, so we can map
 * it to the same friendly refusal even if preflight missed it (e.g. when
 * preflight was skipped due to RPC failure, or when gas estimation inside
 * Privy produced a higher requirement than our buffer).
 *
 * Substrings are lowercased-compared against the error message to stay
 * tolerant of Privy's exact phrasing across versions.
 */
export function isInsufficientFundsError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase()
  if (!message) return false
  if (message.includes('insufficient funds for gas')) return true
  if (message.includes('exceeds the balance of the account')) return true
  if (message.includes('total cost (gas * gas fee + value)')) return true
  return false
}

function extractErrorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message ?? ''
  if (typeof error === 'object') {
    const anyErr = error as Record<string, unknown>
    const nested = anyErr.message ?? anyErr.error ?? anyErr.cause
    if (typeof nested === 'string') return nested
    if (nested && typeof nested === 'object') {
      try {
        return JSON.stringify(nested)
      } catch {
        return ''
      }
    }
    try {
      return JSON.stringify(anyErr)
    } catch {
      return ''
    }
  }
  return ''
}
