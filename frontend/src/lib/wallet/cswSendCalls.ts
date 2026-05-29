/**
 * cswSendCalls.ts
 *
 * Submits a CSW call via EIP-5792 `wallet_sendCalls`, which is what Base App's
 * in-app browser actually supports for owner-mutation flows.
 *
 * Why this lane exists (re-discovered 2026-05-11 after reverting PR #580):
 *
 * The historical working pre-fund UserOp 0xa6b54357...b4c3 was submitted by
 * a public bundler EOA 0x54e2acab... (NOT the CSW, NOT the user). Base App
 * itself did all of this:
 *
 *   1. User taps "Submit" inside Base App
 *   2. Base App builds a UserOp from the requested call
 *   3. Base App's wallet signs the UserOp locally with the on-device passkey
 *      (no popup, no keys.coinbase.com round-trip \u2014 the passkey is reachable
 *      because Base App is the RP)
 *   4. Base App's bundler submits the UserOp via eth_sendUserOperation
 *   5. The bundler EOA batches it with other UserOps into a handleOps tx
 *   6. The CSW pays gas from its EntryPoint deposit
 *
 * On the dapp side, all we have to do is hand Base App the calls we want
 * executed. The EIP-5792 standard says: call `wallet_sendCalls` with the
 * version, chainId, atomic flag, and a list of {to, data, value}. The wallet
 * does steps 1-6 internally and returns a call-bundle id (which can be
 * fetched as a tx hash via `wallet_getCallsStatus`).
 *
 * No EOA funder. No Relay. No wallet_prepareCalls (which is blocked in-app).
 * No CSW self-call eth_sendTransaction (which reverts with Unauthorized()).
 *
 * This is what the reference tx actually did. We just have to ask for it
 * correctly.
 */

import { getAddress, type Hex, type PublicClient } from 'viem'

import { buildWalletSendCallsPayload } from '@/lib/wallet/walletSendCallsPayload'

const DEFAULT_WALLET_SEND_CALLS_TIMEOUT_MS = 180_000

export async function withWalletRequestTimeout<T>(
  label: string,
  timeoutMs: number,
  run: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} timed out after ${Math.round(timeoutMs / 1000)}s. Open Base App and confirm the passkey/sign prompt, then retry.`,
            ),
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

export type CswSendCallsTelemetry = {
  step:
    | 'preflight'
    | 'prompt_sign'
    | 'broadcast_success'
    | 'broadcast_error'
    | 'status_poll'
    | 'status_resolved'
    | 'status_timeout'
  detail: unknown
}

/**
 * One EIP-5792 call entry. Mirrors the shape the backend preview handler
 * returns and the shape EIP-5792 wallets accept in wallet_sendCalls.calls[].
 */
export type SendCallsCall = {
  to: `0x${string}`
  data: Hex
  /**
   * Native value to send with this specific call. Accepts either a bigint
   * (which we'll hex-encode here) or a pre-hex-encoded string. Defaults to 0.
   */
  value?: bigint | `0x${string}`
}

export type SubmitViaSendCallsParams = {
  /**
   * Wallet provider RPC bridge. For Base App self-auth sessions this is the
   * Base App wallet's request bridge; for external-signer sessions it's the
   * connected wallet (Privy / WalletConnect / etc.).
   */
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  /** The CSW address (used as `from` in the EIP-5792 payload). */
  csw: `0x${string}`
  /**
   * Ordered list of calls to dispatch in this single wallet_sendCalls. For
   * the two-part Relay owner-mutation flow this is exactly 2 entries:
   *
   *   [0] depositNative → RelayDepository (Part 1, pre-fund)
   *   [1] removeOwnerAtIndex → CSW          (Part 2, mutation)
   *
   * EIP-5792 wallets either bundle both into one UserOp's executeBatch OR
   * submit them as two sequential UserOps in the same block; either is
   * fine because the on-chain outcome matches the May 5 reference flow.
   */
  calls: SendCallsCall[]
  /** Target chain id. Currently Base mainnet (8453). */
  chainId: number
  /** Optional. Defaults to true so Base App treats the calls as a single bundle. */
  atomicRequired?: boolean
  /** When true, skip eth_accounts (Base App can hang on it after eth_requestAccounts). */
  skipEthAccountsPreflight?: boolean
  onTelemetry?: (event: CswSendCallsTelemetry) => void
}

function encodeValue(value: SendCallsCall['value']): `0x${string}` {
  if (value === undefined) return '0x0'
  if (typeof value === 'bigint') return `0x${value.toString(16)}` as `0x${string}`
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) return value
  // Defensive fallback so a malformed value never silently sends a wrong amount.
  throw new Error(
    `Invalid SendCallsCall.value: expected bigint or 0x-prefixed hex string, got ${String(value)}`,
  )
}

export async function _submitOwnerViaSendCalls(
  params: SubmitViaSendCallsParams,
): Promise<{ callBundleId: string }> {
  const emit = (event: CswSendCallsTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      /* swallow */
    }
  }

  // Sanity check: the wallet must be connected as the CSW (or as an owner)
  // for EIP-5792 to authorize the call against the CSW account.
  let accounts: string[] = []
  if (!params.skipEthAccountsPreflight) {
    try {
      accounts = (await withWalletRequestTimeout('eth_accounts', 8_000, () =>
        params.walletRequest({ method: 'eth_accounts' }),
      )) as string[]
    } catch {
      /* fall through — upstream eth_requestAccounts may already have verified CSW */
    }
  }

  const cswLower = params.csw.toLowerCase()
  const accountsLower = accounts.map((a) => a.toLowerCase())

  // Normalize calls to the EIP-5792 wire shape and capture a summary for the
  // telemetry event. Each call's value can arrive as bigint or hex string;
  // encodeValue() turns both into a 0x-prefixed hex wei string.
  const normalizedCalls = params.calls.map((c) => ({
    to: getAddress(c.to),
    data: c.data,
    value: encodeValue(c.value),
  }))

  const callsSummary = normalizedCalls.map((c, idx) => ({
    index: idx,
    to: c.to,
    valueHex: c.value,
    dataLengthBytes: (c.data.length - 2) / 2,
  }))

  emit({
    step: 'preflight',
    detail: {
      csw: cswLower,
      connectedAccounts: accountsLower,
      cswIsConnected: accountsLower.includes(cswLower),
      chainId: params.chainId,
      callCount: normalizedCalls.length,
      calls: callsSummary,
    },
  })

  if (normalizedCalls.length === 0) {
    emit({
      step: 'broadcast_error',
      detail: { error: 'wallet_sendCalls: calls array is empty' },
    })
    throw new Error('wallet_sendCalls: must provide at least one call.')
  }

  const payload = buildWalletSendCallsPayload({
    from: getAddress(params.csw),
    chainId: params.chainId,
    // Single CSW self-calls match swap/deploy routing (atomic only when batching).
    atomicRequired: params.atomicRequired ?? normalizedCalls.length > 1,
    calls: normalizedCalls.map((call) => ({
      to: call.to,
      data: call.data,
      value: call.value,
    })),
  })

  emit({
    step: 'prompt_sign',
    detail: {
      method: 'wallet_sendCalls',
      from: payload.from,
      chainId: payload.chainId,
      version: payload.version,
      callCount: normalizedCalls.length,
      calls: callsSummary,
    },
  })

  let result: unknown
  try {
    result = await withWalletRequestTimeout(
      'wallet_sendCalls',
      DEFAULT_WALLET_SEND_CALLS_TIMEOUT_MS,
      () =>
        params.walletRequest({
          method: 'wallet_sendCalls',
          params: [payload],
        }),
    )
  } catch (error) {
    emit({
      step: 'broadcast_error',
      detail: { error: error instanceof Error ? error.message : String(error ?? '') },
    })
    throw error
  }

  // The EIP-5792 return shape evolved over time. Wallets may return either:
  //   - A bare string (legacy)
  //   - { id: string }            (current spec)
  //   - { callBundleId: string }  (Coinbase Wallet pre-spec)
  let callBundleId: string | null = null
  if (typeof result === 'string') {
    callBundleId = result
  } else if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>
    if (typeof r.id === 'string') callBundleId = r.id
    else if (typeof r.callBundleId === 'string') callBundleId = r.callBundleId
  }
  if (!callBundleId) {
    emit({
      step: 'broadcast_error',
      detail: { error: 'wallet_sendCalls returned an unrecognized shape', raw: result },
    })
    throw new Error('wallet_sendCalls did not return a call-bundle id.')
  }

  emit({ step: 'broadcast_success', detail: { callBundleId } })
  return { callBundleId }
}

// ───────────────────────────────────────────────────────────────────────────
// wallet_getCallsStatus polling
// ───────────────────────────────────────────────────────────────────────────

export type WaitForCallsTxHashParams = {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  callBundleId: string
  /** Total wait budget in ms. Defaults to 60_000. */
  timeoutMs?: number
  /** Interval between polls in ms. Defaults to 1500. */
  intervalMs?: number
  /** Optional RPC client to resolve UserOp hash → bundle tx via eth_getUserOperationReceipt. */
  publicClient?: Pick<PublicClient, 'request'>
  onTelemetry?: (event: CswSendCallsTelemetry) => void
}

export type CallsStatusHashes = {
  transactionHash: `0x${string}` | null
  userOperationHash: `0x${string}` | null
}

export function extractCallsStatusHashes(raw: unknown): CallsStatusHashes {
  if (!raw || typeof raw !== 'object') {
    return { transactionHash: null, userOperationHash: null }
  }
  const obj = raw as Record<string, unknown>
  const receipts = Array.isArray(obj.receipts) ? obj.receipts : []
  let transactionHash: `0x${string}` | null = null
  let userOperationHash: `0x${string}` | null = null

  for (const r of receipts) {
    if (!r || typeof r !== 'object') continue
    const rec = r as Record<string, unknown>
    if (!transactionHash && isTxHash(rec.transactionHash)) {
      transactionHash = rec.transactionHash
    }
    for (const key of ['userOperationHash', 'userOpHash', 'userOperationReceiptHash'] as const) {
      if (!userOperationHash && isTxHash(rec[key])) {
        userOperationHash = rec[key]
      }
    }
  }

  if (!userOperationHash) {
    for (const key of ['userOperationHash', 'userOpHash'] as const) {
      if (isTxHash(obj[key])) {
        userOperationHash = obj[key]
      }
    }
  }

  return { transactionHash, userOperationHash }
}

function readCallsStatusFailure(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const status = Number((raw as Record<string, unknown>).status)
  if (Number.isFinite(status) && status >= 400) {
    return `wallet_sendCalls failed with status ${status}`
  }
  const statusText = String((raw as Record<string, unknown>).status ?? '').toUpperCase()
  if (statusText === 'FAILED' || statusText === 'ERROR') {
    return `wallet_sendCalls reported status ${statusText}`
  }
  return null
}

async function resolveBundleTxFromUserOpHash(
  publicClient: Pick<PublicClient, 'request'>,
  userOpHash: `0x${string}`,
): Promise<`0x${string}` | null> {
  try {
    const receipt = (await publicClient.request({
      method: 'eth_getUserOperationReceipt',
      params: [userOpHash],
    })) as { receipt?: { transactionHash?: string } } | null
    const tx = receipt?.receipt?.transactionHash
    return isTxHash(tx) ? tx : null
  } catch {
    return null
  }
}

/**
 * Poll `wallet_getCallsStatus` until the wallet reports at least one receipt
 * with a real `transactionHash`, then resolve. Returns null on timeout so the
 * caller can fall back to surfacing the bundle id without a broken explorer
 * link.
 *
 * Why we need this: `wallet_sendCalls` returns a call-bundle id (not a tx
 * hash). EIP-5792 wallets may batch multiple users' calls into a single
 * on-chain tx, so the bundle id is opaque until the wallet schedules and
 * broadcasts the underlying tx. Building a Basescan `/tx/<id>` link from the
 * bundle id produces a broken explorer URL.
 *
 * Wallet return shapes we handle:
 *
 *   1. EIP-5792 current spec: `{ version, id, chainId, status: number,
 *      atomic, receipts: [{ status: number, transactionHash, blockHash,
 *      blockNumber, gasUsed, logs }] }`. `status` is a 3-digit code:
 *      100 = pending, 200 = confirmed (atomic), 400/500 = error.
 *
 *   2. Pre-spec Coinbase shape: `{ status: 'PENDING' | 'CONFIRMED' |
 *      'FAILED', receipts: [{ transactionHash, ... }] }`.
 *
 *   3. Hybrid / partial: only `status` is set, no `receipts` yet. We treat
 *      that as "keep polling".
 *
 * We resolve as soon as we see a non-empty `receipts[].transactionHash`,
 * regardless of confirmation status, so the user can click through to
 * Basescan and watch confirmation themselves.
 */
export async function waitForCallsTxHash(
  params: WaitForCallsTxHashParams,
): Promise<{
  transactionHash: `0x${string}` | null
  userOperationHash: `0x${string}` | null
  rawStatus: unknown
}> {
  const emit = (event: CswSendCallsTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      /* swallow */
    }
  }

  const totalBudget = params.timeoutMs ?? 60_000
  const interval = params.intervalMs ?? 1_500
  const deadline = Date.now() + totalBudget
  let lastRaw: unknown = null
  let pollCount = 0

  while (Date.now() < deadline) {
    pollCount++
    let raw: unknown
    try {
      raw = await params.walletRequest({
        method: 'wallet_getCallsStatus',
        params: [params.callBundleId],
      })
      lastRaw = raw
    } catch (error) {
      // wallet_getCallsStatus is part of the same EIP-5792 surface; if
      // wallet_sendCalls worked, this should too. But some wallets implement
      // sendCalls without getCallsStatus, so surface and bail rather than
      // loop forever on an RPC error.
      emit({
        step: 'status_poll',
        detail: {
          pollCount,
          error: error instanceof Error ? error.message : String(error ?? ''),
        },
      })
      return { transactionHash: null, userOperationHash: null, rawStatus: { error } }
    }

    const failure = readCallsStatusFailure(raw)
    if (failure) {
      emit({ step: 'broadcast_error', detail: { error: failure, rawStatus: summarizeCallsStatus(raw) } })
      throw new Error(failure)
    }

    const { transactionHash, userOperationHash } = extractCallsStatusHashes(raw)
    let resolvedTxHash = transactionHash
    if (!resolvedTxHash && userOperationHash && params.publicClient) {
      resolvedTxHash = await resolveBundleTxFromUserOpHash(params.publicClient, userOperationHash)
    }

    emit({
      step: 'status_poll',
      detail: {
        pollCount,
        txHashFound: resolvedTxHash != null,
        userOpHashFound: userOperationHash != null,
        rawStatus: summarizeCallsStatus(raw),
      },
    })
    if (resolvedTxHash || userOperationHash) {
      emit({
        step: 'status_resolved',
        detail: { transactionHash: resolvedTxHash, userOperationHash },
      })
      return {
        transactionHash: resolvedTxHash,
        userOperationHash,
        rawStatus: raw,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  emit({
    step: 'status_timeout',
    detail: {
      pollCount,
      timeoutMs: totalBudget,
      lastStatus: summarizeCallsStatus(lastRaw),
    },
  })
  return { transactionHash: null, userOperationHash: null, rawStatus: lastRaw }
}

/**
 * Compact representation of a `wallet_getCallsStatus` response suitable for
 * the lane event log without dumping the full payload (which can include
 * lengthy log arrays).
 */
function summarizeCallsStatus(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const obj = raw as Record<string, unknown>
  const receipts = Array.isArray(obj.receipts) ? obj.receipts : []
  return {
    status: obj.status,
    atomic: obj.atomic,
    receiptsCount: receipts.length,
    receipts: receipts.slice(0, 3).map((r) => {
      if (!r || typeof r !== 'object') return r
      const rec = r as Record<string, unknown>
      return {
        status: rec.status,
        transactionHash: rec.transactionHash,
        userOperationHash: rec.userOperationHash ?? rec.userOpHash,
        blockNumber: rec.blockNumber,
      }
    }),
  }
}
