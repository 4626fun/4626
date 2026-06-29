import { http, type HttpTransportConfig } from 'viem'

export const BASE_RPC_PROXY_PATH = '/api/rpc?chain=base'

/** CSP-allowed public Base read fallback when the session-protected proxy is unavailable. */
export const BROWSER_BASE_PUBLIC_RPC_FALLBACK = 'https://mainnet.base.org'

const ALCHEMY_BASE_RPC_PATTERN = /(^|\/\/)base-mainnet\.g\.alchemy\.com/i
const ANY_ALCHEMY_RPC_PATTERN = /\.g\.alchemy\.com\//i
const COINBASE_DEVELOPER_BASE_RPC_PATTERN = /^https:\/\/api\.developer\.coinbase\.com\/rpc\/v1\/base\//i
const RESTRICTED_BASE_RPC_PATTERNS = [
  ALCHEMY_BASE_RPC_PATTERN,
  ANY_ALCHEMY_RPC_PATTERN,
  COINBASE_DEVELOPER_BASE_RPC_PATTERN,
]

export function isBrowserRestrictedBaseRpc(url: string): boolean {
  const value = String(url || '').trim()
  if (!value) return false
  return RESTRICTED_BASE_RPC_PATTERNS.some((pattern) => pattern.test(value))
}

export function getBrowserBaseReadRpcUrl(url: string): string {
  const value = String(url || '').trim()
  if (!value) return BASE_RPC_PROXY_PATH
  if (isBrowserRestrictedBaseRpc(value)) return BASE_RPC_PROXY_PATH
  return value
}

export function buildSameOriginRpcProxyTransport(url: string, config: HttpTransportConfig = {}) {
  return http(url, {
    retryCount: 0,
    retryDelay: 150,
    timeout: 20_000,
    fetchOptions: { credentials: 'include' },
    ...config,
  })
}
