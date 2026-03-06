import { describe, expect, it } from 'vitest'

import { getAppContinueRetryDirective } from './AppContinue'

describe('getAppContinueRetryDirective', () => {
  it('uses wallet-only Privy login for waitlist handoff recovery', () => {
    expect(getAppContinueRetryDirective({ privyAuthenticated: false })).toEqual({
      resetState: 'idle',
      clearError: true,
      shouldForceLogout: false,
      loginOptions: { loginMethods: ['wallet'] },
    })
  })

  it('forces logout before wallet-only reauth when Privy is already authenticated', () => {
    expect(getAppContinueRetryDirective({ privyAuthenticated: true })).toEqual({
      resetState: 'idle',
      clearError: true,
      shouldForceLogout: true,
      loginOptions: { loginMethods: ['wallet'] },
    })
  })
})
