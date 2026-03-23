import { describe, expect, it, vi } from 'vitest'

import {
  fetchTelegramLinkEmailVerificationState,
  canStartTelegramLink,
  formatTelegramSessionError,
  getTelegramLinkPrimaryActionLabel,
  getTelegramLinkSteps,
  getPrivyEmailState,
  isPrivyTelegramAlreadyLinkedError,
  isTelegramLinkEmailVerificationRequiredError,
  linkPrivyTelegramInMiniApp,
  normalizeTelegramLinkUiMessage,
  getTelegramLinkSuccessMessage,
  getTelegramLinkViewState,
  isPrivyEmailAlreadyLinkedError,
  pollTelegramLinkEmailVerification,
  resolveTelegramLinkAuthSettlementPlan,
  resolveTelegramLinkEmailAuthAction,
  shouldAutoRefreshTelegramLinkEmail,
  shouldRetryTelegramLinkEmailVerification,
  shouldRefreshTelegramLinkEmailOnForeground,
  shouldResetTelegramMiniAppSessionForLinkError,
  shouldAutoStartTelegramLink,
  shouldShowResetTelegramLinkAccount,
  shouldShowRetryTelegramSession,
  waitForTelegramLinkPrivyAuth,
} from './TelegramLink'

describe('TelegramLink helpers', () => {
  it('maps expired Telegram session errors to a retryable message', () => {
    expect(formatTelegramSessionError('session expired', 410)).toContain('expired')
    expect(formatTelegramSessionError('replay detected', 409)).toContain('already used')
  })

  it('maps timed-out or unreachable Telegram session checks to retry guidance', () => {
    expect(formatTelegramSessionError('telegram_miniapp_session_timeout', 504)).toContain('timed out')
    expect(formatTelegramSessionError('telegram_miniapp_session_unreachable', 503)).toContain('Could not reach')
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

  it('shows explicit finish-link guidance once email verification is complete', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        emailState: 'verified',
        linkState: 'idle',
        sessionError: null,
        emailMessage: null,
        linkMessage: null,
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusTitle: 'Ready to link',
        statusMessage: 'Telegram session is verified and your 4626 email is confirmed. Tap Link Telegram to finish the handshake.',
      }),
    )
  })

  it('builds staged progress for the happy path flow', () => {
    expect(
      getTelegramLinkSteps({
        sessionState: 'ready',
        emailState: 'verified',
        linkState: 'linking',
        sessionError: null,
        emailMessage: null,
        linkMessage: null,
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual([
      expect.objectContaining({ id: 'telegram', status: 'complete' }),
      expect.objectContaining({ id: 'email', status: 'complete' }),
      expect.objectContaining({ id: 'link', status: 'current' }),
    ])
  })

  it('marks email as required when telegram is ready but the 4626 account is not verified', () => {
    expect(
      getTelegramLinkSteps({
        sessionState: 'ready',
        emailState: 'needs_verification',
        linkState: 'idle',
        sessionError: null,
        emailMessage: null,
        linkMessage: null,
        privyAuthenticated: false,
        hasLinkContext: true,
      }),
    ).toEqual([
      expect.objectContaining({ id: 'telegram', status: 'complete' }),
      expect.objectContaining({ id: 'email', status: 'required' }),
      expect.objectContaining({ id: 'link', status: 'pending' }),
    ])
  })

  it('uses direct labels for the primary email CTA', () => {
    expect(
      getTelegramLinkPrimaryActionLabel({
        canSignIn: true,
        privyAuthenticated: false,
      }),
    ).toBe('Verify email with 4626')

    expect(
      getTelegramLinkPrimaryActionLabel({
        canSignIn: true,
        privyAuthenticated: true,
      }),
    ).toBe('Verify your 4626 email')

    expect(
      getTelegramLinkPrimaryActionLabel({
        canSignIn: false,
        privyAuthenticated: true,
      }),
    ).toBeNull()
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

  it('shows account reset affordance for authenticated users stuck before email verification', () => {
    expect(
      shouldShowResetTelegramLinkAccount({
        sessionState: 'ready',
        hasLinkContext: true,
        privyAuthenticated: true,
        linkState: 'idle',
      }),
    ).toBe(true)
  })

  it('hides account reset affordance when the user is unauthenticated or already linking', () => {
    expect(
      shouldShowResetTelegramLinkAccount({
        sessionState: 'ready',
        hasLinkContext: true,
        privyAuthenticated: false,
        linkState: 'idle',
      }),
    ).toBe(false)

    expect(
      shouldShowResetTelegramLinkAccount({
        sessionState: 'ready',
        hasLinkContext: true,
        privyAuthenticated: true,
        linkState: 'linking',
      }),
    ).toBe(false)
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

  it('enables the explicit Link Telegram action only when the handshake is ready', () => {
    expect(
      canStartTelegramLink({
        hasLinkContext: true,
        sessionState: 'ready',
        sessionToken: 'mini-session',
        privyReady: true,
        privyAuthenticated: true,
        emailState: 'verified',
        linkState: 'idle',
      }),
    ).toBe(true)

    expect(
      canStartTelegramLink({
        hasLinkContext: true,
        sessionState: 'ready',
        sessionToken: 'mini-session',
        privyReady: true,
        privyAuthenticated: true,
        emailState: 'pending',
        linkState: 'idle',
      }),
    ).toBe(false)
  })

  it('prefers Privy email-linking for authenticated users until email is verified', () => {
    expect(
      resolveTelegramLinkEmailAuthAction({
        hasAnyEmailAccount: true,
        hasVerifiedEmail: false,
        canLinkEmail: true,
      }),
    ).toBe('link_email')

    expect(
      resolveTelegramLinkEmailAuthAction({
        hasAnyEmailAccount: true,
        hasVerifiedEmail: true,
        canLinkEmail: true,
      }),
    ).toBe('verified')

    expect(
      resolveTelegramLinkEmailAuthAction({
        hasAnyEmailAccount: false,
        hasVerifiedEmail: false,
        canLinkEmail: true,
      }),
    ).toBe('link_email')

    expect(
      resolveTelegramLinkEmailAuthAction({
        hasAnyEmailAccount: true,
        hasVerifiedEmail: false,
        canLinkEmail: false,
      }),
    ).toBe('login')
  })


  it('waits for a fresh Privy session when authenticated users launch email login again', () => {
    expect(
      resolveTelegramLinkAuthSettlementPlan({
        startedAuthenticated: true,
        launchedLogin: true,
        priorAccessToken: 'old-token',
      }),
    ).toEqual({
      shouldWaitForAuth: true,
      requireFreshAccessToken: 'old-token',
    })

    expect(
      resolveTelegramLinkAuthSettlementPlan({
        startedAuthenticated: true,
        launchedLogin: false,
        priorAccessToken: 'old-token',
      }),
    ).toEqual({
      shouldWaitForAuth: false,
      requireFreshAccessToken: null,
    })

    expect(
      resolveTelegramLinkAuthSettlementPlan({
        startedAuthenticated: false,
        launchedLogin: true,
        priorAccessToken: 'old-token',
      }),
    ).toEqual({
      shouldWaitForAuth: true,
      requireFreshAccessToken: null,
    })
  })

  it('auto-refreshes account email state only from the initial unknown state', () => {
    expect(
      shouldAutoRefreshTelegramLinkEmail({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        linkState: 'idle',
        emailState: 'unknown',
      }),
    ).toBe(true)

    expect(
      shouldAutoRefreshTelegramLinkEmail({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        linkState: 'idle',
        emailState: 'needs_verification',
      }),
    ).toBe(false)
  })

  it('refreshes the email gate when Telegram regains foreground after auth work', () => {
    expect(
      shouldRefreshTelegramLinkEmailOnForeground({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        emailState: 'needs_verification',
      }),
    ).toBe(true)

    expect(
      shouldRefreshTelegramLinkEmailOnForeground({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        emailState: 'pending',
      }),
    ).toBe(true)
  })

  it('does not foreground-refresh once Telegram linking is already settled', () => {
    expect(
      shouldRefreshTelegramLinkEmailOnForeground({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'linked',
        emailState: 'needs_verification',
      }),
    ).toBe(false)

    expect(
      shouldRefreshTelegramLinkEmailOnForeground({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        emailState: 'verified',
      }),
    ).toBe(false)
  })

  it('keeps retrying email verification after the user has started the OTP flow', () => {
    expect(
      shouldRetryTelegramLinkEmailVerification({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        emailState: 'needs_verification',
        verificationAttempted: true,
      }),
    ).toBe(true)

    expect(
      shouldRetryTelegramLinkEmailVerification({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        emailState: 'pending',
        verificationAttempted: true,
      }),
    ).toBe(true)
  })

  it('does not retry email verification before the user starts or after link completion', () => {
    expect(
      shouldRetryTelegramLinkEmailVerification({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'idle',
        emailState: 'needs_verification',
        verificationAttempted: false,
      }),
    ).toBe(false)

    expect(
      shouldRetryTelegramLinkEmailVerification({
        hasLinkContext: true,
        sessionState: 'ready',
        privyReady: true,
        privyAuthenticated: true,
        linkState: 'linked',
        emailState: 'pending',
        verificationAttempted: true,
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

  it('detects verified email accounts from server-style snake_case numeric timestamps', () => {
    expect(
      getPrivyEmailState({
        linked_accounts: [
          {
            type: 'email',
            address: 'akira@example.com',
            verified_at: 1674788927,
          },
        ],
      }),
    ).toEqual({
      hasAnyEmailAccount: true,
      hasVerifiedEmail: true,
    })
  })

  it('treats Privy email-already-linked errors as recoverable', () => {
    expect(isPrivyEmailAlreadyLinkedError(new Error('User already has an account of type email linked.'))).toBe(true)
    expect(isPrivyEmailAlreadyLinkedError(new Error('Completely different error'))).toBe(false)
  })

  it('treats Privy telegram-already-linked errors as recoverable', () => {
    expect(isPrivyTelegramAlreadyLinkedError(new Error('User already has an account of type telegram linked.'))).toBe(true)
    expect(isPrivyTelegramAlreadyLinkedError(new Error('Telegram already linked to this account.'))).toBe(true)
    expect(isPrivyTelegramAlreadyLinkedError(new Error('Completely different error'))).toBe(false)
  })

  it('links Privy Telegram account in Mini App when launch params are available', async () => {
    const linkTelegram = vi.fn(async () => {})
    await expect(
      linkPrivyTelegramInMiniApp({
        linkTelegram,
        launchParams: { initDataRaw: 'telegram-init-data' },
      }),
    ).resolves.toBe('linked')
    expect(linkTelegram).toHaveBeenCalledWith({
      launchParams: { initDataRaw: 'telegram-init-data' },
    })
  })

  it('does not block flow when Privy Telegram account is already linked', async () => {
    const linkTelegram = vi.fn(async () => {
      throw new Error('User already has an account of type telegram linked.')
    })
    await expect(
      linkPrivyTelegramInMiniApp({
        linkTelegram,
        launchParams: { initDataRaw: 'telegram-init-data' },
      }),
    ).resolves.toBe('already_linked')
  })

  it('skips Privy Telegram linking when launch params are missing', async () => {
    const linkTelegram = vi.fn(async () => {})
    await expect(
      linkPrivyTelegramInMiniApp({
        linkTelegram,
        launchParams: null,
      }),
    ).resolves.toBe('skipped')
    expect(linkTelegram).not.toHaveBeenCalled()
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
        statusTitle: 'Telegram linking needs attention',
        statusMessage: 'This email is already linked in Privy. Tap Retry link to continue Telegram linking.',
        canSignIn: false,
        canRetryLink: true,
      }),
    )
  })

  it('normalizes Privy email-linked errors when they surface via emailMessage', () => {
    expect(
      getTelegramLinkViewState({
        sessionState: 'ready',
        emailState: 'error',
        linkState: 'idle',
        sessionError: null,
        emailMessage: 'User already has an account of type email linked.',
        linkMessage: null,
        privyAuthenticated: true,
        hasLinkContext: true,
      }),
    ).toEqual(
      expect.objectContaining({
        statusTitle: 'Telegram linking needs attention',
        statusMessage: 'This email is already linked in Privy. Tap Retry link to continue Telegram linking.',
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

  it('forces mini app session reset only for stale-session link failures', () => {
    expect(
      shouldResetTelegramMiniAppSessionForLinkError('Telegram Mini App session expired. Re-open the Mini App from Telegram and retry.'),
    ).toBe(true)
    expect(
      shouldResetTelegramMiniAppSessionForLinkError('Telegram Mini App session user mismatch. Start /link again from Telegram.'),
    ).toBe(true)
    expect(shouldResetTelegramMiniAppSessionForLinkError('Telegram linking timed out. Tap Retry link to try again.')).toBe(false)
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

  it('waits for Privy auth to settle before resuming Telegram linking', async () => {
    const snapshots = [
      {
        ready: false,
        authenticated: false,
        accessToken: null,
        hasVerifiedEmail: false,
        serverEmailVerified: false,
      },
      {
        ready: true,
        authenticated: false,
        accessToken: null,
        hasVerifiedEmail: false,
        serverEmailVerified: false,
      },
      {
        ready: true,
        authenticated: true,
        accessToken: 'fresh-token',
        hasVerifiedEmail: false,
        serverEmailVerified: true,
      },
    ]
    let index = 0

    await expect(
      waitForTelegramLinkPrivyAuth({
        readSnapshot: () => Promise.resolve(snapshots[Math.min(index, snapshots.length - 1)]),
        intervalMs: 1,
        timeoutMs: 10,
        sleepImpl: async () => {
          index += 1
        },
      }),
    ).resolves.toBe(true)
  })

  it('times out when Privy auth never becomes ready', async () => {
    let iterations = 0

    await expect(
      waitForTelegramLinkPrivyAuth({
        readSnapshot: () =>
          Promise.resolve({
            ready: false,
            authenticated: false,
            accessToken: null,
            hasVerifiedEmail: false,
            serverEmailVerified: false,
          }),
        intervalMs: 1,
        timeoutMs: 2,
        sleepImpl: async () => {
          iterations += 1
        },
      }),
    ).resolves.toBe(false)

    expect(iterations).toBeGreaterThan(0)
  })

  it('requires a fresh access token after forced logout flows', async () => {
    const snapshots = [
      {
        ready: true,
        authenticated: true,
        accessToken: 'old-token',
        hasVerifiedEmail: true,
        serverEmailVerified: true,
      },
      {
        ready: true,
        authenticated: true,
        accessToken: 'fresh-token',
        hasVerifiedEmail: true,
        serverEmailVerified: true,
      },
    ]
    let index = 0

    await expect(
      waitForTelegramLinkPrivyAuth({
        readSnapshot: () => Promise.resolve(snapshots[Math.min(index, snapshots.length - 1)]),
        requireFreshAccessToken: 'old-token',
        intervalMs: 1,
        timeoutMs: 10,
        sleepImpl: async () => {
          index += 1
        },
      }),
    ).resolves.toBe(true)
  })
})
