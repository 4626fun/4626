import { describe, expect, it, vi } from 'vitest'

import {
  fetchTelegramLinkEmailVerificationState,
  formatTelegramSessionError,
  getPrivyEmailState,
  isTelegramLinkEmailVerificationRequiredError,
  normalizeTelegramLinkUiMessage,
  getTelegramLinkSuccessMessage,
  getTelegramLinkViewState,
  isPrivyEmailAlreadyLinkedError,
  pollTelegramLinkEmailVerification,
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
        emailState: 'needs_verification',
        linkState: 'idle',
        sessionError: null,
        emailMessage: null,
        linkMessage: null,
        privyAuthenticated: false,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'warning',
        statusTitle: 'Sign in to 4626',
        canSignIn: true,
        canRetryLink: false,
        statusMessage: 'Sign in to 4626 and verify your email to finish linking.',
      }),
    )
  })

  it('shows verify-email guidance for authenticated but unverified users', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        emailState: 'needs_verification',
        linkState: 'idle',
        sessionError: null,
        emailMessage: null,
        linkMessage: null,
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'warning',
        statusTitle: 'Verify your 4626 email',
        canSignIn: true,
        canRetryLink: false,
        statusMessage:
          'Telegram session is verified. Your 4626 email verification is the remaining step before we can link Telegram.',
      }),
    )
  })

  it('shows retry affordance only after a verified-email link failure with valid context', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        emailState: 'verified',
        linkState: 'error',
        sessionError: null,
        emailMessage: null,
        linkMessage: 'Telegram linking failed.',
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'warning',
        statusTitle: 'Telegram linking needs attention',
        canSignIn: false,
        canRetryLink: true,
        statusMessage: 'Telegram linking failed.',
      }),
    )
  })

  it('prefers session errors over generic authenticated copy', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'error',
        emailState: 'unknown',
        linkState: 'idle',
        sessionError: 'Open this link from Telegram so 4626 can verify your Mini App session.',
        emailMessage: null,
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
        emailState: 'verified',
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
        emailState: 'needs_verification',
        linkState: 'idle',
        alreadyAttemptedForToken: false,
      }),
    ).toBe(false)

    expect(
      shouldAutoStartTelegramLink({
        hasLinkContext: true,
        sessionState: 'ready',
        sessionToken: 'mini-session',
        privyReady: true,
        privyAuthenticated: true,
        emailState: 'verified',
        linkState: 'error',
        alreadyAttemptedForToken: true,
      }),
    ).toBe(false)
  })

  it('detects linked and verified Privy email accounts', () => {
    expect(
      getPrivyEmailState({
        linkedAccounts: [
          {
            type: 'email',
            address: 'akira@example.com',
            verified: true,
          },
        ],
      }),
    ).toEqual({
      hasAnyEmailAccount: true,
      hasVerifiedEmail: true,
    })

    expect(
      getPrivyEmailState({
        linkedAccounts: [
          {
            type: 'email',
            address: 'akira@example.com',
            verified: false,
          },
        ],
      }),
    ).toEqual({
      hasAnyEmailAccount: true,
      hasVerifiedEmail: false,
    })
  })

  it('treats Privy email-already-linked errors as recoverable', () => {
    expect(isPrivyEmailAlreadyLinkedError(new Error('User already has an account of type email linked.'))).toBe(true)
    expect(isPrivyEmailAlreadyLinkedError(new Error('Completely different error'))).toBe(false)
  })

  it('normalizes Privy email-linked UI errors into retry-link guidance', () => {
    expect(normalizeTelegramLinkUiMessage('User already has an account of type email linked.')).toContain(
      'Tap Retry link',
    )
    expect(normalizeTelegramLinkUiMessage('Different failure')).toBe('Different failure')

    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        emailState: 'verified',
        linkState: 'error',
        sessionError: null,
        emailMessage: null,
        linkMessage: 'User already has an account of type email linked.',
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        canSignIn: false,
        canRetryLink: true,
      }),
    )
  })

  it('shows pending verification state without retry-link loop', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        emailState: 'pending',
        linkState: 'idle',
        sessionError: null,
        emailMessage: 'Verification still syncing.',
        linkMessage: null,
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusVariant: 'warning',
        statusTitle: 'Waiting for email verification',
        canSignIn: true,
        canRetryLink: false,
        statusMessage: 'Verification still syncing.',
      }),
    )
  })

  it('detects email-verification-required link errors explicitly', () => {
    expect(isTelegramLinkEmailVerificationRequiredError(new Error('Verify your email with 4626 before linking Telegram.'))).toBe(true)
    expect(isTelegramLinkEmailVerificationRequiredError(new Error('Telegram linking failed.'))).toBe(false)
  })

  it('reads fresh email verification state from /api/accounts/me', async () => {
    const verified = await fetchTelegramLinkEmailVerificationState({
      getAccessToken: async () => 'privy-token',
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { emailVerified: true } }),
      })) as any,
    })
    expect(verified).toEqual({ status: 'verified' })

    const unverified = await fetchTelegramLinkEmailVerificationState({
      getAccessToken: async () => 'privy-token',
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { emailVerified: false } }),
      })) as any,
    })
    expect(unverified).toEqual({ status: 'needs_verification' })
  })

  it('reports account-state fetch failures as recoverable email gate errors', async () => {
    await expect(
      fetchTelegramLinkEmailVerificationState({
        getAccessToken: async () => null,
      }),
    ).resolves.toEqual({
      status: 'error',
      message: 'Could not read your 4626 session. Sign in again and retry linking.',
    })

    await expect(
      fetchTelegramLinkEmailVerificationState({
        getAccessToken: async () => 'privy-token',
        fetchImpl: vi.fn(async () => ({
          ok: false,
          json: async () => ({ success: false, error: 'Still syncing email verification.' }),
        })) as any,
      }),
    ).resolves.toEqual({
      status: 'error',
      message: 'Still syncing email verification.',
    })
  })

  it('polls until email verification completes, then auto-resume can continue', async () => {
    const readState = vi
      .fn<() => Promise<{ status: 'verified' } | { status: 'needs_verification' }>>()
      .mockResolvedValueOnce({ status: 'needs_verification' })
      .mockResolvedValueOnce({ status: 'needs_verification' })
      .mockResolvedValueOnce({ status: 'verified' })

    await expect(
      pollTelegramLinkEmailVerification({
        readState,
        intervalMs: 1,
        sleepImpl: async () => {},
      }),
    ).resolves.toEqual({ status: 'verified' })
    expect(readState).toHaveBeenCalledTimes(3)
  })

  it('stops polling in a pending state when verification never arrives', async () => {
    const readState = vi.fn(async () => ({ status: 'needs_verification' as const }))

    await expect(
      pollTelegramLinkEmailVerification({
        readState,
        maxAttempts: 3,
        intervalMs: 1,
        sleepImpl: async () => {},
      }),
    ).resolves.toEqual({ status: 'needs_verification' })
    expect(readState).toHaveBeenCalledTimes(3)
  })
})
