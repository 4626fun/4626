// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePrivyOAuthReturnBackendSync } from './usePrivyOAuthReturnBackendSync'
import { syncAccountsProviderLink } from './providerLink'

vi.mock('./providerLink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./providerLink')>()
  return {
    ...actual,
    syncAccountsProviderLink: vi.fn(),
  }
})

const TWITTER_PROVIDERS = ['twitter'] as const
const PRIVY_USER_WITH_TWITTER = {
  linkedAccounts: [{ type: 'twitter_oauth', subject: 'twitter-subject-1' }],
}

function pendingTwitterError(): Error & { status: number; recoveryRequired: boolean } {
  return Object.assign(new Error('No linked value found for provider "twitter".'), {
    status: 409,
    recoveryRequired: false,
  })
}

describe('usePrivyOAuthReturnBackendSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits through transient server hydration without surfacing an error or render-loop retry', async () => {
    vi.mocked(syncAccountsProviderLink)
      .mockRejectedValueOnce(pendingTwitterError())
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof syncAccountsProviderLink>>)
    const onSynced = vi.fn()
    const onError = vi.fn()

    const { rerender } = renderHook(
      (props: { linkedMethods: { twitter?: string[] } }) =>
        usePrivyOAuthReturnBackendSync({
          providers: TWITTER_PROVIDERS,
          privyReady: true,
          privyAuthenticated: true,
          privyUser: PRIVY_USER_WITH_TWITTER,
          linkedMethods: props.linkedMethods,
          getAccessToken: async () => 'token',
          onSynced,
          onError,
        }),
      { initialProps: { linkedMethods: {} } },
    )

    await act(async () => {})
    expect(syncAccountsProviderLink).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()

    rerender({ linkedMethods: {} })
    await act(async () => {})
    expect(syncAccountsProviderLink).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(syncAccountsProviderLink).toHaveBeenCalledTimes(2)
    expect(onSynced).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps recovery-required conflicts terminal and visible', async () => {
    const recoveryError = Object.assign(
      new Error('Recovery required: this identity is already linked to another account.'),
      {
        status: 409,
        recoveryRequired: true,
      },
    )
    vi.mocked(syncAccountsProviderLink).mockRejectedValueOnce(recoveryError)
    const onError = vi.fn()

    const { rerender } = renderHook(
      (props: { linkedMethods: { twitter?: string[] } }) =>
        usePrivyOAuthReturnBackendSync({
          providers: TWITTER_PROVIDERS,
          privyReady: true,
          privyAuthenticated: true,
          privyUser: PRIVY_USER_WITH_TWITTER,
          linkedMethods: props.linkedMethods,
          getAccessToken: async () => 'token',
          onError,
        }),
      { initialProps: { linkedMethods: {} } },
    )

    await act(async () => {})
    expect(onError).toHaveBeenCalledWith(recoveryError, 'twitter')

    rerender({ linkedMethods: {} })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(syncAccountsProviderLink).toHaveBeenCalledTimes(1)
  })

  it('caps repeated provider-hydration cycles without exposing a transient error', async () => {
    vi.mocked(syncAccountsProviderLink).mockRejectedValue(pendingTwitterError())
    const onError = vi.fn()

    renderHook(() =>
      usePrivyOAuthReturnBackendSync({
        providers: TWITTER_PROVIDERS,
        privyReady: true,
        privyAuthenticated: true,
        privyUser: PRIVY_USER_WITH_TWITTER,
        linkedMethods: {},
        getAccessToken: async () => 'token',
        onError,
      }),
    )

    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(syncAccountsProviderLink).toHaveBeenCalledTimes(3)
    expect(onError).not.toHaveBeenCalled()
  })
})
