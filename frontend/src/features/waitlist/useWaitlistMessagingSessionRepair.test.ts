// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWaitlistMessagingSessionRepair } from './useWaitlistMessagingSessionRepair'

const EMBEDDED_ADDRESS = '0x1234567890123456789012345678901234567890'

const mockAttemptSessionRepair = vi.fn()
const mockRefreshPrivyEmbeddedSignerSession = vi.fn()
const mockBridgePrivySession = vi.fn()
const mockReadAuthSessionAddress = vi.fn()
const mockIsWaitlistMessagingLoopbackHost = vi.fn()

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    user: { linkedAccounts: [] },
    getAccessToken: vi.fn(async () => 'token'),
  }),
  useWallets: () => ({ wallets: [] }),
  useActiveWallet: () => ({ setActiveWallet: vi.fn() }),
}))

vi.mock('@/lib/auth/sessionRepair', () => ({
  attemptSessionRepair: (...args: unknown[]) => mockAttemptSessionRepair(...args),
}))

vi.mock('@/lib/privy/embeddedWallet', () => ({
  extractPrivyWalletsFromUser: () => [],
  useEnsurePrivyEmbeddedWallet: () => ({
    ensureEmbeddedWallet: vi.fn(async () => ({ address: EMBEDDED_ADDRESS })),
  }),
}))

vi.mock('@/lib/privy/refreshEmbeddedSignerSession', () => ({
  refreshPrivyEmbeddedSignerSession: (...args: unknown[]) => mockRefreshPrivyEmbeddedSignerSession(...args),
}))

vi.mock('./waitlistHandoff', () => ({
  bridgePrivySession: (...args: unknown[]) => mockBridgePrivySession(...args),
}))

vi.mock('./waitlistPrivySession', () => ({
  readAuthSessionAddress: (...args: unknown[]) => mockReadAuthSessionAddress(...args),
}))

vi.mock('./prepareWaitlistMessagingWallet', () => ({
  findLiveEmbeddedPrivyWallet: () => ({ address: EMBEDDED_ADDRESS, walletClientType: 'privy' }),
  isWaitlistMessagingLoopbackHost: () => mockIsWaitlistMessagingLoopbackHost(),
}))

describe('useWaitlistMessagingSessionRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadAuthSessionAddress.mockResolvedValue(null)
    mockAttemptSessionRepair.mockResolvedValue('repaired')
    mockRefreshPrivyEmbeddedSignerSession.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('downgrades a bridge-repaired outcome to recovery-required on a loopback host', async () => {
    mockIsWaitlistMessagingLoopbackHost.mockReturnValue(true)
    const { result } = renderHook(() => useWaitlistMessagingSessionRepair())

    const outcome = await result.current()

    expect(mockRefreshPrivyEmbeddedSignerSession).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('recovery-required')
  })

  it('reports a genuine repaired outcome on a non-loopback (deployed) host', async () => {
    mockIsWaitlistMessagingLoopbackHost.mockReturnValue(false)
    const { result } = renderHook(() => useWaitlistMessagingSessionRepair())

    const outcome = await result.current()

    expect(outcome).toBe('repaired')
  })

  it('passes through non-repaired outcomes (e.g. true-stale) without touching the embedded signer', async () => {
    mockAttemptSessionRepair.mockResolvedValue('true-stale')
    const { result } = renderHook(() => useWaitlistMessagingSessionRepair())

    const outcome = await result.current()

    expect(mockRefreshPrivyEmbeddedSignerSession).not.toHaveBeenCalled()
    expect(outcome).toBe('true-stale')
  })

  it('downgrades to transient when the embedded signer refresh itself throws', async () => {
    mockIsWaitlistMessagingLoopbackHost.mockReturnValue(true)
    mockRefreshPrivyEmbeddedSignerSession.mockRejectedValue(new Error('embedded signer not ready'))
    const { result } = renderHook(() => useWaitlistMessagingSessionRepair())

    const outcome = await result.current()

    await waitFor(() => expect(outcome).toBe('transient'))
  })
})
