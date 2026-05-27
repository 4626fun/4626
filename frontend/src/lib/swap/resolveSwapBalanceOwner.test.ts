import { describe, expect, it } from 'vitest'

import { TARGET_CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

import { resolveSwapBalanceOwner } from './resolveSwapBalanceOwner'

describe('resolveSwapBalanceOwner', () => {
  it('maps allowed owner EOAs to the policy canonical CSW', () => {
    expect(
      resolveSwapBalanceOwner({
        accountMeCanonicalCsw: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        privyEmbeddedEoa: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      }),
    ).toBe(TARGET_CANONICAL_CSW_ADDRESS)
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
