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
})
