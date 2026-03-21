import { describe, expect, it } from 'vitest'

import {
  formatTelegramSessionError,
  getTelegramLinkSuccessMessage,
  getTelegramLinkViewState,
  shouldAutoStartTelegramLink,
  shouldShowRetryTelegramSession,
} from './TelegramLink'

describe('TelegramLink helpers', () => {
  it('maps expired Telegram session errors to a retryable message', () => {
    expect(formatTelegramSessionError('session expired', 410)).toContain('expired')
    expect(formatTelegramSessionError('replay detected', 409)).toContain('already used')
  })

  it('maps signature mismatch errors to /link relaunch guidance', () => {
    expect(formatTelegramSessionError('telegram_miniapp_invalid_hash', 401)).toContain('Run /link in Telegram')
  })

  it('returns wallet-setup guidance for non-active link success', () => {
    expect(getTelegramLinkSuccessMessage('active')).toContain('linked successfully')
    expect(getTelegramLinkSuccessMessage('pending_wallet_setup')).toContain('Finish Coinbase Smart Wallet setup')
  })

  it('shows verify-email CTA when session is ready and link context exists', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        linkState: 'idle',
        sessionError: null,
        linkMessage: null,
        privyAuthenticated: false,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'info',
        statusTitle: 'Ready to link',
        canSignIn: true,
        canRetryLink: false,
        statusMessage: 'Verify your email with 4626 to finish linking.',
      }),
    )
  })

  it('shows retry affordance only after a link failure with valid context', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        linkState: 'error',
        sessionError: null,
        linkMessage: 'Telegram linking failed.',
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'warning',
        statusTitle: 'Telegram linking needs attention',
        canSignIn: true,
        canRetryLink: true,
        statusMessage: 'Telegram linking failed.',
      }),
    )
  })

  it('prefers session errors over generic authenticated copy', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'error',
        linkState: 'idle',
        sessionError: 'Open this link from Telegram so 4626 can verify your Mini App session.',
        linkMessage: null,
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'warning',
        statusTitle: 'Telegram linking needs attention',
        canSignIn: false,
        canRetryLink: false,
        statusMessage: 'Open this link from Telegram so 4626 can verify your Mini App session.',
      }),
    )
  })

  it('shows Retry Telegram session only inside Telegram Mini App context', () => {
    expect(
      shouldShowRetryTelegramSession({
        sessionState: 'error',
        telegramMiniAppContext: false,
      }),
    ).toBe(false)

    expect(
      shouldShowRetryTelegramSession({
        sessionState: 'error',
        telegramMiniAppContext: true,
      }),
    ).toBe(true)
  })

  it('auto-starts linking only once from idle state', () => {
    expect(
      shouldAutoStartTelegramLink({
        hasLinkContext: true,
        sessionState: 'ready',
        sessionToken: 'mini-session',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        alreadyAttemptedForToken: false,
      }),
    ).toBe(true)

    expect(
      shouldAutoStartTelegramLink({
        hasLinkContext: true,
        sessionState: 'ready',
        sessionToken: 'mini-session',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'error',
        alreadyAttemptedForToken: true,
      }),
    ).toBe(false)
  })
})
