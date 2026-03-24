import { describe, expect, it } from 'vitest'

import {
  createFlowError,
  createInitialTelegramLinkState,
  telegramLinkReducer,
  type CanonicalAccountReady,
  type TelegramLinkResult,
  type TelegramSessionProof,
} from './telegramLinkFlow'

function makeProof(): TelegramSessionProof {
  return {
    sessionToken: 'mini-session-token',
    initDataRaw: 'auth_date=1710000000&hash=abc',
    telegramUserId: '42',
    telegramUsername: 'akita',
    chatId: '-100123',
    chatType: 'group',
    chatInstance: 'instance-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    verifiedAt: 1_710_000_000_000,
    linkContext: {
      linkToken: 'link-token-123',
      chatId: '-100123',
      telegramUsername: 'akita',
    },
  }
}

function makeAccount(): CanonicalAccountReady {
  return {
    privyUserId: 'did:privy:user-1',
    email: 'user@example.com',
    emailVerified: true,
    appAccessStatus: 'approved',
    linkedMethods: { email: ['user@example.com'] },
    accountSignals: {
      linked: true,
      canonicalCswAddress: null,
      creatorCoin: null,
      zoraHandle: null,
      lastResolvedAt: '2026-03-23T00:00:00.000Z',
    },
    score: {
      points: 15,
      tier: 1,
    },
  }
}

function makeLink(): TelegramLinkResult {
  return {
    telegramUserId: '42',
    telegramUsername: 'akita',
    privyUserId: 'did:privy:user-1',
    profileId: 11,
    linkStatus: 'pending_wallet_setup',
    canonicalCswAddress: null,
    ownerVerified: false,
  }
}

describe('telegramLinkReducer', () => {
  it('moves from OTP verification into explicit wait_for_privy_sync before bind', () => {
    const proof = makeProof()
    const verifying = {
      tag: 'verifying_email_code' as const,
      proof,
      email: 'user@example.com',
      code: '123456',
    }

    const waited = telegramLinkReducer(verifying, { type: 'EMAIL_CODE_VERIFIED' })
    expect(waited.tag).toBe('wait_for_privy_sync')

    const ready = telegramLinkReducer(waited, {
      type: 'PRIVY_SYNC_READY',
      account: makeAccount(),
    })
    expect(ready.tag).toBe('bind_telegram')
  })

  it('keeps recoverable OTP send failures inline on collect_email', () => {
    const proof = makeProof()
    const sending = {
      tag: 'sending_email_code' as const,
      proof,
      email: 'user@example.com',
    }

    const next = telegramLinkReducer(sending, {
      type: 'EMAIL_CODE_SEND_FAILED',
      error: createFlowError({
        code: 'OTP_SEND_FAILED',
        message: 'Unable to send verification code.',
        recoverable: true,
      }),
    })

    expect(next).toEqual({
      tag: 'collect_email',
      proof,
      email: 'user@example.com',
      emailError: 'Unable to send verification code.',
    })
  })

  it('keeps recoverable OTP verify failures inline on enter_email_code', () => {
    const proof = makeProof()
    const verifying = {
      tag: 'verifying_email_code' as const,
      proof,
      email: 'user@example.com',
      code: '123456',
    }

    const next = telegramLinkReducer(verifying, {
      type: 'EMAIL_CODE_VERIFY_FAILED',
      error: createFlowError({
        code: 'OTP_VERIFY_FAILED',
        message: 'Incorrect code.',
        recoverable: true,
      }),
    })

    expect(next).toEqual({
      tag: 'enter_email_code',
      proof,
      email: 'user@example.com',
      code: '123456',
      codeError: 'Incorrect code.',
      resendAvailableAt: null,
    })
  })

  it('sends stale launch param failures to expired_or_error without auto regression', () => {
    const proof = makeProof()
    const bindState = {
      tag: 'bind_telegram' as const,
      proof,
      account: makeAccount(),
      step: 'ensure_privy_link' as const,
    }

    const next = telegramLinkReducer(bindState, {
      type: 'PRIVY_TELEGRAM_LINK_FAILED',
      error: createFlowError({
        code: 'STALE_TELEGRAM_LAUNCH_PARAMS',
        message: 'Telegram launch parameters expired.',
        recoverable: false,
      }),
    })

    expect(next.tag).toBe('expired_or_error')
    if (next.tag === 'expired_or_error') {
      expect(next.error.code).toBe('STALE_TELEGRAM_LAUNCH_PARAMS')
      expect(next.retryTarget?.tag).toBe('verify_telegram_session')
    }
  })

  it('keeps success stable on unrelated events', () => {
    const success = {
      tag: 'success' as const,
      proof: makeProof(),
      account: makeAccount(),
      link: makeLink(),
    }

    const unchanged = telegramLinkReducer(success, { type: 'RETRY' })
    expect(unchanged).toBe(success)
  })

  it('retries wait_for_privy_sync from expired_or_error when marked recoverable', () => {
    const proof = makeProof()
    const waitState = {
      tag: 'wait_for_privy_sync' as const,
      proof,
      email: 'user@example.com',
      code: '123456',
      startedAt: Date.now(),
    }
    const failed = telegramLinkReducer(waitState, {
      type: 'PRIVY_SYNC_FAILED',
      error: createFlowError({
        code: 'PRIVY_SYNC_FAILED',
        message: 'Timed out.',
        recoverable: true,
      }),
    })

    expect(failed.tag).toBe('expired_or_error')
    if (failed.tag !== 'expired_or_error') return

    const retried = telegramLinkReducer(failed, { type: 'RETRY' })
    expect(retried.tag).toBe('wait_for_privy_sync')
  })

  it('boots from verify_telegram_session with persisted link context', () => {
    const state = createInitialTelegramLinkState({
      linkToken: 'link-token-123',
      chatId: '-100123',
      telegramUsername: 'akita',
    })

    const next = telegramLinkReducer(state, {
      type: 'TELEGRAM_VERIFIED',
      proof: makeProof(),
    })

    expect(next.tag).toBe('collect_email')
    if (next.tag === 'collect_email') {
      expect(next.proof.linkContext?.linkToken).toBe('link-token-123')
    }
  })
})
