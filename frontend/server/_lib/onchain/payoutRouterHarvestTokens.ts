import { getAddress, isAddress, type Address } from 'viem'

import { getApiContracts } from './contracts.js'
import { resolvePayoutRouterZoraToken } from './payoutRouterRuntime.js'

const DEFAULT_WETH = '0x4200000000000000000000000000000000000006' as Address

export function resolveDefaultUsdcToken(env: Record<string, string | undefined> = process.env): Address {
  const fromEnv = String(env.USDC ?? env.PAYOUT_ROUTER_USDC_TOKEN ?? '').trim()
  if (fromEnv && isAddress(fromEnv)) return getAddress(fromEnv as Address)
  const contracts = getApiContracts()
  return getAddress(contracts.usdc)
}

export function resolveDefaultWethToken(env: Record<string, string | undefined> = process.env): Address {
  const fromEnv = String(env.WETH ?? '').trim()
  if (fromEnv && isAddress(fromEnv)) return getAddress(fromEnv as Address)
  return DEFAULT_WETH
}

export function resolveDefaultZoraTokens(env: Record<string, string | undefined> = process.env): Address[] {
  const contracts = getApiContracts()
  const primary = resolvePayoutRouterZoraToken(getAddress(contracts.zora))
  const fallbackRaw = String(env.PAYOUT_ROUTER_ZORA_TOKEN_FALLBACKS ?? '').trim()
  const out: Address[] = []
  const seen = new Set<string>()
  for (const token of [primary, ...fallbackRaw.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean)]) {
    if (!token || !isAddress(token)) continue
    const normalized = getAddress(token as Address)
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

export async function resolvePayoutRouterSwapPathTokens(params: {
  publicClient?: unknown
  shareOft: Address
  env?: Record<string, string | undefined>
}): Promise<Array<{ token: Address; label: string }>> {
  const env = params.env ?? process.env
  const weth = resolveDefaultWethToken(env)
  const usdc = resolveDefaultUsdcToken(env)
  const zoraTokens = resolveDefaultZoraTokens(env)
  const shareOft = getAddress(params.shareOft)
  const out: Array<{ token: Address; label: string }> = []
  const seen = new Set<string>()
  const add = (token: Address, label: string) => {
    const key = token.toLowerCase()
    if (seen.has(key) || key === shareOft.toLowerCase()) return
    seen.add(key)
    out.push({ token, label })
  }
  for (const zora of zoraTokens) add(zora, 'ZORA')
  add(weth, 'WETH')
  add(usdc, 'USDC')
  return out
}

export type PayoutRouterHarvestTokenPlanEntry = {
  token: Address
  label: string
  minOut: bigint
}

export function buildDefaultPayoutRouterHarvestTokenPlan(params: {
  creatorCoin: Address
  env?: Record<string, string | undefined>
  includeWeth?: boolean
  minOutDefault?: bigint
  minOutZora?: bigint
  minOutWeth?: bigint
  minOutUsdc?: bigint
}): PayoutRouterHarvestTokenPlanEntry[] {
  const env = params.env ?? process.env
  const minOutDefault = params.minOutDefault ?? 0n
  const minOutZora = params.minOutZora ?? minOutDefault
  const minOutWeth = params.minOutWeth ?? minOutDefault
  const minOutUsdc = params.minOutUsdc ?? minOutDefault
  const includeWeth = params.includeWeth !== false
  const out: PayoutRouterHarvestTokenPlanEntry[] = [
    { token: getAddress(params.creatorCoin), label: 'creatorCoin', minOut: 0n },
  ]
  for (const zora of resolveDefaultZoraTokens(env)) {
    out.push({ token: zora, label: 'ZORA', minOut: minOutZora })
  }
  if (includeWeth) {
    out.push({ token: resolveDefaultWethToken(env), label: 'WETH', minOut: minOutWeth })
  }
  out.push({ token: resolveDefaultUsdcToken(env), label: 'USDC', minOut: minOutUsdc })
  const deduped: PayoutRouterHarvestTokenPlanEntry[] = []
  const seen = new Set<string>()
  for (const entry of out) {
    const key = entry.token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }
  return deduped
}

declare const process: { env: Record<string, string | undefined> }
