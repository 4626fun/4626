// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '@/lib/api/apiBase'

import { useWaitlistChatJoin, waitlistChatStatusMessage } from './useWaitlistChatJoin'

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: vi.fn(),
}))

const mockedApiFetch = vi.mocked(apiFetch)
const IDENTITY = '0x1234567890123456789012345678901234567890'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useWaitlistChatJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps joining copy without Zora/XMTP jargon', () => {
    expect(waitlistChatStatusMessage('joining')).toBe('Adding your wallet to waitlist chat...')
  })

  it('resolves to queued after a successful join', async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { queued: true } }), { status: 200 }),
    )

    const { result } = renderHook(() =>
      useWaitlistChatJoin({ canonicalCswAddress: IDENTITY, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current).toBe('queued')
    })
  })

  it('does not stay on joining after StrictMode remount cancels the first request', async () => {
    const pending = deferred<Response>()
    mockedApiFetch.mockReturnValue(pending.promise)

    const { result } = renderHook(
      () => useWaitlistChatJoin({ canonicalCswAddress: IDENTITY, enabled: true }),
      { wrapper: StrictMode },
    )

    await waitFor(() => {
      expect(result.current).toBe('joining')
    })

    pending.resolve(
      new Response(JSON.stringify({ success: true, data: { queued: true } }), { status: 200 }),
    )

    await waitFor(() => {
      expect(result.current).toBe('queued')
    })
    expect(mockedApiFetch).toHaveBeenCalledTimes(2)
  })

  it('maps embedded owner missing to blocked', async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'embedded_owner_not_installed' }), {
        status: 403,
      }),
    )

    const { result } = renderHook(() =>
      useWaitlistChatJoin({ canonicalCswAddress: IDENTITY, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current).toBe('blocked')
    })
  })

  it('maps request timeout to error', async () => {
    vi.useFakeTimers()
    mockedApiFetch.mockImplementation(
      (_path, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const { result } = renderHook(() =>
      useWaitlistChatJoin({ canonicalCswAddress: IDENTITY, enabled: true }),
    )

    expect(result.current).toBe('joining')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(result.current).toBe('error')
  })
})
