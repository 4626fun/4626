import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetBlockNumber = vi.hoisted(() => vi.fn(async () => 31_250_001n))
type MockRpcResult = '0x' | '0x2105' | Array<{ address: string; data: `0x${string}` }>
const mockRequest = vi.hoisted(() =>
  vi.fn(async (args: { method?: string }): Promise<MockRpcResult> => {
    if (args?.method === 'eth_getLogs') return [] as Array<{ address: string; data: `0x${string}` }>
    if (args?.method === 'eth_chainId') return '0x2105'
    return '0x'
  }),
)
const mockFetch = vi.hoisted(() =>
  vi.fn(async () =>
    Response.json({
      success: true,
      addresses: [],
      count: 0,
      lastUpdated: Date.now(),
    }),
  ),
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
    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch)
    try {
      delete (globalThis as Record<string, unknown>).window
    } catch {
      // ignore
    }
  })

  it('deduplicates concurrent cache-miss fetches', async () => {
    const { fetchMigratedCoins } = await import('./migrations')

    await Promise.all([fetchMigratedCoins(), fetchMigratedCoins(), fetchMigratedCoins()])

    expect(mockGetBlockNumber).toHaveBeenCalledTimes(1)
  })

  it('uses the migrated coins API in browser instead of eth_getLogs', async () => {
    ;(globalThis as Record<string, unknown>).window = {}
    const { fetchMigratedCoins } = await import('./migrations')

    await fetchMigratedCoins()

    expect(mockFetch).toHaveBeenCalledWith('/api/zora/migratedCoins', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }))
    expect(mockRequest.mock.calls.some(([args]) => args?.method === 'eth_getLogs')).toBe(false)
  })

  it('runs eth_getCode trust checks in browser by default via server API payload', async () => {
    ;(globalThis as Record<string, unknown>).window = {}
    const coin = '0x1de553883334a880e7149597f3d67ffdf2e0fa85'
    mockFetch.mockResolvedValueOnce(
      Response.json({
        success: true,
        addresses: [coin],
        count: 1,
        lastUpdated: Date.now(),
      }),
    )

    const { fetchMigratedCoins } = await import('./migrations')
    const migrated = await fetchMigratedCoins()

    expect(migrated.has(coin.toLowerCase())).toBe(true)
    expect(mockRequest.mock.calls.filter(([args]) => args?.method === 'eth_getCode')).toHaveLength(0)
  })

  it('backs off and retries the same log range when the rpc returns 429', async () => {
    vi.useFakeTimers()
    mockGetBlockNumber.mockResolvedValue(31_250_001n)
    const logRangeCalls: Array<{ fromBlock: string; toBlock: string }> = []

    mockRequest.mockImplementation(async (args: { method?: string; params?: Array<{ fromBlock: string; toBlock: string }> }) => {
      if (args?.method === 'eth_getLogs') {
        const range = args.params?.[0]
        if (range) logRangeCalls.push({ fromBlock: range.fromBlock, toBlock: range.toBlock })
        if (logRangeCalls.length < 3) {
          const error = new Error('Rate limit exceeded') as Error & {
            status?: number
            headers?: Headers
          }
          error.status = 429
          error.headers = new Headers({ 'Retry-After': '1' })
          throw error
        }
        return []
      }
      if (args?.method === 'eth_chainId') return '0x2105'
      return '0x'
    })

    try {
      const { scanMigratedCoinsWithClient } = await import('./migrationScan')
      const client = {
        getBlockNumber: mockGetBlockNumber,
        request: mockRequest,
      }
      const fetchPromise = scanMigratedCoinsWithClient(client, { initialChunkDelta: 1n })

      await vi.runAllTimersAsync()
      const migratedCoins = await fetchPromise

      expect(migratedCoins.size).toBe(0)
      expect(logRangeCalls).toEqual([
        { fromBlock: '0x1dcd650', toBlock: '0x1dcd651' },
        { fromBlock: '0x1dcd650', toBlock: '0x1dcd651' },
        { fromBlock: '0x1dcd650', toBlock: '0x1dcd651' },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts log scanning when the rpc reports pruned history', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGetBlockNumber.mockResolvedValue(31_250_001n)
    mockRequest.mockRejectedValue(new Error('pruned history unavailable'))

    const { scanMigratedCoinsWithClient } = await import('./migrationScan')
    const migratedCoins = await scanMigratedCoinsWithClient(
      {
        getBlockNumber: mockGetBlockNumber,
        request: mockRequest,
      },
      { initialChunkDelta: 1n },
    )

    expect(migratedCoins.size).toBe(0)
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('[migrations] RPC does not retain log history; aborting on-chain migration scan.')
    warnSpy.mockRestore()
  })
})
