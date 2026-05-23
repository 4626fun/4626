import { decodeFunctionData, type Hex, type PublicClient } from 'viem'

import {
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import type { OwnerMutationEip5792Call } from '@/lib/relay/ownerMutationTypes'

/** Relay Depository `NativeDeposit` / depositNative success log (Base mainnet). */
export const RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC =
  '0x8032066556caf3967d8fec4ad22a2d9e1e9576556b2903a0fcd5b1fd201e3477' as const

const DEPOSIT_LOG_SCAN_BLOCK_WINDOW = 500_000n

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

/**
 * Returns an existing Part 1 bundle tx when this quote's order id was already
 * deposited by the funding CSW (prevents repeat wallet prompts on stale previews).
 */
export async function findExistingRelayPart1DepositTx(params: {
  publicClient: PublicClient
  fundingCsw: `0x${string}`
  userCall: OwnerMutationEip5792Call
  orderId: `0x${string}` | null | undefined
}): Promise<`0x${string}` | null> {
  const decoded =
    decodeDepositoryDepositNativeOrderId(params.userCall.data) ??
    (params.orderId
      ? { depositor: params.fundingCsw, orderId: params.orderId }
      : null)
  if (!decoded) return null
  if (decoded.depositor.toLowerCase() !== params.fundingCsw.toLowerCase()) return null

  const targetOrderId = decoded.orderId.toLowerCase()
  const latestBlock = await params.publicClient.getBlockNumber()
  const fromBlock =
    latestBlock > DEPOSIT_LOG_SCAN_BLOCK_WINDOW ? latestBlock - DEPOSIT_LOG_SCAN_BLOCK_WINDOW : 0n

  const logs = await params.publicClient.getLogs({
    address: RELAY_DEPOSITORY_BASE,
    topics: [RELAY_DEPOSITORY_NATIVE_DEPOSIT_LOG_TOPIC],
    fromBlock,
    toBlock: 'latest',
  })

  for (const log of logs) {
    const logOrderId = orderIdFromDepositoryLogData(log.data)
    const logDepositor = depositorFromDepositoryLogData(log.data)
    if (!logOrderId || !logDepositor) continue
    if (logOrderId.toLowerCase() !== targetOrderId) continue
    if (logDepositor.toLowerCase() !== params.fundingCsw.toLowerCase()) continue
    if (log.transactionHash) return log.transactionHash
  }

  return null
}
