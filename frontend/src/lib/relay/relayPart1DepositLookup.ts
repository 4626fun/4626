import { decodeFunctionData, type Hex, type PublicClient } from 'viem'

import {
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import type { OwnerMutationEip5792Call } from '@/lib/relay/ownerMutationTypes'
import {
  readPaymasterFromBundleReceipt,
  resolveBundleTxFromUserOperationHash,
} from '@/lib/relay/resolveRelayPart1DepositTxHash'

/** Relay Depository `NativeDeposit` / depositNative success log (Base mainnet). */
export const RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC =
  '0x8032066556caf3967d8fec4ad22a2d9e1e9576556b2903a0fcd5b1fd201e3477' as const

const RELAY_PART1_TX_STORAGE_PREFIX = '4626:relay_part1_tx:'

export function decodeDepositoryDepositNativeOrderId(
  data: Hex,
): { depositor: `0x${string}`; orderId: `0x${string}` } | null {
  if (data.slice(0, 10).toLowerCase() !== RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR) return null
  try {
    const decoded = decodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      data,
    })
    if (decoded.functionName !== 'depositNative') return null
    const [depositor, orderId] = decoded.args as [`0x${string}`, `0x${string}`]
    return { depositor, orderId }
  } catch {
    return null
  }
}

function orderIdFromDepositoryLogData(data: Hex): `0x${string}` | null {
  if (!data.startsWith('0x') || data.length < 2 + 64 * 3) return null
  return (`0x${data.slice(-64)}`) as `0x${string}`
}

function depositorFromDepositoryLogData(data: Hex): `0x${string}` | null {
  if (!data.startsWith('0x') || data.length < 2 + 64) return null
  const word = data.slice(2, 2 + 64)
  return (`0x${word.slice(24)}`) as `0x${string}`
}

function relayPart1StorageKey(orderId: `0x${string}`): string {
  return `${RELAY_PART1_TX_STORAGE_PREFIX}${orderId.toLowerCase()}`
}

export { relayPart1StorageKey }

export function readPersistedRelayPart1DepositTx(
  orderId: `0x${string}` | null | undefined,
): `0x${string}` | null {
  if (!orderId || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(relayPart1StorageKey(orderId))
    if (typeof raw === 'string' && /^0x[0-9a-fA-F]{64}$/.test(raw)) {
      return raw as `0x${string}`
    }
  } catch {
    /* ignore storage failures in WebView */
  }
  return null
}

export function persistRelayPart1DepositTx(params: {
  orderId: `0x${string}`
  txHash: `0x${string}`
}): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(relayPart1StorageKey(params.orderId), params.txHash)
  } catch {
    /* ignore */
  }
}

export function clearPersistedRelayPart1DepositTx(orderId: `0x${string}`): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(relayPart1StorageKey(orderId))
  } catch {
    /* ignore */
  }
}

async function resolveBundleTxForPaymasterCheck(params: {
  publicClient: PublicClient
  txHash: `0x${string}`
}): Promise<`0x${string}`> {
  try {
    await params.publicClient.getTransactionReceipt({ hash: params.txHash })
    return params.txHash
  } catch {
    const bundleTx = await resolveBundleTxFromUserOperationHash({
      userOperationHash: params.txHash,
    })
    return bundleTx ?? params.txHash
  }
}

/** Paymaster-sponsored Part 1 deposits must not be reused — Relay Part 2 will not fill. */
export async function isRelayPart1TxPaymasterSponsored(params: {
  publicClient: PublicClient
  txHash: `0x${string}`
  fundingCsw: `0x${string}`
}): Promise<boolean> {
  const bundleTx = await resolveBundleTxForPaymasterCheck(params)
  const paymaster = await readPaymasterFromBundleReceipt({
    publicClient: params.publicClient,
    transactionHash: bundleTx,
    sender: params.fundingCsw,
  })
  return paymaster != null
}

/** Single-receipt check — safe through `/api/rpc` (no wide eth_getLogs scans). */
export async function verifyRelayPart1DepositTxHint(params: {
  publicClient: PublicClient
  txHash: `0x${string}`
  fundingCsw: `0x${string}`
  orderId: `0x${string}`
}): Promise<boolean> {
  const receipt = await params.publicClient.getTransactionReceipt({ hash: params.txHash })
  if (receipt.status !== 'success') return false

  const targetOrderId = params.orderId.toLowerCase()
  const targetDepositor = params.fundingCsw.toLowerCase()

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== RELAY_DEPOSITORY_BASE.toLowerCase()) continue
    const topic0 = log.topics[0]?.toLowerCase()
    if (topic0 !== RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC.toLowerCase()) continue
    const logOrderId = orderIdFromDepositoryLogData(log.data)
    const logDepositor = depositorFromDepositoryLogData(log.data)
    if (!logOrderId || !logDepositor) continue
    if (logOrderId.toLowerCase() !== targetOrderId) continue
    if (logDepositor.toLowerCase() !== targetDepositor) continue
    return true
  }

  return false
}

/**
 * Reuse a prior Part 1 deposit for this quote order id when we already recorded
 * the bundle tx (session hint or caller-supplied hint). Avoids eth_getLogs scans
 * that fail on `/api/rpc` upstream block-range limits.
 */
export async function findExistingRelayPart1DepositTx(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  orderId: `0x${string}` | null | undefined
  txHint?: `0x${string}` | null | undefined
}): Promise<`0x${string}` | null> {
  const decoded =
    decodeDepositoryDepositNativeOrderId(params.userCall.data) ??
    (params.orderId
      ? { depositor: params.fundingCsw, orderId: params.orderId }
      : null)
  if (!decoded) return null
  if (decoded.depositor.toLowerCase() !== params.fundingCsw.toLowerCase()) return null

  const boundOrderId = decoded.orderId
  const candidateHints = [
    params.txHint ?? null,
    readPersistedRelayPart1DepositTx(boundOrderId),
  ].filter((value): value is `0x${string}` => Boolean(value))

  for (const hint of candidateHints) {
    try {
      const verified = await verifyRelayPart1DepositTxHint({
        publicClient: params.publicClient,
        txHash: hint,
        fundingCsw: params.fundingCsw,
        orderId: boundOrderId,
      })
      if (verified) {
        const bundleTx = await resolveBundleTxForPaymasterCheck({
          publicClient: params.publicClient,
          txHash: hint,
        })
        if (await isRelayPart1TxPaymasterSponsored({
          publicClient: params.publicClient,
          txHash: bundleTx,
          fundingCsw: params.fundingCsw,
        })) {
          clearPersistedRelayPart1DepositTx(boundOrderId)
          continue
        }
        return bundleTx
      }
    } catch {
      /* may be UserOp hash — try bundler resolution below */
    }

    try {
      const bundleTx = await resolveBundleTxFromUserOperationHash({
        userOperationHash: hint,
      })
      if (!bundleTx) continue
      const verified = await verifyRelayPart1DepositTxHint({
        publicClient: params.publicClient,
        txHash: bundleTx,
        fundingCsw: params.fundingCsw,
        orderId: boundOrderId,
      })
      if (!verified) continue
      if (await isRelayPart1TxPaymasterSponsored({
        publicClient: params.publicClient,
        txHash: bundleTx,
        fundingCsw: params.fundingCsw,
      })) {
        clearPersistedRelayPart1DepositTx(boundOrderId)
        continue
      }
      return bundleTx
    } catch {
      /* fail open — try next hint or proceed to fresh Part 1 */
    }
  }

  return null
}
