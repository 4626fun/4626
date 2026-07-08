// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { flushSync } from 'react-dom'
import { describe, expect, it, vi } from 'vitest'

import type { XmtpStatus } from '@/lib/xmtp/provider'
import {
  normalizeRepairOutcome,
  resolveConnectAfterRepair,
  resolveConnectFailureDisplay,
  useWaitlistMessagingConnect,
} from './useWaitlistMessagingConnect'

describe('useWaitlistMessagingConnect repair helpers', () => {
  it('maps legacy boolean repair results', () => {
    expect(normalizeRepairOutcome(true)).toBe('repaired')
    expect(normalizeRepairOutcome(false)).toBe('transient')
    expect(normalizeRepairOutcome('recovery-required')).toBe('recovery-required')
  })

  it('retries connect only when repair reports repaired', () => {
    expect(resolveConnectAfterRepair('repaired')).toEqual({ action: 'retry' })
  })

  it('maps recovery-required to fresh sign-in instead of transient finalizing', () => {
    const decision = resolveConnectAfterRepair('recovery-required')
    expect(decision.action).toBe('fresh-sign-in')
    if (decision.action === 'fresh-sign-in') {
      expect(decision.message).toMatch(/sign-in for chat expired/i)
    }
  })

  it('maps true-stale to fresh sign-in', () => {
    expect(resolveConnectAfterRepair('true-stale').action).toBe('fresh-sign-in')
  })

  it('maps transient repair to wait message', () => {
    const decision = resolveConnectAfterRepair('transient')
    expect(decision.action).toBe('wait')
    if (decision.action === 'wait') {
      expect(decision.message).toMatch(/still finalizing/i)
    }
  })

  it('maps no-privy to privy-not-loaded message', () => {
    const decision = resolveConnectAfterRepair('no-privy')
    expect(decision.action).toBe('privy-not-loaded')
    if (decision.action === 'privy-not-loaded') {
      expect(decision.message).toMatch(/Privy sign-in is not loaded/i)
    }
  })
})

describe('resolveConnectFailureDisplay', () => {
  it('flags embedded-signer expiry messages as needing a fresh sign-in', () => {
    const display = resolveConnectFailureDisplay(
      'Embedded signer session expired. Sign out and sign in with email OTP again, then retry Connect Messaging.',
    )
    expect(display.needsFreshSignIn).toBe(true)
    expect(display.message).toMatch(/sign-in for chat expired/i)
  })

  it('flags a raw "missing auth token" error as needing a fresh sign-in', () => {
    const display = resolveConnectFailureDisplay('UnknownRpcError: Missing auth token')
    expect(display.needsFreshSignIn).toBe(true)
    expect(display.message).toMatch(/sign-in for chat expired/i)
  })

  it('passes through unrelated errors without forcing a fresh sign-in', () => {
    const display = resolveConnectFailureDisplay('waitlist_chat_not_configured')
    expect(display.needsFreshSignIn).toBe(false)
    expect(display.message).toMatch(/not configured/i)
  })
})

describe('useWaitlistMessagingConnect connectAndJoin', () => {
  function buildHarness(initial: { xmtpStatus: XmtpStatus; xmtpError?: string | null }) {
    const state = { xmtpStatus: initial.xmtpStatus, xmtpError: initial.xmtpError ?? null }
    const connect = vi.fn(async () => undefined)
    const disconnect = vi.fn(async () => undefined)
    const prepare = vi.fn(async () => ({ ok: true as const }))
    const retryJoin = vi.fn()
    const repairSession = vi.fn()

    const rendered = renderHook(
      (props: { xmtpStatus: XmtpStatus; xmtpError: string | null }) =>
        useWaitlistMessagingConnect({
          xmtpStatus: props.xmtpStatus,
          xmtpError: props.xmtpError,
          privyAuthenticated: true,
          prepare,
          connect,
          disconnect,
          joinStatus: 'idle',
          retryJoin,
          walletReady: true,
          repairSession,
        }),
      { initialProps: state },
    )

    return { ...rendered, state, connect, disconnect, prepare, retryJoin, repairSession }
  }

  it('reports success and requests join when connect() actually reaches connected', async () => {
    const harness = buildHarness({ xmtpStatus: 'idle' })
    harness.connect.mockImplementation(async () => {
      // Mirrors provider.tsx's real connect(): internal setStatus/setError
      // calls re-render the consumer with the fresh status before the
      // connect() promise itself resolves.
      harness.state.xmtpStatus = 'connected'
      flushSync(() => harness.rerender(harness.state))
    })

    await act(async () => {
      await harness.result.current.connectAndJoin()
    })

    expect(harness.retryJoin).toHaveBeenCalledTimes(1)
    expect(harness.repairSession).not.toHaveBeenCalled()
    expect(harness.result.current.prepareError).toBeNull()
    expect(harness.result.current.needsFreshSignIn).toBe(false)
  })

  it('does not report success when connect() resolves without reaching connected status', async () => {
    const harness = buildHarness({ xmtpStatus: 'idle' })
    const failureMessage =
      'Embedded signer session expired. Sign out and sign in with email OTP again, then retry Connect Messaging.'
    harness.connect.mockImplementation(async () => {
      // Mirrors provider.tsx's real connect(): it sets status/error
      // internally on a handled failure and resolves without throwing.
      harness.state.xmtpStatus = 'error'
      harness.state.xmtpError = failureMessage
      flushSync(() => harness.rerender(harness.state))
    })

    await act(async () => {
      await harness.result.current.connectAndJoin()
    })

    expect(harness.retryJoin).not.toHaveBeenCalled()
    // provider.tsx already ran its own bounded repair internally before
    // landing in this terminal error state — this outer layer must not
    // invoke repairSession a second time for the same failure.
    expect(harness.repairSession).not.toHaveBeenCalled()
    expect(harness.result.current.prepareError).toMatch(/sign-in for chat expired/i)
    expect(harness.result.current.needsFreshSignIn).toBe(true)
  })
})
