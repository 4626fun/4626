import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, parseAbiParameters } from 'viem'

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

const MIGRATION_DATA_ABI = parseAbiParameters(
  '(address,address,uint24,int24,address),bytes32,(address,address,uint24,int24,address),bytes32',
)

describe('fetchMigratedCoins single-flight behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    globalThis.localStorage?.clear()
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

  it('does not run eth_getCode trust checks in browser by default', async () => {
    ;(globalThis as Record<string, unknown>).window = {}
    const coin = '0x1de553883334a880e7149597f3d67ffdf2e0fa85'
    const data = encodeAbiParameters(MIGRATION_DATA_ABI, [
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0xfff800b76768da8ab6aab527021e4a6a91219040'],
      '0xcf4efcb82f84ae2cd6542c959d4c50f2e304124d3797eb808324ab6d45d76ef4',
      ['0x1111111111166b7fe7bd91427724b487980afc69', coin, 30_000, 200, '0x5e5d19d22c85a4aef7c1fdf25fb22a5a38f71040'],
      '0x30ce7b1bccbca555d6e51fa6154ec739c74a1ece444cf5d0e4f6bdf6e5be2136',
    ])

    mockRequest.mockImplementation(async (args: { method?: string }) => {
      if (args?.method === 'eth_getLogs') {
        return [{ address: coin, data }]
      }
      if (args?.method === 'eth_chainId') return '0x2105'
      if (args?.method === 'eth_getCode') return '0x'
      return '0x'
    })

    const { fetchMigratedCoins } = await import('./migrations')
    await fetchMigratedCoins()

    const getCodeCalls = mockRequest.mock.calls.filter(([args]) => args?.method === 'eth_getCode')
    expect(getCodeCalls).toHaveLength(0)
  })
})
