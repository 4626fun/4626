import { afterEach, describe, expect, it } from 'vitest'

import {
  isLocalForkRpcUrl,
  isServerBlockedRpcUrl,
  normalizeViemHttpRpcUrl,
  resolveServerBaseRpcUrl,
  resolveServerBaseRpcUrls,
  resolveDeploySessionRpcUrl,
  summarizeRpcFailure,
} from './baseRpcUrl.js'

describe('baseRpcUrl', () => {
  const originalBaseRpcUrl = process.env.BASE_RPC_URL

  afterEach(() => {
    if (originalBaseRpcUrl === undefined) delete process.env.BASE_RPC_URL
    else process.env.BASE_RPC_URL = originalBaseRpcUrl
  })

  it('detects local fork RPC URLs', () => {
    expect(isLocalForkRpcUrl('http://127.0.0.1:8545')).toBe(true)
    expect(isLocalForkRpcUrl('http://localhost:8545/')).toBe(true)
    expect(isLocalForkRpcUrl('https://mainnet.base.org')).toBe(false)
  })

  it('normalizes ws(s) RPC URLs for viem http transport', () => {
    expect(normalizeViemHttpRpcUrl('wss://example.com/rpc')).toBe('https://example.com/rpc')
    expect(normalizeViemHttpRpcUrl('ws://127.0.0.1:8545')).toBe('http://127.0.0.1:8545')
  })

  it('skips local fork URLs for server onboarding reads', () => {
    process.env.BASE_RPC_URL = 'http://127.0.0.1:8545'
    expect(resolveServerBaseRpcUrl()).toBe('https://mainnet.base.org')
    expect(resolveServerBaseRpcUrls()[0]).toBe('https://mainnet.base.org')
  })

  it('keeps configured public RPC ahead of defaults', () => {
    process.env.BASE_RPC_URL = 'https://base.example/rpc'
    expect(resolveServerBaseRpcUrl()).toBe('https://base.example/rpc')
  })

  it('allows local fork RPC when explicitly requested', () => {
    process.env.BASE_RPC_URL = 'http://127.0.0.1:8545'
    expect(resolveServerBaseRpcUrl({ allowLocalFork: true })).toBe('http://127.0.0.1:8545')
  })

  it('routes deploy dry-run local RPC separately from server mainnet reads', () => {
    process.env.BASE_RPC_URL = 'https://base.example/rpc'
    process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL = 'http://127.0.0.1:8545'
    expect(resolveServerBaseRpcUrl()).toBe('https://base.example/rpc')
    expect(resolveDeploySessionRpcUrl()).toBe('http://127.0.0.1:8545')
    delete process.env.DEPLOY_DRY_RUN_LOCAL_RPC_URL
  })

  it('excludes Cloudflare-challenged LlamaRPC from server defaults', () => {
    delete process.env.BASE_RPC_URL
    expect(resolveServerBaseRpcUrls().some(isServerBlockedRpcUrl)).toBe(false)
    expect(isServerBlockedRpcUrl('https://base.llamarpc.com/')).toBe(true)
  })

  it('drops configured LlamaRPC URLs for server-side reads', () => {
    process.env.BASE_RPC_URL = 'https://base.llamarpc.com,https://base.example/rpc'
    expect(resolveServerBaseRpcUrls()).toEqual([
      'https://base.example/rpc',
      'https://mainnet.base.org',
      'https://base-mainnet.public.blastapi.io',
    ])
  })

  it('summarizes Cloudflare HTML RPC failures without dumping HTML', () => {
    const summary = summarizeRpcFailure(new Error('HTTP request failed. Status: 403 <!DOCTYPE html>Just a moment'))
    expect(summary).toBe('RPC access denied (Cloudflare-protected endpoint from server IP)')
  })
})
