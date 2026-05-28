import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'

/** Align with review-time Zora execute prep TTL so submit skips re-assert. */
const ZORA_ROUTER_SIM_CACHE_TTL_MS = 45_000

const cache = new Map<string, number>()

function cacheKey(params: {
  executionAddress: Address
  target: Address
  data: Hex
  value: bigint
}): string {
  const valueHex = params.value.toString(16)
  return `${params.executionAddress.toLowerCase()}:${params.target.toLowerCase()}:${params.data.toLowerCase()}:${valueHex}`
}

export function recordZoraRouterSimulationSuccess(params: {
  executionAddress: Address
  target: Address
  data: Hex
  value?: bigint | null
  now?: number
}): void {
  const key = cacheKey({
    executionAddress: getAddress(params.executionAddress),
    target: getAddress(params.target),
    data: params.data,
    value: params.value ?? 0n,
  })
  cache.set(key, params.now ?? Date.now())
}

export function hasRecentZoraRouterSimulation(params: {
  executionAddress: Address
  target: Address
  data: Hex
  value?: bigint | null
  now?: number
}): boolean {
  const key = cacheKey({
    executionAddress: getAddress(params.executionAddress),
    target: getAddress(params.target),
    data: params.data,
    value: params.value ?? 0n,
  })
  const recordedAt = cache.get(key)
  if (!recordedAt) return false
  return (params.now ?? Date.now()) - recordedAt <= ZORA_ROUTER_SIM_CACHE_TTL_MS
}

export function resetZoraRouterSimulationCacheForTests(): void {
  cache.clear()
}
