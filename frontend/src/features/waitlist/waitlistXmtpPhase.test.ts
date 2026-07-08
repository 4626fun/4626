import { describe, expect, it } from 'vitest'

import { deriveWaitlistXmtpPhase } from './waitlistXmtpPhase'

const baseInput = {
  signingReady: true,
  statusLoading: false,
  statusError: false,
  configured: true,
  serviceUnavailable: false,
  chatReady: true,
  localStateResetRequired: false,
  xmtpStatus: 'error' as const,
  joinStatus: 'executed' as const,
  hasGroupConversation: false,
  syncTimedOut: false,
  needsConnectMessaging: true,
  messagingConnected: false,
  prepareError: 'Messaging signer is not ready yet. Click Connect messaging again.',
  xmtpError: 'Messaging signer is not ready yet. Click Connect messaging again.',
}

describe('deriveWaitlistXmtpPhase', () => {
  it('routes executed-but-disconnected joins to connect_error, not group_syncing', () => {
    expect(deriveWaitlistXmtpPhase(baseInput)).toBe('connect_error')
  })

  it('shows connect_prompt when join executed but messaging is not connected and there is no error', () => {
    expect(
      deriveWaitlistXmtpPhase({
        ...baseInput,
        xmtpStatus: 'idle',
        needsConnectMessaging: true,
        prepareError: null,
        xmtpError: null,
      }),
    ).toBe('connect_prompt')
  })

  it('shows group_syncing only after local XMTP is connected', () => {
    expect(
      deriveWaitlistXmtpPhase({
        ...baseInput,
        xmtpStatus: 'connected',
        messagingConnected: true,
        needsConnectMessaging: false,
        prepareError: null,
        xmtpError: null,
      }),
    ).toBe('group_syncing')
  })

  it('returns chat_ready when the waitlist group conversation is present', () => {
    expect(
      deriveWaitlistXmtpPhase({
        ...baseInput,
        hasGroupConversation: true,
        xmtpStatus: 'connected',
        messagingConnected: true,
      }),
    ).toBe('chat_ready')
  })
})
