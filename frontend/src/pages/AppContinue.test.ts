import { describe, expect, it } from 'vitest'

import {
  getAppContinueRetryDirective,
  resolveAppContinueHandoffDecision,
  shouldBootstrapTelegramMiniAppFlow,
  shouldScheduleReadyWithoutSessionTimeout,
} from './AppContinue'

describe('getAppContinueRetryDirective', () => {
  it('uses email-first Privy login for handoff recovery', () => {
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
        handoffState: 'ready',
        authAddress: null,
      }),
    ).toBe(true)
  })

  it('does not schedule timeout when session address is present', () => {
    expect(
      shouldScheduleReadyWithoutSessionTimeout({
        handoffState: 'ready',
        authAddress: '0x1234567890123456789012345678901234567890',
      }),
    ).toBe(false)
  })

  it('does not schedule timeout before handoff is ready', () => {
    expect(
      shouldScheduleReadyWithoutSessionTimeout({
        handoffState: 'bridging',
        authAddress: null,
      }),
    ).toBe(false)
  })
})

describe('shouldBootstrapTelegramMiniAppFlow', () => {
  it('only treats telegram link routes as Mini App handoff when Telegram WebApp is absent', () => {
    expect(shouldBootstrapTelegramMiniAppFlow({ nextPath: '/telegram/link', hasTelegramWebApp: false })).toBe(true)
    expect(shouldBootstrapTelegramMiniAppFlow({ nextPath: '/swap', hasTelegramWebApp: false })).toBe(false)
  })

  it('treats in-app Telegram WebApp context as Mini App handoff regardless of path', () => {
    expect(shouldBootstrapTelegramMiniAppFlow({ nextPath: '/continue', hasTelegramWebApp: true })).toBe(true)
  })
})

describe('resolveAppContinueHandoffDecision', () => {
  it('prefers redeeming a one-time handoff code before any Privy fallback', () => {
    expect(
      resolveAppContinueHandoffDecision({
        handoffState: 'idle',
        handoffCode: 'handoff-123',
        handoffRedeemAttempted: false,
        privyReady: false,
        privyAuthenticated: false,
        loginAttempted: false,
      }),
    ).toBe('redeem_handoff')
  })

  it('falls back to email-first Privy login after handoff redeem is exhausted', () => {
    expect(
      resolveAppContinueHandoffDecision({
        handoffState: 'signingIn',
        handoffCode: 'handoff-123',
        handoffRedeemAttempted: true,
        privyReady: true,
        privyAuthenticated: false,
        loginAttempted: false,
      }),
    ).toBe('start_login')
  })

  it('bridges an already-authenticated Privy session after handoff recovery', () => {
    expect(
      resolveAppContinueHandoffDecision({
        handoffState: 'bridging',
        handoffCode: '',
        handoffRedeemAttempted: true,
        privyReady: true,
        privyAuthenticated: true,
        loginAttempted: true,
      }),
    ).toBe('bridge_existing_session')
  })

  it('waits for Privy readiness instead of re-triggering login loops', () => {
    expect(
      resolveAppContinueHandoffDecision({
        handoffState: 'signingIn',
        handoffCode: '',
        handoffRedeemAttempted: true,
        privyReady: false,
        privyAuthenticated: false,
        loginAttempted: false,
      }),
    ).toBe('wait_for_privy')

    expect(
      resolveAppContinueHandoffDecision({
        handoffState: 'signingIn',
        handoffCode: '',
        handoffRedeemAttempted: true,
        privyReady: true,
        privyAuthenticated: false,
        loginAttempted: true,
      }),
    ).toBe('wait_for_privy')
  })
})
