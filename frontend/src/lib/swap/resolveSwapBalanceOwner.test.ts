import { describe, expect, it } from 'vitest'

import { TARGET_CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

import { resolveSwapBalanceOwner } from './resolveSwapBalanceOwner'

describe('resolveSwapBalanceOwner', () => {
  it('maps allowed owner EOAs to the policy canonical CSW when profile canonical is the agent CSW', () => {
    expect(
      resolveSwapBalanceOwner({
        accountMeCanonicalCsw: TARGET_CANONICAL_CSW_ADDRESS,
        privyEmbeddedEoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      }),
    ).toBe(TARGET_CANONICAL_CSW_ADDRESS)
  })

  it('keeps a personal canonical CSW for balance reads even when signer is a shared allowed owner EOA', () => {
    const personalCsw = '0x1111111111111111111111111111111111111111'
    expect(
      resolveSwapBalanceOwner({
        accountMeCanonicalCsw: personalCsw,
        privyEmbeddedEoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      }),
    ).toBe(personalCsw)
  })

  it('prefers account-me canonical CSW when policy does not apply', () => {
    expect(
      resolveSwapBalanceOwner({
        accountMeCanonicalCsw: '0x1111111111111111111111111111111111111111',
        accountContextCsw: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe('0x1111111111111111111111111111111111111111')
  })

  it('falls back to execution address when no CSW is known', () => {
    expect(
      resolveSwapBalanceOwner({
        executionAddress: '0x3333333333333333333333333333333333333333',
      }),
    ).toBe('0x3333333333333333333333333333333333333333')
  })
})
