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
  prepareError: 'Messaging signer is not ready yet. Click Connect messaging again.',
  xmtpError: 'Messaging signer is not ready yet. Click Connect messaging again.',
}

describe('deriveWaitlistXmtpPhase', () => {
  it('prefers group_syncing over connect_error when join already executed', () => {
    expect(deriveWaitlistXmtpPhase(baseInput)).toBe('group_syncing')
  })

  it('returns chat_ready when the waitlist group conversation is present', () => {
    expect(
      deriveWaitlistXmtpPhase({
        ...baseInput,
        hasGroupConversation: true,
        xmtpStatus: 'connected',
      }),
    ).toBe('chat_ready')
  })
})
