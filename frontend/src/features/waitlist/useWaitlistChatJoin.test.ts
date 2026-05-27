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

  it('waits for messaging before joining', () => {
    const { result } = renderHook(() =>
      useWaitlistChatJoin({
        xmtpMemberAddress: IDENTITY,
        chatReady: true,
        enabled: true,
        messagingReady: false,
      }),
    )

    expect(result.current.status).toBe('awaiting_messaging')
    expect(mockedApiFetch).not.toHaveBeenCalled()
  })

  it('maps joining copy without Zora/XMTP jargon', () => {
    expect(waitlistChatStatusMessage('joining')).toBe('Adding your wallet to waitlist chat…')
    expect(waitlistChatStatusMessage('executed')).toContain('Pulling the group')
  })

  it('resolves to executed after an immediate server add', async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { execution: 'executed' },
        }),
        { status: 200 },
      ),
    )

    const { result } = renderHook(() =>
      useWaitlistChatJoin({
        xmtpMemberAddress: IDENTITY,
        chatReady: true,
        enabled: true,
        messagingReady: true,
      }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('executed')
    })
  })

  it('does not stay on joining after StrictMode remount cancels the first request', async () => {
    const pending = deferred<Response>()
    mockedApiFetch.mockReturnValue(pending.promise)

    const { result } = renderHook(
      () =>
        useWaitlistChatJoin({
          xmtpMemberAddress: IDENTITY,
          chatReady: true,
          enabled: true,
          messagingReady: true,
        }),
      { wrapper: StrictMode },
    )

    await waitFor(() => {
      expect(result.current.status).toBe('joining')
    })

    pending.resolve(
      new Response(
        JSON.stringify({
          success: true,
          data: { execution: 'deferred' },
        }),
        { status: 200 },
      ),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('pending')
    })
    const joinCalls = mockedApiFetch.mock.calls.filter(([path]) => path === '/api/waitlist/xmtp-join')
    expect(joinCalls).toHaveLength(1)
  })

  it('maps embedded owner missing to blocked', async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'embedded_owner_not_installed' }), {
        status: 403,
      }),
    )

    const { result } = renderHook(() =>
      useWaitlistChatJoin({
        xmtpMemberAddress: IDENTITY,
        chatReady: true,
        enabled: true,
        messagingReady: true,
      }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('blocked')
    })
  })

  it('maps sub-account missing to blocked', async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'sub_account_not_registered' }), {
        status: 403,
      }),
    )

    const { result } = renderHook(() =>
      useWaitlistChatJoin({
        xmtpMemberAddress: IDENTITY,
        chatReady: true,
        enabled: true,
        messagingReady: true,
      }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('blocked')
    })
  })

  it('hydrates executed from server join action before messaging connects', async () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useWaitlistChatJoin>[0]) => useWaitlistChatJoin(props),
      {
        initialProps: {
          xmtpMemberAddress: IDENTITY,
          chatReady: true,
          enabled: true,
          messagingReady: false,
          serverJoinActionStatus: 'executed' as const,
        },
      },
    )

    expect(result.current.status).toBe('executed')

    rerender({
      xmtpMemberAddress: IDENTITY,
      chatReady: true,
      enabled: true,
      messagingReady: true,
      serverJoinActionStatus: 'executed' as const,
    })

    await waitFor(() => {
      expect(result.current.status).toBe('executed')
    })
    expect(mockedApiFetch).not.toHaveBeenCalled()
  })

  it('clears stale awaiting_messaging once messaging is ready for a completed identity', async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { execution: 'executed' },
        }),
        { status: 200 },
      ),
    )

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useWaitlistChatJoin>[0]) => useWaitlistChatJoin(props),
      {
        initialProps: {
          xmtpMemberAddress: IDENTITY,
          chatReady: true,
          enabled: true,
          messagingReady: false,
          serverJoinActionStatus: null,
        },
      },
    )

    expect(result.current.status).toBe('awaiting_messaging')

    rerender({
      xmtpMemberAddress: IDENTITY,
      chatReady: true,
      enabled: true,
      messagingReady: true,
      serverJoinActionStatus: null,
    })

    await waitFor(() => {
      expect(result.current.status).toBe('executed')
    })
  })

  it('does not re-post join when the server action is already pending', async () => {
    const { result } = renderHook(() =>
      useWaitlistChatJoin({
        xmtpMemberAddress: IDENTITY,
        chatReady: true,
        enabled: true,
        messagingReady: true,
        serverJoinActionStatus: 'pending',
      }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('pending')
    })
    const joinCalls = mockedApiFetch.mock.calls.filter(([path]) => path === '/api/waitlist/xmtp-join')
    expect(joinCalls).toHaveLength(0)
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
      useWaitlistChatJoin({
        xmtpMemberAddress: IDENTITY,
        chatReady: true,
        enabled: true,
        messagingReady: true,
      }),
    )

    expect(result.current.status).toBe('joining')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(result.current.status).toBe('error')
  })
})
