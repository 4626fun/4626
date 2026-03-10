import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class MockCoinbaseSmartWalletHelperError extends Error {
    code: string
    retryable: boolean

    constructor(code: string, retryable: boolean, message?: string) {
      super(message ?? code)
      this.name = 'CoinbaseSmartWalletHelperError'
      this.code = code
      this.retryable = retryable
    }
  }

  return {
    MockCoinbaseSmartWalletHelperError,
    readContract: vi.fn(),
    walletRpc: vi.fn(),
    resolvePrivyCoinbaseSmartWalletOwnerContext: vi.fn(),
  }
})

vi.mock('../../server/_lib/privyCoinbaseSmartWallet.js', () => ({
  CoinbaseSmartWalletHelperError: mocks.MockCoinbaseSmartWalletHelperError,
  isCoinbaseSmartWalletHelperError: (error: unknown) =>
    error instanceof mocks.MockCoinbaseSmartWalletHelperError ||
    (typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string' &&
      typeof (error as { retryable?: unknown }).retryable === 'boolean'),
  resolvePrivyCoinbaseSmartWalletOwnerContext: mocks.resolvePrivyCoinbaseSmartWalletOwnerContext,
}))

vi.mock('../../server/_lib/privyWalletApi.js', () => ({
  walletRpc: mocks.walletRpc,
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mocks.readContract,
    })),
  }
})

import { createPrivyScwSigner } from '../../server/_lib/privyXmtpSigner.ts'

describe('createPrivyScwSigner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readContract.mockResolvedValue(`0x${'12'.repeat(32)}`)
    mocks.walletRpc.mockResolvedValue({
      data: { signature: `0x${'34'.repeat(65)}` },
    })
  })

  it.each([
    ['stored_owner_mismatch', false],
    ['privy_wallet_not_csw_owner', false],
  ])(
    'preserves typed helper metadata for permanent owner-index failures: %s',
    async (code, retryable) => {
      mocks.resolvePrivyCoinbaseSmartWalletOwnerContext.mockRejectedValueOnce(
        new mocks.MockCoinbaseSmartWalletHelperError(code, retryable),
      )

      const signer = createPrivyScwSigner({
        walletId: 'wallet-123',
        cswAddress: '0x1111111111111111111111111111111111111111',
      })

      await expect(signer.signMessage('hello world')).rejects.toMatchObject({
        message: expect.stringContaining('xmtp_owner_index_resolution_failed'),
        code,
        retryable,
      })
    },
  )
})
