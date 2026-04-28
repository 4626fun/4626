import { describe, expect, it } from 'vitest'

import {
  deriveSwapExecutionReadiness,
  evaluateCanonicalSubmitSession,
  evaluateSwapSessionGate,
  resolveCanonicalSubmitSession,
} from './useSwapExecution'
import { requiresCanonicalExecutionForSwapMode } from '@/lib/swap/providerConfig'

describe('evaluateSwapSessionGate', () => {
  it('blocks quote requests while the 4626 session is still hydrating', () => {
    expect(
      evaluateSwapSessionGate({
        sessionHydrated: false,
        hasSession: false,
      }),
    ).toEqual({
      ok: false,
      code: 'session-hydrating',
      message: 'Still restoring your 4626 session. Please wait a moment before requesting swap quotes.',
    })
  })

  it('blocks quote requests when no 4626 session exists', () => {
    expect(
      evaluateSwapSessionGate({
        sessionHydrated: true,
        hasSession: false,
      }),
    ).toEqual({
      ok: false,
      code: 'session-missing',
      message: 'Sign in to 4626 to request swap quotes and submit trades.',
    })
  })

  it('allows quote requests when the session is ready', () => {
    expect(
      evaluateSwapSessionGate({
        sessionHydrated: true,
        hasSession: true,
      }),
    ).toEqual({
      ok: true,
      code: 'ok',
      message: null,
    })
  })
})

describe('evaluateCanonicalSubmitSession', () => {
  it('blocks canonical submit while session state is still hydrating', () => {
    expect(
      evaluateCanonicalSubmitSession({
        executionMode: 'canonical',
        sessionHydrated: false,
        hasSession: false,
        sessionAddress: null,
        executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      }),
    ).toEqual({
      ok: false,
      code: 'session-hydrating',
      message: 'Still restoring your 4626 session. Please wait a moment and try again.',
      shouldAttemptRefresh: false,
    })
  })

  it('blocks canonical submit when no restored 4626 session exists', () => {
    expect(
      evaluateCanonicalSubmitSession({
        executionMode: 'canonical',
        sessionHydrated: true,
        hasSession: false,
        sessionAddress: null,
        executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      }),
    ).toEqual({
      ok: false,
      code: 'session-missing',
      message: 'Your 4626 session expired. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    })
  })

  it('blocks canonical submit when the restored session targets a different wallet', () => {
    expect(
      evaluateCanonicalSubmitSession({
        executionMode: 'canonical',
        sessionHydrated: true,
        hasSession: true,
        sessionAddress: '0x1111111111111111111111111111111111111111',
        executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        expectedSessionAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toEqual({
      ok: false,
      code: 'session-mismatch',
      message: 'Your restored 4626 session does not match the canonical owner signer. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    })
  })

  it('allows canonical submit when the restored session matches the canonical owner signer', () => {
    expect(
      evaluateCanonicalSubmitSession({
        executionMode: 'canonical',
        sessionHydrated: true,
        hasSession: true,
        sessionAddress: '0x1111111111111111111111111111111111111111',
        executionAddress: '0xAB6D5C10B03300326CD7FAB7267AE192842967B5',
        expectedSessionAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toEqual({
      ok: true,
      code: 'ok',
      message: null,
      shouldAttemptRefresh: false,
    })
  })

  it('does not block non-canonical submit paths', () => {
    expect(
      evaluateCanonicalSubmitSession({
        executionMode: 'eoa',
        sessionHydrated: false,
        hasSession: false,
        sessionAddress: null,
        executionAddress: null,
      }),
    ).toEqual({
      ok: true,
      code: 'not-required',
      message: null,
      shouldAttemptRefresh: false,
    })
  })
})

describe('resolveCanonicalSubmitSession', () => {
  it('attempts a pre-send re-bridge for stale canonical sessions', async () => {
    const ensureCanonicalSession = async () => true

    await expect(
      resolveCanonicalSubmitSession(
        {
          executionMode: 'canonical',
          sessionHydrated: true,
          hasSession: false,
          sessionAddress: null,
          executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        },
        ensureCanonicalSession,
      ),
    ).resolves.toEqual({
      ok: true,
      code: 'ok',
      message: null,
      shouldAttemptRefresh: false,
    })
  })

  it('does not bypass mismatch when refresh reports success without an address', async () => {
    const ensureCanonicalSession = async () => true

    await expect(
      resolveCanonicalSubmitSession(
        {
          executionMode: 'canonical',
          sessionHydrated: true,
          hasSession: true,
          sessionAddress: '0x1111111111111111111111111111111111111111',
          executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          expectedSessionAddress: '0x2222222222222222222222222222222222222222',
        },
        ensureCanonicalSession,
      ),
    ).resolves.toEqual({
      ok: false,
      code: 'session-mismatch',
      message: 'Your restored 4626 session does not match the canonical owner signer. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    })
  })

  it('allows mismatch recovery only when refreshed address matches the canonical signer', async () => {
    const ensureCanonicalSession = async () => '0x2222222222222222222222222222222222222222'

    await expect(
      resolveCanonicalSubmitSession(
        {
          executionMode: 'canonical',
          sessionHydrated: true,
          hasSession: true,
          sessionAddress: '0x1111111111111111111111111111111111111111',
          executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          expectedSessionAddress: '0x2222222222222222222222222222222222222222',
        },
        ensureCanonicalSession,
      ),
    ).resolves.toEqual({
      ok: true,
      code: 'ok',
      message: null,
      shouldAttemptRefresh: false,
    })
  })

  it('keeps blocking canonical submit when the pre-send re-bridge fails', async () => {
    const ensureCanonicalSession = async () => false

    await expect(
      resolveCanonicalSubmitSession(
        {
          executionMode: 'canonical',
          sessionHydrated: true,
          hasSession: true,
          sessionAddress: '0x1111111111111111111111111111111111111111',
          executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          expectedSessionAddress: '0x2222222222222222222222222222222222222222',
        },
        ensureCanonicalSession,
      ),
    ).resolves.toEqual({
      ok: false,
      code: 'session-mismatch',
      message: 'Your restored 4626 session does not match the canonical owner signer. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    })
  })

  it('keeps blocking mismatch when refreshed session address does not match signer', async () => {
    const ensureCanonicalSession = async () => '0x3333333333333333333333333333333333333333'

    await expect(
      resolveCanonicalSubmitSession(
        {
          executionMode: 'canonical',
          sessionHydrated: true,
          hasSession: true,
          sessionAddress: '0x1111111111111111111111111111111111111111',
          executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          expectedSessionAddress: '0x2222222222222222222222222222222222222222',
        },
        ensureCanonicalSession,
      ),
    ).resolves.toEqual({
      ok: false,
      code: 'session-mismatch',
      message: 'Your restored 4626 session does not match the canonical owner signer. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    })
  })
})

describe('CDP canonical mode policy helpers', () => {
  it('requires canonical execution for cdp and hybrid swap modes', () => {
    expect(requiresCanonicalExecutionForSwapMode('uniswap')).toBe(false)
    expect(requiresCanonicalExecutionForSwapMode('cdp')).toBe(true)
    expect(requiresCanonicalExecutionForSwapMode('hybrid')).toBe(true)
  })
})

describe('deriveSwapExecutionReadiness', () => {
  it('allows canonical parent-CSW submit when the embedded owner signer is ready', () => {
    expect(
      deriveSwapExecutionReadiness({
        quoteReady: true,
        executionMode: 'canonical',
        executionTrack: 'legacy-owner-install',
        canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        executionAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        signerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        canonicalPolicyApplies: true,
      }),
    ).toBe(true)
  })

  it('allows canonical submit only when the Base sub-account track is ready', () => {
    expect(
      deriveSwapExecutionReadiness({
        quoteReady: true,
        executionMode: 'canonical',
        executionTrack: 'sub-account',
        canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        executionAddress: '0x3333333333333333333333333333333333333333',
        signerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        canonicalPolicyApplies: true,
      }),
    ).toBe(true)
  })

  it('preserves external EOA submit readiness when quote inputs are ready', () => {
    expect(
      deriveSwapExecutionReadiness({
        quoteReady: true,
        executionMode: 'eoa',
        executionTrack: null,
        canonicalPolicyApplies: false,
      }),
    ).toBe(true)
  })
})
