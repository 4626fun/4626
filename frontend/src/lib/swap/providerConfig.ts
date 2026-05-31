import { swapProviderFlag } from '@/lib/flags/featureFlags'
import { normalizeUniswapError } from '@/lib/uniswap/error'

export type SwapProvider = 'uniswap' | 'cdp' | 'zora'
export type SwapProviderMode = 'uniswap' | 'cdp' | 'hybrid'

export type SwapProviderSelection = {
  mode: SwapProviderMode
  primary: SwapProvider
  fallback: SwapProvider | null
}

function normalizeSwapProviderMode(raw: unknown): SwapProviderMode {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()

  if (value === 'cdp') return 'cdp'
  if (value === 'hybrid') return 'hybrid'
  return 'uniswap'
}

export function readSwapProviderMode(): SwapProviderMode {
  return normalizeSwapProviderMode(swapProviderFlag())
}

export function resolveSwapProviderSelection(mode = readSwapProviderMode()): SwapProviderSelection {
  if (mode === 'cdp') {
    return {
      mode,
      primary: 'cdp',
      fallback: null,
    }
  }
  if (mode === 'hybrid') {
    return {
      mode,
      primary: 'cdp',
      fallback: 'uniswap',
    }
  }
  return {
    mode: 'uniswap',
    primary: 'uniswap',
    fallback: null,
  }
}

export function requiresCanonicalExecutionForSwapMode(mode: SwapProviderMode): boolean {
  return mode === 'cdp' || mode === 'hybrid'
}

export function shouldFallbackToUniswap(error: unknown): boolean {
  const normalized = normalizeUniswapError(error)
  if (!normalized.retryable) return false
  if (
    normalized.code === 'AUTH_REQUIRED' ||
    normalized.code === 'FORBIDDEN_ORIGIN' ||
    normalized.code === 'CHAIN_MISMATCH' ||
    normalized.code === 'SLIPPAGE_EXCEEDED' ||
    normalized.code === 'INSUFFICIENT_FUNDS' ||
    normalized.code === 'INSUFFICIENT_GAS' ||
    normalized.code === 'APPROVAL_REQUIRED'
  ) {
    return false
  }
  return true
}

/** True when Uniswap/CDP cannot route the pair — safe to try Zora creator pools next. */
export function shouldFallbackToZoraTrade(error: unknown): boolean {
  const normalized = normalizeUniswapError(error)
  if (
    normalized.code === 'INSUFFICIENT_FUNDS' ||
    normalized.code === 'INSUFFICIENT_GAS' ||
    normalized.code === 'AUTH_REQUIRED' ||
    normalized.code === 'FORBIDDEN_ORIGIN' ||
    normalized.code === 'CHAIN_MISMATCH' ||
    normalized.code === 'WALLET_REJECTED'
  ) {
    return false
  }

  const msg = normalized.message.toLowerCase()
  if (
    msg.includes('no route') ||
    msg.includes('route not found') ||
    msg.includes('no liquidity') ||
    msg.includes('liquidity unavailable') ||
    msg.includes('unsupported pair') ||
    msg.includes('pair not supported') ||
    (msg.includes('not found') && msg.includes('route'))
  ) {
    return true
  }

  return false
}

export function getSwapProviderLabel(provider: SwapProvider): 'Uniswap' | 'CDP' | 'Zora' {
  if (provider === 'cdp') return 'CDP'
  if (provider === 'zora') return 'Zora'
  return 'Uniswap'
}
