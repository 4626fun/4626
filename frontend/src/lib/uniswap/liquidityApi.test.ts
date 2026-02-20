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

    await expect(callLiquidityApi({ action: 'create', payload: {} })).rejects.toThrow('Approval is required before continuing.')
  })
})
