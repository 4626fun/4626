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
   * The target of the inner call. For owner mutations this is the CSW itself
   * (the CSW calls its own `executeBatch` / `addOwnerAddress` etc.) \u2014 the
   * EIP-5792 standard wraps it in a UserOp where the EntryPoint is the
   * msg.sender of the CSW call, so `onlyEntryPoint` and `onlyEntryPointOrOwner`
   * are satisfied.
   */
  to: `0x${string}`
  /**
   * The RAW inner action calldata (e.g. `removeOwnerAtIndex(idx, ownerBytes)`).
   * EIP-5792 wallets construct the UserOp's outer callData themselves;
   * we don't need to (and must not) pre-wrap with `executeBatch` or
   * `executeWithoutChainIdValidation`.
   */
  data: Hex
  /** Native value to send with the call. Defaults to 0. */
  value?: bigint
  /** Target chain id. Currently Base mainnet (8453). */
  chainId: number
  /** Optional. Defaults to true so Base App treats the calls as a single bundle. */
  atomicRequired?: boolean
  onTelemetry?: (event: CswSendCallsTelemetry) => void
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

  emit({
    step: 'preflight',
    detail: {
      csw: cswLower,
      connectedAccounts: accountsLower,
      cswIsConnected: accountsLower.includes(cswLower),
      chainId: params.chainId,
      target: params.to,
      dataLengthBytes: (params.data.length - 2) / 2,
      value: (params.value ?? 0n).toString(),
    },
  })

  const valueHex = `0x${(params.value ?? 0n).toString(16)}`
  const chainIdHex = `0x${params.chainId.toString(16)}`

  // EIP-5792 wallet_sendCalls payload. Spec:
  // https://eips.ethereum.org/EIPS/eip-5792
  const payload = {
    version: '1.0',
    from: getAddress(params.csw),
    chainId: chainIdHex,
    atomicRequired: params.atomicRequired ?? true,
    calls: [
      {
        to: getAddress(params.to),
        value: valueHex,
        data: params.data,
      },
    ],
  }

  emit({
    step: 'prompt_sign',
    detail: {
      method: 'wallet_sendCalls',
      from: payload.from,
      to: payload.calls[0]?.to,
      value: valueHex,
      chainId: chainIdHex,
      dataLengthBytes: (params.data.length - 2) / 2,
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
): Promise<{ transactionHash: `0x${string}` | null; rawStatus: unknown }> {
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
      return { transactionHash: null, rawStatus: { error } }
    }

    const txHash = extractFirstTransactionHash(raw)
    emit({
      step: 'status_poll',
      detail: {
        pollCount,
        txHashFound: txHash != null,
        rawStatus: summarizeCallsStatus(raw),
      },
    })
    if (txHash) {
      emit({ step: 'status_resolved', detail: { transactionHash: txHash } })
      return { transactionHash: txHash, rawStatus: raw }
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
  return { transactionHash: null, rawStatus: lastRaw }
}

/**
 * Pull the first valid 32-byte hex `transactionHash` we can find on a
 * `wallet_getCallsStatus` response. Returns null when no receipt has one yet.
 */
function extractFirstTransactionHash(raw: unknown): `0x${string}` | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const receipts = obj.receipts
  if (!Array.isArray(receipts)) return null
  for (const r of receipts) {
    if (!r || typeof r !== 'object') continue
    const rec = r as Record<string, unknown>
    const candidate = rec.transactionHash
    if (
      typeof candidate === 'string' &&
      /^0x[0-9a-fA-F]{64}$/.test(candidate)
    ) {
      return candidate as `0x${string}`
    }
  }
  return null
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
