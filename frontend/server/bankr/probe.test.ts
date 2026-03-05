import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  bankrGetMeMock,
  isBankrConfiguredMock,
} = vi.hoisted(() => ({
  bankrGetMeMock: vi.fn(),
  isBankrConfiguredMock: vi.fn(),
}))

vi.mock('./client.js', () => ({
  bankrGetMe: bankrGetMeMock,
  isBankrConfigured: isBankrConfiguredMock,
}))

import { probeBankrCanonicalWalletMatch } from './probe.ts'

describe('probeBankrCanonicalWalletMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isBankrConfiguredMock.mockReturnValue(true)
    bankrGetMeMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        success: true,
        wallets: [{ chain: 'evm', address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }],
      },
    })
  })

  it('returns not configured when BANKR_API_KEY is missing', async () => {
    isBankrConfiguredMock.mockReturnValueOnce(false)
    const result = await probeBankrCanonicalWalletMatch({
      canonicalWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
    })
    expect(result.configured).toBe(false)
    expect(result.reason).toBe('bankr_not_configured')
  })

  it('returns identity unavailable when /agent/me fails', async () => {
    bankrGetMeMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'Agent API access not enabled',
    })
    const result = await probeBankrCanonicalWalletMatch({
      canonicalWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
    })
    expect(result.walletMatch).toBe(false)
    expect(result.reason).toBe('bankr_identity_unavailable')
  })

  it('returns wallet mismatch when evm wallet differs', async () => {
    const result = await probeBankrCanonicalWalletMatch({
      canonicalWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
    })
    expect(result.walletMatch).toBe(false)
    expect(result.reason).toBe('wallet_mismatch')
  })

  it('returns wallet match when canonical wallet appears in evm list', async () => {
    bankrGetMeMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        success: true,
        wallets: [
          { chain: 'solana', address: '5FHwkrdxkAoGQ...' },
          { chain: 'evm', address: '0xab6d5c10b03300326cd7fab7267ae192842967b5' },
        ],
      },
    })
    const result = await probeBankrCanonicalWalletMatch({
      canonicalWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signerWallet: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
    })
    expect(result.walletMatch).toBe(true)
    expect(result.reason).toBe('wallet_match')
  })
})
