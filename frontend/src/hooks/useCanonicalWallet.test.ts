import { describe, expect, it } from 'vitest'

import { pickCanonicalSmartWalletAddress, type WaitlistMeData } from './canonicalWalletUtils'

describe('pickCanonicalSmartWalletAddress', () => {
  it('prefers canonical connected account over fallback fields', () => {
    const row: WaitlistMeData = {
      cswAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      connectedAccounts: [
        {
          address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          isCanonicalSmartWallet: true,
          provider: 'coinbase',
        },
      ],
    }
    expect(pickCanonicalSmartWalletAddress(row)).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  })

  it('prefers non-privy canonical account when both exist', () => {
    const row: WaitlistMeData = {
      connectedAccounts: [
        {
          address: '0xcccccccccccccccccccccccccccccccccccccccc',
          isCanonicalSmartWallet: true,
          provider: 'privy',
          verifiedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          address: '0xdddddddddddddddddddddddddddddddddddddddd',
          isCanonicalSmartWallet: true,
          provider: 'coinbase',
          verifiedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    }
    expect(pickCanonicalSmartWalletAddress(row)).toBe('0xdddddddddddddddddddddddddddddddddddddddd')
  })

  it('falls back to cswAddress when no canonical account exists', () => {
    const row: WaitlistMeData = {
      cswAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      connectedAccounts: [],
    }
    expect(pickCanonicalSmartWalletAddress(row)).toBe('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
  })

  it('returns null when no valid candidate exists', () => {
    const row: WaitlistMeData = {
      cswAddress: 'not-an-address',
      connectedAccounts: [{ address: 'also-bad', isCanonicalSmartWallet: true }],
    }
    expect(pickCanonicalSmartWalletAddress(row)).toBeNull()
  })
})

