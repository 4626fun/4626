/**
 * cswSendCalls.ts
 *
 * Submits a CSW call via EIP-5792 `wallet_sendCalls`, which is what Base App's
 * in-app browser actually supports for owner-mutation flows.
 *
 * Why this lane exists:
 *
 * Owner-mutation Relay deposits (Part 1) are submitted from Base App via
 * `wallet_sendCalls` with the preview-bound Depository `depositNative`
 * call (`0x49290c1c` → Relay Depository 0x4cd00e38…). Base App wraps it as
 * CSW `executeBatch`, producing two internal transfers in the AA bundle:
 *   1. CSW → EntryPoint v0.6 (~85989948096 wei UserOp prefund)
 *   2. CSW → Relay Depository (18871666861048 wei + depositNative calldata)
 * Golden reference (block 45600637):
 *
 *   - Part 1 UserOp (AA hash): 0xa6b5435718a8969905a08093a7208dadefdf702602c63e3fd322d84db5f4b4c3
 *   - Part 1 bundle tx:        0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
 *   - Part 2 (solver fill):    0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36
 *
 * Relay's intent explorer labels same-chain call-execution (8453→8453) as a
 * "same chain cross chain transaction" (~0.000019 ETH on Base). That UI shape is
 * expected even though no bridge leaves Base.
 *
 * Base App wraps the deposit in a UserOp internally; Relay's solver submits
 * the destination `handleOps` + `executeWithoutChainIdValidation` mutation in
 * the same block. On the dapp side we pass EIP-5792 `{ to, data, value }`
 * from the server preview and poll `wallet_getCallsStatus` for the bundle tx
 * hash (often 0x34edd28…). Tenderly also surfaces the UserOp hash (0xa6b54357…)
 * for the same Part 1 — see goldenRelayPart1Shape.ts.
 *
 * Do not use bare CSW self-call `eth_sendTransaction` for owner mutations from
 * third-party dapps (reverts or blocked). See relay-owner-mutation-kit-guide.md.
 */

import { getAddress, type Hex } from 'viem'

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
   * Ordered list of calls to dispatch in this single wallet_sendCalls. Relay
   * owner mutations pass exactly one entry: Depository `depositNative` from the
   * preview (`0x49290c1c`, value = golden Part 1 deposit wei). Base App wraps
   * this as CSW `executeBatch`. Relay's solver submits the destination
   * `addOwnerAddress` fill separately (Part 2).
   */
  calls: SendCallsCall[]
  /** Target chain id. Currently Base mainnet (8453). */
  chainId: number
  /** Optional. Defaults to true so Base App treats the calls as a single bundle. */
  atomicRequired?: boolean
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
  try {
    accounts = (await params.walletRequest({ method: 'eth_accounts' })) as string[]
  } catch {
    /* fall through */
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

  const chainIdHex = `0x${params.chainId.toString(16)}`

  // EIP-5792 wallet_sendCalls payload. Spec:
  // https://eips.ethereum.org/EIPS/eip-5792
  const payload = {
    version: '1.0',
    from: getAddress(params.csw),
    chainId: chainIdHex,
    atomicRequired: params.atomicRequired ?? true,
    calls: normalizedCalls,
  }

  emit({
    step: 'prompt_sign',
    detail: {
      method: 'wallet_sendCalls',
      from: payload.from,
      chainId: chainIdHex,
      callCount: normalizedCalls.length,
      calls: callsSummary,
    },
  })

  let result: unknown
  try {
    result = await params.walletRequest({
      method: 'wallet_sendCalls',
      params: [payload],
    })
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
  onTelemetry?: (event: CswSendCallsTelemetry) => void
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

    const { transactionHash, userOperationHash } = extractCallsStatusHashes(raw)
    emit({
      step: 'status_poll',
      detail: {
        pollCount,
        txHashFound: transactionHash != null,
        userOpHashFound: userOperationHash != null,
        rawStatus: summarizeCallsStatus(raw),
      },
    })
    if (transactionHash || userOperationHash) {
      emit({
        step: 'status_resolved',
        detail: { transactionHash, userOperationHash },
      })
      return { transactionHash, userOperationHash, rawStatus: raw }
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

function extractCallsStatusHashes(raw: unknown): {
  transactionHash: `0x${string}` | null
  userOperationHash: `0x${string}` | null
} {
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
      transactionHash = rec.transactionHash as `0x${string}`
    }
    for (const key of ['userOperationHash', 'userOpHash', 'userOperationReceiptHash'] as const) {
      if (!userOperationHash && isTxHash(rec[key])) {
        userOperationHash = rec[key] as `0x${string}`
      }
    }
  }

  if (!userOperationHash) {
    for (const key of ['userOperationHash', 'userOpHash'] as const) {
      if (isTxHash(obj[key])) {
        userOperationHash = obj[key] as `0x${string}`
      }
    }
  }

  return { transactionHash, userOperationHash }
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

/**
 * @deprecated Prefer extractCallsStatusHashes for bundle + UserOp hash pairs.
 */
function extractFirstTransactionHash(raw: unknown): `0x${string}` | null {
  return extractCallsStatusHashes(raw).transactionHash
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
        blockNumber: rec.blockNumber,
      }
    }),
  }
}
