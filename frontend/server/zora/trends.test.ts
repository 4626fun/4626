import { beforeEach, describe, expect, it, vi } from 'vitest'

const readContractMock = vi.fn()
const getBytecodeMock = vi.fn()
const waitForTransactionReceiptMock = vi.fn()
const walletRpcMock = vi.fn()
const getOrCreateCreatorAgentWalletMock = vi.fn()

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: readContractMock,
      getBytecode: getBytecodeMock,
      waitForTransactionReceipt: waitForTransactionReceiptMock,
    })),
  }
})

vi.mock('../_lib/privyWalletApi.js', () => ({
  walletRpc: walletRpcMock,
}))

vi.mock('../_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: getOrCreateCreatorAgentWalletMock,
}))

describe('zora trend core', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.BASE_RPC_URL = 'https://mainnet.base.org'
  })

  it('normalizes and validates trend tickers', async () => {
    const { normalizeTrendTicker, validateTrendTicker } = await import('./trends')

    expect(normalizeTrendTicker('  base ai  ')).toBe('BASE AI')
    expect(validateTrendTicker('base-ai').ok).toBe(true)
    expect(validateTrendTicker('   ').ok).toBe(false)
    expect(validateTrendTicker('bad@ticker').ok).toBe(false)
  })

  it('preflights trend address and deployed bytecode status', async () => {
    readContractMock.mockResolvedValueOnce('0x1111111111111111111111111111111111111111')
    getBytecodeMock.mockResolvedValueOnce(undefined)

    const { preflightTrendTicker } = await import('./trends')
    const result = await preflightTrendTicker({ ticker: 'base ai' })

    expect(result.ticker).toBe('BASE AI')
    expect(result.predictedAddress).toBe('0x1111111111111111111111111111111111111111')
    expect(result.deployed).toBe(false)
  })

  it('skips deploy when trend coin already exists', async () => {
    readContractMock.mockResolvedValueOnce('0x2222222222222222222222222222222222222222')
    getBytecodeMock.mockResolvedValueOnce('0x1234')

    const { reserveTrendTicker } = await import('./trends')
    const result = await reserveTrendTicker({
      ticker: 'base',
      creatorToken: '0x3333333333333333333333333333333333333333',
      groupId: 'grp_1',
    })

    expect(result.status).toBe('already_deployed')
    expect(result.deployed).toBe(true)
    expect(walletRpcMock).not.toHaveBeenCalled()
  })

  it('deploys trend coin and confirms bytecode after receipt', async () => {
    getOrCreateCreatorAgentWalletMock.mockResolvedValueOnce({
      walletId: 'wallet_1',
      address: '0x4444444444444444444444444444444444444444',
    })
    readContractMock.mockResolvedValue('0x5555555555555555555555555555555555555555')
    getBytecodeMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce('0x60006000')
    walletRpcMock.mockResolvedValueOnce({ data: { hash: '0xabc123' } })
    waitForTransactionReceiptMock.mockResolvedValueOnce({ status: 'success' })

    const { reserveTrendTicker } = await import('./trends')
    const result = await reserveTrendTicker({
      ticker: 'basex',
      creatorToken: '0x3333333333333333333333333333333333333333',
      groupId: 'grp_2',
      waitForReceipt: true,
    })

    expect(walletRpcMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('deployed')
    expect(result.deployed).toBe(true)
    expect(result.txHash).toBe('0xabc123')
  })
})
