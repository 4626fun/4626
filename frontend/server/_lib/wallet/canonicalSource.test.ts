import { describe, expect, it } from 'vitest'

import {
  CANONICAL_SOURCE_BASE_ACCOUNT,
  CANONICAL_SOURCE_PRIVY_CSW,
  CANONICAL_SOURCE_WALLET_SYNC,
  resolveSyncedCanonicalSource,
} from './canonicalSource.js'

const CSW = '0xAb6d5C10b03300326cd7fab7267ae192842967b5'

describe('resolveSyncedCanonicalSource', () => {
  it('tags Privy-provisioned coinbase_wallet as privy_csw', () => {
    expect(
      resolveSyncedCanonicalSource({
        privyUser: { linkedAccounts: [] },
        canonicalSmartWallet: { address: CSW, provider: 'coinbase_wallet' },
      }),
    ).toBe(CANONICAL_SOURCE_PRIVY_CSW)
  })

  it('tags Base App linked accounts as base_account', () => {
    expect(
      resolveSyncedCanonicalSource({
        privyUser: {
          linkedAccounts: [{ type: 'base_account', address: CSW }],
        },
        canonicalSmartWallet: { address: CSW, provider: 'coinbase_wallet' },
      }),
    ).toBe(CANONICAL_SOURCE_BASE_ACCOUNT)
  })

  it('tags Zora cross-app as wallet_sync', () => {
    expect(
      resolveSyncedCanonicalSource({
        privyUser: {
          linkedAccounts: [
            { type: 'cross_app', providerAppId: 'clpgf04wn04hnkw0fv1m11mnb' },
          ],
        },
        canonicalSmartWallet: { address: CSW, provider: 'coinbase_smart_wallet' },
      }),
    ).toBe(CANONICAL_SOURCE_WALLET_SYNC)
  })

  it('honors persisted canonical_source when present', () => {
    expect(
      resolveSyncedCanonicalSource({
        privyUser: { linkedAccounts: [{ type: 'base_account' }] },
        canonicalSmartWallet: { address: CSW, provider: 'coinbase_wallet' },
        persistedCanonicalSource: CANONICAL_SOURCE_PRIVY_CSW,
      }),
    ).toBe(CANONICAL_SOURCE_PRIVY_CSW)
  })
})
