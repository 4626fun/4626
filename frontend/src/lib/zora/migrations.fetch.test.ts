import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetBlockNumber = vi.hoisted(() => vi.fn(async () => 31_250_001n))
const mockRequest = vi.hoisted(() =>
  vi.fn(async (args: { method?: string }) => {
    if (args?.method === 'eth_getLogs') return []
    if (args?.method === 'eth_chainId') return '0x2105'
    return '0x'
  }),
)

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: mockGetBlockNumber,
      request: mockRequest,
    })),
  }
})

describe('fetchMigratedCoins single-flight behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    globalThis.localStorage?.clear()
  })

  it('deduplicates concurrent cache-miss fetches', async () => {
    const { fetchMigratedCoins } = await import('./migrations')

    await Promise.all([fetchMigratedCoins(), fetchMigratedCoins(), fetchMigratedCoins()])

    expect(mockGetBlockNumber).toHaveBeenCalledTimes(1)
  })
})
