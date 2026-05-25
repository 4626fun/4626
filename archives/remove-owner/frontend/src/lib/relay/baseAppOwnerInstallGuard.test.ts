import { describe, expect, it, vi } from 'vitest'

import {
  buildBaseAppSelfAuthPart1BlockedMessage,
  isBaseAppSelfAuthRelayPart1Blocked,
  mapBaseAppOwnerInstallSubmissionError,
} from '@/lib/relay/baseAppOwnerInstallGuard'
import { BASE_APP_SUBSTITUTED_SIGNER_ERROR } from '@/lib/relay/submitRelayPart1SelfFunded'

vi.mock('@/lib/wallet/inAppBrowser', () => ({
  isBaseAppInAppContext: vi.fn(() => true),
  externalBrowserUrlFor: vi.fn((path: string) => `https://4626.fun${path}`),
}))

describe('baseAppOwnerInstallGuard', () => {
  it('blocks Base App self-auth when no exportable EOA owner is connected', () => {
    expect(
      isBaseAppSelfAuthRelayPart1Blocked({
        isSelfAuthSession: true,
        hasConnectedOnchainEoaOwner: false,
      }),
    ).toBe(true)
  })

  it('allows EOA-owner lane inside Base App', () => {
    expect(
      isBaseAppSelfAuthRelayPart1Blocked({
        isSelfAuthSession: true,
        hasConnectedOnchainEoaOwner: true,
      }),
    ).toBe(false)
  })

  it('includes external browser guidance in blocked message', () => {
    expect(buildBaseAppSelfAuthPart1BlockedMessage()).toContain('https://4626.fun/waitlist?setup=owner-install')
  })

  it('maps substituted signer errors to external browser guidance', () => {
    expect(
      mapBaseAppOwnerInstallSubmissionError(`${BASE_APP_SUBSTITUTED_SIGNER_ERROR}: details`),
    ).toContain('Chrome or Safari')
  })
})
