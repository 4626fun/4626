// @vitest-environment happy-dom
/**
 * Tests for useArchBDelegation hook.
 *
 * Covers:
 *   - initial status fetch
 *   - enable() happy path: delegateWallet resolves → enroll 200 → status becomes 'provisioned'
 *   - enable() delegation declined: delegateWallet throws → status becomes 'not_delegated' with error
 *   - enable() enroll fails: delegation ok but 400 → status 'error'
 *   - disable() happy path: revoke 200 → revokeWallets → status 'revoked'
 *   - db_unavailable from backend → status 'error' with typed error
 *   - unauthenticated → status 'unlinked' without network call
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useArchBDelegation } from './useArchBDelegation'

// ── Privy mocks ───────────────────────────────────────────────────────────────

const mockDelegateWallet = vi.fn<(params: { address: string; chainType: string }) => Promise<void>>()
const mockRevokeWallets = vi.fn<() => Promise<void>>()

const privyState = {
  ready: true,
  authenticated: true,
  wallets: [
    { walletClientType: 'privy', address: '0xownerEOA' },
  ] as unknown[],
}

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: privyState.ready,
    authenticated: privyState.authenticated,
  }),
  useWallets: () => ({
    wallets: privyState.wallets,
  }),
  useDelegatedActions: () => ({
    delegateWallet: mockDelegateWallet,
    revokeWallets: mockRevokeWallets,
  }),
}))

// ── apiFetch mock ─────────────────────────────────────────────────────────────

const mockApiFetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>()

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (path: string, init?: RequestInit) => mockApiFetch(path, init),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function statusResponse(
  executionReady: string,
  delegated: boolean | null,
  caps: { perTxCapWei: string; dailyCapWei: string } | null = null,
): Response {
  return jsonResponse({
    success: true,
    data: { executionReady, delegated, caps },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useArchBDelegation', () => {
  beforeEach(() => {
    privyState.ready = true
    privyState.authenticated = true
    privyState.wallets = [{ walletClientType: 'privy', address: '0xownerEOA' }]
    mockDelegateWallet.mockReset()
    mockRevokeWallets.mockReset()
    mockApiFetch.mockReset()
  })

  it('fetches status on mount and exposes not_delegated when backend says not_provisioned + not delegated', async () => {
    mockApiFetch.mockResolvedValue(statusResponse('not_provisioned', false))

    const { result } = renderHook(() => useArchBDelegation())

    // Should start loading
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('not_delegated'))
    expect(mockApiFetch).toHaveBeenCalledWith('/api/arch-b/status', { method: 'GET' })
  })

  it('enable() happy path: delegateWallet resolves → enroll 200 → provisioned', async () => {
    mockApiFetch
      .mockResolvedValueOnce(statusResponse('not_provisioned', false)) // initial fetch
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { profileId: 'p1' } })) // enroll
      .mockResolvedValueOnce(
        statusResponse('ready', true, {
          perTxCapWei: '10000000000000000',
          dailyCapWei: '50000000000000000',
        }),
      ) // post-enroll refetch

    mockDelegateWallet.mockResolvedValue(undefined)

    const { result } = renderHook(() => useArchBDelegation())

    await waitFor(() => expect(result.current.status).toBe('not_delegated'))

    await act(async () => {
      await result.current.enable()
    })

    await waitFor(() => expect(result.current.status).toBe('provisioned'))
    expect(mockDelegateWallet).toHaveBeenCalledWith({
      address: '0xownerEOA',
      chainType: 'ethereum',
    })
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/arch-b/enroll',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.current.error).toBeNull()
    expect(result.current.caps).toEqual({
      perTxCapWei: '10000000000000000',
      dailyCapWei: '50000000000000000',
    })
  })

  it('enable() delegation declined: delegateWallet throws → error status with code', async () => {
    mockApiFetch.mockResolvedValueOnce(statusResponse('not_provisioned', false))
    mockDelegateWallet.mockRejectedValue(new Error('User declined'))

    const { result } = renderHook(() => useArchBDelegation())

    await waitFor(() => expect(result.current.status).toBe('not_delegated'))

    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('delegation_declined')
    expect(result.current.error?.message).toContain('User declined')
  })

  it('enable() enroll 400 → status error with typed error code', async () => {
    mockApiFetch
      .mockResolvedValueOnce(statusResponse('not_provisioned', false)) // initial
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: 'delegation_not_found' }, 400),
      ) // enroll returns 400

    mockDelegateWallet.mockResolvedValue(undefined)

    const { result } = renderHook(() => useArchBDelegation())

    await waitFor(() => expect(result.current.status).toBe('not_delegated'))

    await act(async () => {
      await result.current.enable()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.code).toBe('delegation_not_found')
  })

  it('disable() happy path: revoke 200 → revokeWallets → status revoked', async () => {
    mockApiFetch
      .mockResolvedValueOnce(
        statusResponse('ready', true, {
          perTxCapWei: '10000000000000000',
          dailyCapWei: '50000000000000000',
        }),
      ) // initial
      .mockResolvedValueOnce(jsonResponse({ success: true })) // revoke POST
      .mockResolvedValueOnce(statusResponse('revoked', false)) // post-revoke refetch

    mockRevokeWallets.mockResolvedValue(undefined)

    const { result } = renderHook(() => useArchBDelegation())

    await waitFor(() => expect(result.current.status).toBe('provisioned'))

    await act(async () => {
      await result.current.disable()
    })

    await waitFor(() => expect(result.current.status).toBe('revoked'))
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/arch-b/revoke',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mockRevokeWallets).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('db_unavailable (503) from backend → error status with typed error', async () => {
    mockApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'db_unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { result } = renderHook(() => useArchBDelegation())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.code).toBe('db_unavailable')
    expect(result.current.error?.message).toContain('temporarily unavailable')
  })

  it('returns unlinked status when not authenticated — no network call made', async () => {
    privyState.authenticated = false

    const { result } = renderHook(() => useArchBDelegation())

    await waitFor(() => expect(result.current.status).toBe('unlinked'))
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('disable() returns { ok: false, error } when revoke backend fails (no silent success)', async () => {
    mockApiFetch
      .mockResolvedValueOnce(
        statusResponse('ready', true, {
          perTxCapWei: '10000000000000000',
          dailyCapWei: '50000000000000000',
        }),
      ) // initial
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: 'db_unavailable' }, 503),
      ) // revoke POST fails

    const { result } = renderHook(() => useArchBDelegation())
    await waitFor(() => expect(result.current.status).toBe('provisioned'))

    let outcome: Awaited<ReturnType<typeof result.current.disable>> | undefined
    await act(async () => {
      outcome = await result.current.disable()
    })

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'db_unavailable' }),
    })
    expect(result.current.status).toBe('error')
    // Privy revoke must NOT be called if backend revoke failed (hard-fail guard)
    expect(mockRevokeWallets).not.toHaveBeenCalled()
  })

  it('disable() returns { ok: true } on success', async () => {
    mockApiFetch
      .mockResolvedValueOnce(
        statusResponse('ready', true, {
          perTxCapWei: '10000000000000000',
          dailyCapWei: '50000000000000000',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(statusResponse('revoked', false))

    mockRevokeWallets.mockResolvedValue(undefined)

    const { result } = renderHook(() => useArchBDelegation())
    await waitFor(() => expect(result.current.status).toBe('provisioned'))

    let outcome: Awaited<ReturnType<typeof result.current.disable>> | undefined
    await act(async () => {
      outcome = await result.current.disable()
    })

    expect(outcome).toEqual({ ok: true })
  })

  it('enable() returns { ok: false, error } when delegation declined', async () => {
    mockApiFetch.mockResolvedValueOnce(statusResponse('not_provisioned', false))
    mockDelegateWallet.mockRejectedValue(new Error('User declined'))

    const { result } = renderHook(() => useArchBDelegation())
    await waitFor(() => expect(result.current.status).toBe('not_delegated'))

    let outcome: Awaited<ReturnType<typeof result.current.enable>> | undefined
    await act(async () => {
      outcome = await result.current.enable()
    })

    expect(outcome).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'delegation_declined' }),
    })
  })

  it('enable() returns { ok: true } on happy path', async () => {
    mockApiFetch
      .mockResolvedValueOnce(statusResponse('not_provisioned', false))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { profileId: 'p1' } }))
      .mockResolvedValueOnce(
        statusResponse('ready', true, {
          perTxCapWei: '10000000000000000',
          dailyCapWei: '50000000000000000',
        }),
      )
    mockDelegateWallet.mockResolvedValue(undefined)

    const { result } = renderHook(() => useArchBDelegation())
    await waitFor(() => expect(result.current.status).toBe('not_delegated'))

    let outcome: Awaited<ReturnType<typeof result.current.enable>> | undefined
    await act(async () => {
      outcome = await result.current.enable()
    })

    expect(outcome).toEqual({ ok: true })
  })
})
