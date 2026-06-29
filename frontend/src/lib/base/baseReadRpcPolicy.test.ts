import { describe, expect, it } from 'vitest'

import { BASE_RPC_PROXY_PATH, getBrowserBaseReadRpcUrl, isBrowserRestrictedBaseRpc, isLocalForkBaseRpcUrl } from '@/lib/base/baseReadRpcPolicy'

describe('baseReadRpcPolicy', () => {
  it('flags Coinbase Developer Base RPC URLs as browser-restricted', () => {
    expect(isBrowserRestrictedBaseRpc('https://api.developer.coinbase.com/rpc/v1/base/test-key')).toBe(true)
  })

  it('flags Alchemy Base RPC URLs as browser-restricted', () => {
    expect(isBrowserRestrictedBaseRpc('https://base-mainnet.g.alchemy.com/v2/test-key')).toBe(true)
  })

  it('keeps browser-safe public Base RPC URLs direct', () => {
    expect(getBrowserBaseReadRpcUrl('https://mainnet.base.org')).toBe('https://mainnet.base.org')
  })

  it('routes restricted Base RPC URLs through the same-origin proxy', () => {
    expect(getBrowserBaseReadRpcUrl('https://api.developer.coinbase.com/rpc/v1/base/test-key')).toBe(
      BASE_RPC_PROXY_PATH,
    )
  })

  it('falls back to the same-origin proxy when no browser URL is configured', () => {
    expect(getBrowserBaseReadRpcUrl('')).toBe(BASE_RPC_PROXY_PATH)
  })

  it('detects loopback Anvil fork URLs for deploy dry-run', () => {
    expect(isLocalForkBaseRpcUrl('http://127.0.0.1:8545')).toBe(true)
    expect(isLocalForkBaseRpcUrl('http://localhost:8546/')).toBe(true)
    expect(isLocalForkBaseRpcUrl('https://mainnet.base.org')).toBe(false)
  })
})
