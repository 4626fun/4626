const DEFAULT_ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69' as const
const DEFAULT_WETH = '0x4200000000000000000000000000000000000006' as const
const DEFAULT_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

export type HarvestTokenPlanEntry = {
  token: `0x${string}`
  label: 'creatorCoin' | 'ZORA' | 'WETH' | 'USDC' | string
  minOut: bigint
}

function normalizeAddressMaybe(value: string): `0x${string}` | null {
  const raw = String(value || '').trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(raw)) return null
  return raw as `0x${string}`
}

function parseAddressListEnv(key: string, env: Record<string, string | undefined>): Array<`0x${string}`> {
  const raw = String(env[key] ?? '').trim()
  if (!raw) return []
  const out: Array<`0x${string}`> = []
  for (const token of raw.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean)) {
    const normalized = normalizeAddressMaybe(token)
    if (normalized) out.push(normalized)
  }
  return out
}

export function resolveZoraTokens(env: Record<string, string | undefined> = process.env): Array<`0x${string}`> {
  const primary =
    normalizeAddressMaybe(String(env.PAYOUT_ROUTER_ZORA_TOKEN ?? '')) ??
    normalizeAddressMaybe(String(env.ZORA_TOKEN ?? '')) ??
    (DEFAULT_ZORA_TOKEN as `0x${string}`)
  const fallback = parseAddressListEnv('PAYOUT_ROUTER_ZORA_TOKEN_FALLBACKS', env)
  const out: Array<`0x${string}`> = []
  const seen = new Set<string>()
  for (const token of [primary, ...fallback]) {
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(token)
  }
  return out
}

export function resolveUsdcToken(env: Record<string, string | undefined> = process.env): `0x${string}` {
  return (
    normalizeAddressMaybe(String(env.PAYOUT_ROUTER_USDC_TOKEN ?? '')) ??
    normalizeAddressMaybe(String(env.USDC ?? '')) ??
    (DEFAULT_USDC as `0x${string}`)
  )
}

export function resolveWethToken(env: Record<string, string | undefined> = process.env): `0x${string}` {
  return normalizeAddressMaybe(String(env.WETH ?? '')) ?? (DEFAULT_WETH as `0x${string}`)
}

export function buildPayoutRouterHarvestTokenPlan(params: {
  creatorCoin: `0x${string}`
  env?: Record<string, string | undefined>
  processWeth?: boolean
  minOutZora: bigint
  minOutWeth: bigint
  minOutUsdc: bigint
}): HarvestTokenPlanEntry[] {
  const env = params.env ?? process.env
  const out: HarvestTokenPlanEntry[] = [
    { token: params.creatorCoin, label: 'creatorCoin', minOut: 0n },
    ...resolveZoraTokens(env).map((token) => ({ token, label: 'ZORA' as const, minOut: params.minOutZora })),
  ]
  if (params.processWeth !== false) {
    out.push({ token: resolveWethToken(env), label: 'WETH', minOut: params.minOutWeth })
  }
  out.push({ token: resolveUsdcToken(env), label: 'USDC', minOut: params.minOutUsdc })

  const deduped: HarvestTokenPlanEntry[] = []
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
