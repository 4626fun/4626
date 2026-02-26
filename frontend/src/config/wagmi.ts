import { http, createConfig, fallback } from 'wagmi'
import { Attribution } from 'ox/erc8021'
import type { Hex } from 'viem'
import { base, mainnet, arbitrum, optimism, polygon } from 'wagmi/chains'
import { coinbaseWallet, injected } from 'wagmi/connectors'

/**
 * Minimal Wagmi Config
 * 
 * Two connection paths:
 * 1. Coinbase Wallet (includes Smart Wallet)
 * 2. Injected (browser extension fallback)
 * 
 * Note: Zora wallet integration uses Privy SDK's useCrossAppAccounts
 * hook directly, not a wagmi connector, because cross-app transactions
 * must go through Privy's popup flow on Zora's domain.
 */

const BASE_RPC_URL_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'

function isValidRpcUrl(url: string): boolean {
  const value = String(url || '').trim()
  if (!value) return false
  if (value.startsWith('/')) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}


function parseBuilderCodes(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function resolveDataSuffix(): Hex | undefined {
  // Preferred: provide your builder code(s), e.g. "bc_xxx,bc_yyy"
  const codes = parseBuilderCodes(import.meta.env.VITE_BASE_BUILDER_CODES as string | undefined)
  if (codes.length > 0) {
    return Attribution.toDataSuffix({ codes }) as Hex
  }

  // Fallback: provide a precomputed suffix directly.
  const rawSuffix = (import.meta.env.VITE_BASE_DATA_SUFFIX as string | undefined)?.trim()
  if (!rawSuffix) return undefined
  return (rawSuffix.startsWith('0x') ? rawSuffix : `0x${rawSuffix}`) as Hex
}


function isCorsRestrictedRpc(url: string): boolean {
  // Alchemy browser CORS is opt-in; avoid hard failures by default.
  if ((/(^|\/\/)base-mainnet\.g\.alchemy\.com/i.test(url) || /\.g\.alchemy\.com\//i.test(url))) return true
  // CDP RPC URLs are not meant for direct browser fetch (often CORS/405).
  if (/^https:\/\/api\.developer\.coinbase\.com\/rpc\/v1\/base\//i.test(url)) return true
  return false
}

const BASE_RPC_URL = (() => {
  if (!isValidRpcUrl(BASE_RPC_URL_RAW)) return ''
  if (IS_BROWSER && isCorsRestrictedRpc(BASE_RPC_URL_RAW)) return ''
  return BASE_RPC_URL_RAW
})()
const BASE_RPC_PROXY = IS_BROWSER ? '/api/rpc' : ''
const ENABLE_INJECTED_CONNECTOR =
  !['0', 'false', 'no', 'off'].includes(String(import.meta.env.VITE_ENABLE_INJECTED_CONNECTOR ?? '1').toLowerCase())

function uniqueNonEmptyStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s) continue
    if (!isValidRpcUrl(s)) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

// Browser RPC reality: some providers (or API keys) block browser `fetch` via CORS / allowlists.
// Use a fallback list so reads don't hard-fail when a single endpoint is unreachable.
const BASE_READ_RPC_URLS = uniqueNonEmptyStrings(
  [
    BASE_RPC_PROXY,
    BASE_RPC_URL,
    // Base public RPCs (best-effort fallbacks)
    'https://base-mainnet.public.blastapi.io',
    'https://base.llamarpc.com',
    'https://base.meowrpc.com',
    'https://mainnet.base.org',
  ].filter((url) => {
    if (!url) return false
    return !(IS_BROWSER && isCorsRestrictedRpc(url))
  }),
)

function isLockedEthereumProviderGlobal(): boolean {
  if (!IS_BROWSER) return false
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum')
  if (!descriptor) return false
  const hasGetter = typeof descriptor.get === 'function'
  const hasSetter = typeof descriptor.set === 'function'
  return hasGetter && !hasSetter
}

function buildConnectors() {
  const baseConnectors = [
    coinbaseWallet({
      appName: 'Creator Vaults',
      preference: 'smartWalletOnly',
    }),
  ] as const

  // Some wallet extensions install a getter-only `window.ethereum`, which causes
  // other extensions to throw during provider injection. Avoid injected connector
  // in that state; users can still connect via Coinbase Wallet.
  const shouldUseInjected = ENABLE_INJECTED_CONNECTOR && !isLockedEthereumProviderGlobal()
  if (!shouldUseInjected) return baseConnectors as any
  return [
    ...baseConnectors,
    injected({
      shimDisconnect: true,
    }),
  ] as any
}

const DATA_SUFFIX = resolveDataSuffix()

export const wagmiConfig = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  connectors: buildConnectors(),
  ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
  transports: {
    [base.id]: BASE_READ_RPC_URLS.length > 0 ? fallback(BASE_READ_RPC_URLS.map((url) => http(url))) : http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
