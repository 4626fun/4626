import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'

const { dlmmSwapMock, privateSubmitMock } = vi.hoisted(() => ({
  dlmmSwapMock: vi.fn(),
  privateSubmitMock: vi.fn(async () => 'jito-sig'),
}))

vi.mock('../utils/solanaDlmmSwap.js', () => ({
  swapWsolToShareOnDlmm: dlmmSwapMock,
}))

vi.mock('../utils/solanaPrivateSubmit.js', () => ({
  sendSolanaTransactionPrivate: privateSubmitMock,
}))

describe('solana share buyback swap mode', () => {
  const envKeys = ['SOLANA_FORWARD_SWAP_MODE', 'JUPITER_QUOTE_API_URL'] as const
  const original = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]))

  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const key of envKeys) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('uses DLMM fallback when SOLANA_FORWARD_SWAP_MODE=dlmm', async () => {
    process.env.SOLANA_FORWARD_SWAP_MODE = 'dlmm'
    dlmmSwapMock.mockResolvedValue({
      signature: 'dlmm-sig',
      inAmount: '100',
      minOutAmount: '90',
      outAmountQuoted: '95',
    })

    const { buyShareWithWsol } = await import('../utils/solanaJupiterSwap.js')
    const result = await buyShareWithWsol({
      connection: {} as any,
      poolAddress: PublicKey.default,
      shareMint: PublicKey.default,
      payer: { publicKey: PublicKey.default } as any,
      inAmount: 100n,
    })

    expect(result.mode).toBe('dlmm')
    expect(result.signature).toBe('dlmm-sig')
    expect(dlmmSwapMock).toHaveBeenCalledTimes(1)
    expect(privateSubmitMock).not.toHaveBeenCalled()
  })

  it('requests Jupiter swap with wrapAndUnwrapSol=false for existing WSOL', async () => {
    process.env.SOLANA_FORWARD_SWAP_MODE = 'jupiter'
    process.env.JUPITER_QUOTE_API_URL = 'https://jup.invalid/v6'
    let sawWrapFalse = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/quote')) {
        return {
          ok: true,
          json: async () => ({
            outAmount: '95',
            otherAmountThreshold: '90',
            routePlan: [],
          }),
        }
      }
      if (url.includes('/swap')) {
        const body = JSON.parse(String(init?.body ?? '{}'))
        sawWrapFalse = body.wrapAndUnwrapSol === false
        return {
          ok: true,
          json: async () => ({
            swapTransaction: Buffer.from('deadbeef', 'hex').toString('base64'),
          }),
        }
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { VersionedTransaction } = await import('@solana/web3.js')
    vi.spyOn(VersionedTransaction, 'deserialize').mockReturnValue({
      sign: vi.fn(),
    } as any)

    const { buyShareWithWsol } = await import('../utils/solanaJupiterSwap.js')
    const result = await buyShareWithWsol({
      connection: {} as any,
      poolAddress: PublicKey.default,
      shareMint: PublicKey.default,
      payer: {
        publicKey: PublicKey.default,
      } as any,
      inAmount: 100n,
    })

    expect(result.mode).toBe('jupiter')
    expect(sawWrapFalse).toBe(true)
    expect(privateSubmitMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
