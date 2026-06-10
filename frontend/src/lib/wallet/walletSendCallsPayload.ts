import { getAddress, type Hex } from 'viem'

/** Coinbase Wallet SDK / EIP-5792 wallet_sendCalls schema version. */
export const WALLET_SEND_CALLS_VERSION = '2.0.0' as const

export type WalletSendCallsCallInput = {
  to: `0x${string}`
  data: Hex
  value?: bigint | `0x${string}`
}

export type WalletSendCallsPayload = {
  version: typeof WALLET_SEND_CALLS_VERSION
  from: `0x${string}`
  chainId: `0x${string}`
  atomicRequired: boolean
  calls: Array<{
    to: `0x${string}`
    data: Hex
    value: `0x${string}`
  }>
}

function encodeCallValue(value: WalletSendCallsCallInput['value']): `0x${string}` {
  if (value === undefined) return '0x0'
  if (typeof value === 'bigint') return `0x${value.toString(16)}` as `0x${string}`
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) return value
  throw new Error(
    `Invalid wallet_sendCalls call value: expected bigint or 0x-prefixed hex, got ${String(value)}`,
  )
}

export function chainIdToHex(chainId: number): `0x${string}` {
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chainId for wallet_sendCalls: ${String(chainId)}`)
  }
  return `0x${chainId.toString(16)}` as `0x${string}`
}

/**
 * Build a Coinbase-compatible EIP-5792 `wallet_sendCalls` request payload.
 * Requires `from` (Smart Wallet address) per @coinbase/wallet-sdk 4.3.x guidance.
 */
export function buildWalletSendCallsPayload(input: {
  from: `0x${string}`
  chainId: number
  calls: WalletSendCallsCallInput[]
  atomicRequired?: boolean
}): WalletSendCallsPayload {
  if (input.calls.length === 0) {
    throw new Error('wallet_sendCalls: must provide at least one call.')
  }

  return {
    version: WALLET_SEND_CALLS_VERSION,
    from: getAddress(input.from),
    chainId: chainIdToHex(input.chainId),
    atomicRequired: input.atomicRequired ?? true,
    calls: input.calls.map((call) => ({
      to: getAddress(call.to),
      data: call.data,
      value: encodeCallValue(call.value),
    })),
  }
}
