import { beforeEach, describe, expect, it, vi } from 'vitest'

import { syncWaitlistCanonicalWallet } from './syncWaitlistCanonicalWallet'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

describe('syncWaitlistCanonicalWallet', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('returns canonical address when sync succeeds', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { canonicalSmartWallet: { address: '0xAb6d5C10b03300326cd7fab7267ae192842967b5', provider: 'coinbase_wallet' } },
      }),
    })

    const result = await syncWaitlistCanonicalWallet({ maxAttempts: 1 })
    expect(result).toEqual({
      ok: true,
      canonicalAddress: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
    })
  })

  it('surfaces server sync errors', async () => {
    apiFetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Wallet sync failed' }),
    })

    const result = await syncWaitlistCanonicalWallet({ maxAttempts: 1 })
    expect(result).toEqual({ ok: false, error: 'Wallet sync failed' })
  })
})
