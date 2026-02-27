import { afterEach, describe, expect, it, vi } from 'vitest'

import { callLiquidityApi } from './liquidityApi'

describe('callLiquidityApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns data for successful request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { hello: 'world' } }),
    } as any)))

    const result = await callLiquidityApi({ action: 'positions', payload: { walletAddress: '0xabc', chainId: 8453 } })
    expect((result as any).hello).toBe('world')
  })

  it('normalizes failure responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'approval needed' }),
    } as any)))

    await expect(callLiquidityApi({ action: 'create', payload: {} })).rejects.toThrow('Token approval needed. Click Approve to continue.')
  })

  it('maps server 5xx into retryable message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ success: false, error: 'network timeout from upstream' }),
    } as any)))

    await expect(callLiquidityApi({ action: 'positions', payload: {} })).rejects.toThrow('Network error. Check your connection and try again.')
  })

  it('handles non-json/network failures safely', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network error')
    }))

    await expect(callLiquidityApi({ action: 'positions', payload: {} })).rejects.toThrow()
  })
})
