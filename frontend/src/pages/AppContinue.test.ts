import { describe, expect, it } from 'vitest'

import { getAppContinueRetryDirective, shouldScheduleReadyWithoutSessionTimeout } from './AppContinue'

describe('getAppContinueRetryDirective', () => {
  it('uses email-first Privy login for waitlist handoff recovery', () => {
    expect(getAppContinueRetryDirective({ privyAuthenticated: false })).toEqual({
      resetState: 'idle',
      clearError: true,
      shouldForceLogout: false,
      loginOptions: { loginMethods: ['email', 'wallet'] },
    })
  })

  it('forces logout before email-first reauth when Privy is already authenticated', () => {
    expect(getAppContinueRetryDirective({ privyAuthenticated: true })).toEqual({
      resetState: 'idle',
      clearError: true,
      shouldForceLogout: true,
      loginOptions: { loginMethods: ['email', 'wallet'] },
    })
  })
})

describe('shouldScheduleReadyWithoutSessionTimeout', () => {
  it('schedules timeout when handoff is ready but session address is missing', () => {
    expect(
      shouldScheduleReadyWithoutSessionTimeout({
        autoLogin: true,
        fromWaitlist: true,
        handoffState: 'ready',
        authAddress: null,
      }),
    ).toBe(true)
  })

  it('does not schedule timeout when session address is present', () => {
    expect(
      shouldScheduleReadyWithoutSessionTimeout({
        autoLogin: true,
        fromWaitlist: true,
        handoffState: 'ready',
        authAddress: '0x1234567890123456789012345678901234567890',
      }),
    ).toBe(false)
  })

  it('does not schedule timeout outside waitlist autologin flow', () => {
    expect(
      shouldScheduleReadyWithoutSessionTimeout({
        autoLogin: false,
        fromWaitlist: true,
        handoffState: 'ready',
        authAddress: null,
      }),
    ).toBe(false)
  })
})
