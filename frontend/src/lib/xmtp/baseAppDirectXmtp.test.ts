import { describe, expect, it } from 'vitest'

import {
  isBaseAppDirectXmtpPath,
  resolveBaseAppDirectXmtpIdentity,
} from './baseAppDirectXmtp'

const CSW = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const EOA = '0xcccccccccccccccccccccccccccccccccccccccc'

const coinbaseConnector = { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' }
const baseAccountConnector = { id: 'base-account', name: 'Base Account' }
const privyConnector = { id: 'privy-embedded-waitlist', name: 'Privy' }

describe('baseAppDirectXmtp', () => {
  it('accepts Base App CSW when wagmi address matches canonical CSW', () => {
    expect(
      isBaseAppDirectXmtpPath({
        connectedAddress: CSW,
        canonicalCswAddress: CSW,
        connector: coinbaseConnector,
      }),
    ).toBe(true)
  })

  it('accepts Sign in with Base (base-account) when address matches canonical CSW', () => {
    expect(
      isBaseAppDirectXmtpPath({
        connectedAddress: CSW,
        canonicalCswAddress: CSW,
        connector: baseAccountConnector,
      }),
    ).toBe(true)
  })

  it('rejects embedded EOA connected to a different canonical CSW', () => {
    expect(
      isBaseAppDirectXmtpPath({
        connectedAddress: EOA,
        canonicalCswAddress: CSW,
        connector: coinbaseConnector,
      }),
    ).toBe(false)
  })

  it('rejects CSW match without Coinbase/Base Account connector', () => {
    expect(
      isBaseAppDirectXmtpPath({
        connectedAddress: CSW,
        canonicalCswAddress: CSW,
        connector: privyConnector,
      }),
    ).toBe(false)
  })

  it('resolves CSW identity with smart-wallet flag', () => {
    expect(
      resolveBaseAppDirectXmtpIdentity({
        connectedAddress: CSW,
        canonicalCswAddress: CSW,
        connector: coinbaseConnector,
      }),
    ).toEqual({
      identityAddress: CSW.toLowerCase(),
      isCanonicalSmartWallet: true,
    })
  })
})
