import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPrivyWalletWithAuthRetries,
  isRetryablePrivyWalletAuthError,
  shouldPreferHydrateBeforeClientCreateWallet,
  waitForHydratedEmbeddedWalletAddress,
  waitForPrivyEmbeddedWalletAuthReady,
} from '@/lib/privy/waitForPrivyEmbeddedWalletAuthReady'
import { isLivePrivyAccessToken } from '@/lib/privy/usePrivyAccessTokenReady'

vi.mock('@/lib/privy/loopbackSessionMarkerShim', () => ({
  isLocalDevPrivySessionMarkerMode: vi.fn(() => false),
  assertPrivySessionMarkerCookie: vi.fn(),
}))

vi.mock('@/lib/privy/localhostPrivyAuthNotice', () => ({
  appendLocalhostPrivyAuthNoteIfNeeded: (message: string) => message,
}))

describe('waitForPrivyEmbeddedWalletAuthReady', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('resolves when token is live and authenticated settles', async () => {
    let authenticated = false
    const promise = waitForPrivyEmbeddedWalletAuthReady({
      getToken: async () => 'header.payload.signature',
      isAuthenticated: () => authenticated,
      authenticatedSettleAttempts: 5,
      authenticatedSettleDelayMs: 50,
      tokenAttempts: 1,
    })

    await vi.advanceTimersByTimeAsync(100)
    authenticated = true
    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toEqual({ token: 'header.payload.signature' })
  })

  it('throws when access token never becomes available', async () => {
    const promise = waitForPrivyEmbeddedWalletAuthReady({
      getToken: async () => null,
      tokenAttempts: 2,
      tokenRetryDelayMs: 10,
    })
    const expectation = expect(promise).rejects.toThrow(/Missing Privy auth token/)
    await vi.advanceTimersByTimeAsync(50)
    await expectation
  })
})

describe('createPrivyWalletWithAuthRetries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries Missing auth token failures then succeeds', async () => {
    const createWallet = vi
      .fn()
      .mockRejectedValueOnce(new Error('Missing auth token'))
      .mockResolvedValueOnce({ address: '0x1111111111111111111111111111111111111111' })

    const promise = createPrivyWalletWithAuthRetries({
      createWallet,
      attempts: 3,
      retryDelayMs: 20,
    })
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise

    expect(createWallet).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ address: '0x1111111111111111111111111111111111111111' })
  })

  it('returns hydrated address without calling createWallet when already linked', async () => {
    const createWallet = vi.fn()
    const result = await createPrivyWalletWithAuthRetries({
      createWallet,
      readExistingAddress: () => '0x2222222222222222222222222222222222222222',
      attempts: 3,
    })
    expect(createWallet).not.toHaveBeenCalled()
    expect(result).toEqual({
      address: '0x2222222222222222222222222222222222222222',
      hydrated: true,
    })
  })

  it('identifies retryable wallet auth errors', () => {
    expect(isRetryablePrivyWalletAuthError(new Error('Missing auth token'))).toBe(true)
    expect(isRetryablePrivyWalletAuthError(new Error('wallets/authenticate 401'))).toBe(true)
    expect(isRetryablePrivyWalletAuthError(new Error('network timeout'))).toBe(false)
  })
})

describe('waitForHydratedEmbeddedWalletAddress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls until an address appears', async () => {
    let address: string | null = null
    const promise = waitForHydratedEmbeddedWalletAddress({
      readAddress: () => address,
      attempts: 5,
      retryDelayMs: 20,
    })
    await vi.advanceTimersByTimeAsync(40)
    address = '0x3333333333333333333333333333333333333333'
    await vi.advanceTimersByTimeAsync(40)
    await expect(promise).resolves.toBe('0x3333333333333333333333333333333333333333')
  })
})

describe('isLivePrivyAccessToken', () => {
  it('treats non-empty opaque tokens without exp claim as live', () => {
    expect(isLivePrivyAccessToken('header.payload.signature')).toBe(true)
    expect(isLivePrivyAccessToken('')).toBe(false)
    expect(isLivePrivyAccessToken(null)).toBe(false)
  })
})

describe('shouldPreferHydrateBeforeClientCreateWallet', () => {
  it('defers to local-dev marker mode', async () => {
    const { isLocalDevPrivySessionMarkerMode } = await import('@/lib/privy/loopbackSessionMarkerShim')
    vi.mocked(isLocalDevPrivySessionMarkerMode).mockReturnValue(true)
    expect(shouldPreferHydrateBeforeClientCreateWallet()).toBe(true)
    vi.mocked(isLocalDevPrivySessionMarkerMode).mockReturnValue(false)
    expect(shouldPreferHydrateBeforeClientCreateWallet()).toBe(false)
  })
})
