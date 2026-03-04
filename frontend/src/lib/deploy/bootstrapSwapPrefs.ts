type EnvLike = Record<string, string | undefined>

export type BootstrapSwapProvider = 'uniswap' | '0x' | 'defillama'

export type BootstrapSwapPrefs = {
  provider: BootstrapSwapProvider
  allowFallback: boolean
  slippageBps: number
}

const DEFAULT_PROVIDER: BootstrapSwapProvider = 'defillama'
const DEFAULT_ALLOW_FALLBACK = true
const DEFAULT_SLIPPAGE_BPS = 100
const MAX_SLIPPAGE_BPS = 2_000

function parseProvider(raw: string | undefined): BootstrapSwapProvider {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (value === 'uniswap' || value === '0x' || value === 'defillama') return value
  return DEFAULT_PROVIDER
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!value) return fallback
  if (value === 'true' || value === '1' || value === 'yes') return true
  if (value === 'false' || value === '0' || value === 'no') return false
  return fallback
}

function parseSlippageBps(raw: string | undefined): number {
  const value = String(raw ?? '').trim()
  if (!/^\d+$/.test(value)) return DEFAULT_SLIPPAGE_BPS
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_SLIPPAGE_BPS) return DEFAULT_SLIPPAGE_BPS
  return parsed
}

export function readBootstrapSwapPrefs(env: EnvLike): BootstrapSwapPrefs {
  return {
    provider: parseProvider(env.VITE_DEPLOY_BOOTSTRAP_SWAP_PROVIDER),
    allowFallback: parseBool(env.VITE_DEPLOY_BOOTSTRAP_SWAP_ALLOW_FALLBACK, DEFAULT_ALLOW_FALLBACK),
    slippageBps: parseSlippageBps(env.VITE_DEPLOY_BOOTSTRAP_SWAP_SLIPPAGE_BPS),
  }
}

export function readClientBootstrapSwapPrefs(): BootstrapSwapPrefs {
  return readBootstrapSwapPrefs(import.meta.env as unknown as EnvLike)
}
