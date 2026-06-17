import { describe, expect, it, vi } from 'vitest'

import {
  attemptSessionRepair,
  createStaleSessionProbe,
  decodeJwtExpiryMs,
  isInjectedWalletCollisionMessage,
  isSessionRepairableChatError,
  isTokenLive,
  type SessionRepairOutcome,
} from './sessionRepair'

// Synchronous pass-through timeout + zero-delay so tests stay fast/deterministic.
const passThroughTimeout = <T,>(promise: Promise<T>): Promise<T> => promise
const noDelay = (): Promise<void> => Promise.resolve()

function buildJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`
}

describe('decodeJwtExpiryMs', () => {
  it('decodes a numeric exp claim into epoch-ms', () => {
    const token = buildJwt({ exp: 1_700_000_000 })
    expect(decodeJwtExpiryMs(token)).toBe(1_700_000_000_000)
  })

  it('returns null when exp is missing', () => {
    expect(decodeJwtExpiryMs(buildJwt({ sub: 'abc' }))).toBeNull()
  })

  it('returns null for null/malformed tokens', () => {
    expect(decodeJwtExpiryMs(null)).toBeNull()
    expect(decodeJwtExpiryMs('not-a-jwt')).toBeNull()
    expect(decodeJwtExpiryMs('a.%%%.c')).toBeNull()
  })
})

describe('isTokenLive', () => {
  const now = 1_700_000_000_000
  it('treats a token without exp as live', () => {
    expect(isTokenLive(buildJwt({ sub: 'x' }), { now })).toBe(true)
  })
  it('treats a future-exp token (beyond skew) as live', () => {
    expect(isTokenLive(buildJwt({ exp: now / 1000 + 600 }), { now })).toBe(true)
  })
  it('treats an expired token as not live', () => {
    expect(isTokenLive(buildJwt({ exp: now / 1000 - 10 }), { now })).toBe(false)
  })
  it('treats null as not live', () => {
    expect(isTokenLive(null, { now })).toBe(false)
  })
})

describe('isInjectedWalletCollisionMessage', () => {
  it('matches known wallet-extension collision strings', () => {
    expect(
      isInjectedWalletCollisionMessage('Cannot set property ethereum of #<Window> which has only a getter'),
    ).toBe(true)
    expect(isInjectedWalletCollisionMessage('Cannot redefine property: ethereum')).toBe(true)
    expect(isInjectedWalletCollisionMessage('injected is not defined')).toBe(true)
    expect(isInjectedWalletCollisionMessage('multiple injected providers detected')).toBe(true)
  })
  it('does not match unrelated errors', () => {
    expect(isInjectedWalletCollisionMessage('missing auth token')).toBe(false)
    expect(isInjectedWalletCollisionMessage('')).toBe(false)
  })
})

describe('isSessionRepairableChatError', () => {
  it('treats embedded-signer auth expiry as repairable', () => {
    expect(isSessionRepairableChatError('UnknownRpcError: missing auth token')).toBe(true)
  })
  it('excludes wallet collision noise', () => {
    expect(isSessionRepairableChatError('Cannot redefine property: ethereum')).toBe(false)
  })
  it('excludes broken local XMTP install state', () => {
    expect(isSessionRepairableChatError('InboxValidationFailed: bad install')).toBe(false)
  })
  it('returns false for unrelated errors', () => {
    expect(isSessionRepairableChatError('network down')).toBe(false)
    expect(isSessionRepairableChatError('')).toBe(false)
  })
})

describe('createStaleSessionProbe', () => {
  it('returns token and resets misses when a token is present', async () => {
    const probe = createStaleSessionProbe({
      getToken: vi.fn().mockResolvedValue('tok'),
      hasLiveCookie: () => false,
      withTimeout: passThroughTimeout,
      delay: noDelay,
    })
    expect(await probe.probe()).toBe('token')
    expect(probe.missCount).toBe(0)
  })

  it('reports transient (not true-stale) on the first miss with no cookie', async () => {
    const probe = createStaleSessionProbe({
      getToken: vi.fn().mockResolvedValue(null),
      hasLiveCookie: () => false,
      withTimeout: passThroughTimeout,
      delay: noDelay,
    })
    expect(await probe.probe()).toBe('transient')
    expect(probe.missCount).toBe(1)
  })

  it('reports true-stale only after >= threshold misses with no cookie', async () => {
    const probe = createStaleSessionProbe({
      getToken: vi.fn().mockResolvedValue(null),
      hasLiveCookie: () => false,
      withTimeout: passThroughTimeout,
      delay: noDelay,
    })
    expect(await probe.probe()).toBe('transient')
    expect(await probe.probe()).toBe('true-stale')
  })

  it('never reports true-stale while a live cookie session exists', async () => {
    const probe = createStaleSessionProbe({
      getToken: vi.fn().mockResolvedValue(null),
      hasLiveCookie: () => true,
      withTimeout: passThroughTimeout,
      delay: noDelay,
    })
    expect(await probe.probe()).toBe('transient')
    expect(await probe.probe()).toBe('transient')
  })

  it('uses the second probe read before counting a miss', async () => {
    const getToken = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('late-token')
    const probe = createStaleSessionProbe({
      getToken,
      hasLiveCookie: () => false,
      withTimeout: passThroughTimeout,
      delay: noDelay,
    })
    expect(await probe.probe()).toBe('token')
    expect(getToken).toHaveBeenCalledTimes(2)
    expect(probe.missCount).toBe(0)
  })
})

describe('attemptSessionRepair', () => {
  const baseDeps = {
    hasLiveCookie: () => false,
    isRecoveryRequiredError: () => false,
    withTimeout: passThroughTimeout,
    delay: noDelay,
  }

  it('happy path: token + successful bridge => repaired', async () => {
    const bridge = vi.fn().mockResolvedValue(true)
    const outcome = await attemptSessionRepair({
      ...baseDeps,
      getToken: vi.fn().mockResolvedValue('tok'),
      bridge,
    })
    expect(outcome).toBe<SessionRepairOutcome>('repaired')
    expect(bridge).toHaveBeenCalledWith('tok')
  })

  it('transient miss immediately after OTP does not bridge or log out', async () => {
    const bridge = vi.fn()
    const outcome = await attemptSessionRepair({
      ...baseDeps,
      getToken: vi.fn().mockResolvedValue(null),
      bridge,
    })
    expect(outcome).toBe<SessionRepairOutcome>('transient')
    expect(bridge).not.toHaveBeenCalled()
  })

  it('repeated stale token with no cookie => true-stale (threshold reached)', async () => {
    const bridge = vi.fn()
    // threshold:1 emulates "second probe miss" so a single attempt reports true-stale.
    const outcome = await attemptSessionRepair({
      ...baseDeps,
      getToken: vi.fn().mockResolvedValue(null),
      bridge,
      threshold: 1,
    })
    expect(outcome).toBe<SessionRepairOutcome>('true-stale')
    expect(bridge).not.toHaveBeenCalled()
  })

  it('keeps a live-cookie session as transient even when token is missing', async () => {
    const outcome = await attemptSessionRepair({
      ...baseDeps,
      hasLiveCookie: () => true,
      getToken: vi.fn().mockResolvedValue(null),
      bridge: vi.fn(),
      threshold: 1,
    })
    expect(outcome).toBe<SessionRepairOutcome>('transient')
  })

  it('bridge throwing a recovery error => recovery-required', async () => {
    const recoveryError = Object.assign(new Error('Recovery required'), { recoveryRequired: true })
    const outcome = await attemptSessionRepair({
      ...baseDeps,
      getToken: vi.fn().mockResolvedValue('tok'),
      bridge: vi.fn().mockRejectedValue(recoveryError),
      isRecoveryRequiredError: (e) => Boolean((e as { recoveryRequired?: boolean })?.recoveryRequired),
    })
    expect(outcome).toBe<SessionRepairOutcome>('recovery-required')
  })

  it('bridge returning false with no cookie => true-stale', async () => {
    const outcome = await attemptSessionRepair({
      ...baseDeps,
      getToken: vi.fn().mockResolvedValue('tok'),
      bridge: vi.fn().mockResolvedValue(false),
    })
    expect(outcome).toBe<SessionRepairOutcome>('true-stale')
  })

  it('emits structured transitions', async () => {
    const onTransition = vi.fn()
    await attemptSessionRepair({
      ...baseDeps,
      getToken: vi.fn().mockResolvedValue('tok'),
      bridge: vi.fn().mockResolvedValue(true),
      onTransition,
    })
    const transitions = onTransition.mock.calls.map((c) => c[0].transition)
    expect(transitions).toContain('bridging')
    expect(transitions).toContain('repaired')
  })
})
