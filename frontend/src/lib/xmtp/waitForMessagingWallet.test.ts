import { describe, expect, it } from 'vitest'

import {
  isXmtpMessagingWagmiConnector,
  isWaitlistMessagingWagmiConnector,
  WAITLIST_EMBEDDED_CONNECTOR_ID,
} from './waitForMessagingWallet'

describe('isXmtpMessagingWagmiConnector', () => {
  it('accepts waitlist connector ids passed as strings', () => {
    expect(isXmtpMessagingWagmiConnector(WAITLIST_EMBEDDED_CONNECTOR_ID)).toBe(true)
    expect(isXmtpMessagingWagmiConnector('io.privy.wallet')).toBe(true)
  })

  it('accepts coinbase and Base Account connector ids passed as strings', () => {
    expect(isXmtpMessagingWagmiConnector('coinbaseWalletSDK')).toBe(true)
    expect(isXmtpMessagingWagmiConnector('base-account')).toBe(true)
  })

  it('accepts connector objects', () => {
    expect(isXmtpMessagingWagmiConnector({ id: WAITLIST_EMBEDDED_CONNECTOR_ID })).toBe(true)
    expect(isXmtpMessagingWagmiConnector({ id: 'base-account', name: 'Base Account' })).toBe(true)
    expect(isWaitlistMessagingWagmiConnector(WAITLIST_EMBEDDED_CONNECTOR_ID)).toBe(true)
  })
})
