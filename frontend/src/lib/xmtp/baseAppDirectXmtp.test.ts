import { describe, expect, it } from 'vitest'

import {
  isBaseAppDirectXmtpPath,
  resolveBaseAppDirectXmtpIdentity,
} from './baseAppDirectXmtp'

const CSW = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const EOA = '0xcccccccccccccccccccccccccccccccccccccccc'

const coinbaseConnector = { id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' }
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

  it('rejects embedded EOA connected to a different canonical CSW', () => {
    expect(
      isBaseAppDirectXmtpPath({
        connectedAddress: EOA,
        canonicalCswAddress: CSW,
        connector: coinbaseConnector,
      }),
    ).toBe(false)
  })

  it('rejects CSW match without Coinbase connector', () => {
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
