import { describe, expect, it } from 'vitest'

import {
  assertSwapSpendBalancePreflight,
  deriveSwapExecutionReadiness,
  evaluateCanonicalSubmitSession,
  evaluateSwapSessionGate,
  resolveCanonicalSubmitSession,
  shouldDisablePermit2ForSwap,
  shouldSimulateSwapBuild,
  shouldSimulateSwapTransaction,
  shouldStartAutoQuote,
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

  it('blocks non-canonical execution address when 4626 canonical policy applies', () => {
    expect(
      deriveSwapExecutionReadiness({
        quoteReady: true,
        executionMode: 'canonical',
        executionTrack: 'none-yet',
        canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        executionAddress: '0x3333333333333333333333333333333333333333',
        signerAddress: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        canonicalPolicyApplies: true,
      }),
    ).toBe(false)
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

describe('shouldDisablePermit2ForSwap', () => {
  it('keeps Permit2 enabled for parent canonical CSW execution', () => {
    expect(
      shouldDisablePermit2ForSwap({
        executionMode: 'canonical',
        canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        executionAddress: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
      }),
    ).toBe(false)
  })

  it('disables Permit2 for non-CSW canonical execution lanes', () => {
    expect(
      shouldDisablePermit2ForSwap({
        executionMode: 'canonical',
        canonicalAddress: null,
        executionAddress: '0x1111111111111111111111111111111111111111',
      }),
    ).toBe(true)
  })

  it('keeps Permit2 enabled when the parent canonical CSW is the execution address in EOA mode', () => {
    expect(
      shouldDisablePermit2ForSwap({
        executionMode: 'eoa',
        canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        executionAddress: '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5',
      }),
    ).toBe(false)
  })

  it('keeps Permit2 available for normal external EOA swaps', () => {
    expect(
      shouldDisablePermit2ForSwap({
        executionMode: 'eoa',
        canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        executionAddress: '0x3333333333333333333333333333333333333333',
      }),
    ).toBe(false)
  })
})

describe('shouldSimulateSwapTransaction', () => {
  it('skips simulation when approval or native wrap batching is required', () => {
    expect(shouldSimulateSwapTransaction(true, false)).toBe(false)
    expect(shouldSimulateSwapTransaction(false, true)).toBe(false)
    expect(shouldSimulateSwapTransaction(true, true)).toBe(false)
  })

  it('allows simulation only for standalone swap builds', () => {
    expect(shouldSimulateSwapTransaction(false, false)).toBe(true)
  })
})

describe('shouldSimulateSwapBuild', () => {
  it('never simulates canonical CSW or Zora quote builds', () => {
    expect(
      shouldSimulateSwapBuild({
        executionMode: 'canonical',
        isZoraQuote: false,
        requiresApprovalTx: false,
        wrapsNativeEthForCanonical: false,
      }),
    ).toBe(false)
    expect(
      shouldSimulateSwapBuild({
        executionMode: 'eoa',
        isZoraQuote: true,
        requiresApprovalTx: false,
        wrapsNativeEthForCanonical: false,
      }),
    ).toBe(false)
  })

  it('simulates external EOA Uniswap builds when no batching is required', () => {
    expect(
      shouldSimulateSwapBuild({
        executionMode: 'eoa',
        isZoraQuote: false,
        requiresApprovalTx: false,
        wrapsNativeEthForCanonical: false,
      }),
    ).toBe(true)
    expect(
      shouldSimulateSwapBuild({
        executionMode: 'eoa',
        isZoraQuote: false,
        requiresApprovalTx: true,
        wrapsNativeEthForCanonical: false,
      }),
    ).toBe(false)
  })
})

describe('shouldStartAutoQuote', () => {
  it('blocks auto-quote during every in-flight quote/review/build/execute phase (H-3 regression)', () => {
    for (const busy of [
      'quote',
      'review',
      'approval',
      'buildSwap',
      'executeApproval',
      'executeSwap',
      'executeOrder',
    ]) {
      expect(shouldStartAutoQuote({ busy, txState: 'idle' })).toBe(false)
    }
  })

  it('blocks auto-quote while a transaction is signing or pending', () => {
    expect(shouldStartAutoQuote({ busy: null, txState: 'signing' })).toBe(false)
    expect(shouldStartAutoQuote({ busy: null, txState: 'pending' })).toBe(false)
  })

  it('allows auto-quote when idle', () => {
    expect(shouldStartAutoQuote({ busy: null, txState: 'idle' })).toBe(true)
    expect(shouldStartAutoQuote({ busy: null, txState: null })).toBe(true)
    expect(shouldStartAutoQuote({ busy: null, txState: 'review' })).toBe(true)
    expect(shouldStartAutoQuote({ busy: null, txState: 'success' })).toBe(true)
    expect(shouldStartAutoQuote({ busy: null, txState: 'error' })).toBe(true)
  })
})

describe('assertSwapSpendBalancePreflight', () => {
  const wallet = '0x1111111111111111111111111111111111111111' as const

  it('rejects native ETH sells above wallet balance', async () => {
    await expect(
      assertSwapSpendBalancePreflight({
        publicClient: {
          getBalance: async () => 1_000_000_000_000_000n,
          readContract: async () => 0n,
        },
        executionAddress: wallet,
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        amountInUnits: '0.01',
        wrapNativeEthForCanonical: true,
        getTokenDecimals: async () => 18,
      }),
    ).rejects.toThrow(/Insufficient ETH/)
  })

  it('allows native ETH sells within wallet balance', async () => {
    await expect(
      assertSwapSpendBalancePreflight({
        publicClient: {
          getBalance: async () => 10_000_000_000_000_000_000n,
          readContract: async () => 0n,
        },
        executionAddress: wallet,
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        amountInUnits: '0.01',
        wrapNativeEthForCanonical: true,
        getTokenDecimals: async () => 18,
      }),
    ).resolves.toBeUndefined()
  })
})
