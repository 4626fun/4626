import { describe, expect, it } from 'vitest'

import {
  mapBaseAppOwnerInstallRpcError,
  shouldAttemptRelayMethodAFallback,
} from '@/features/accountSetup/addUserOp/addOwnerRelayFallbackPolicy'

describe('shouldAttemptRelayMethodAFallback', () => {
  it('returns true for Base App policy-style funding errors when prefund passed', () => {
    expect(
      shouldAttemptRelayMethodAFallback(new Error('Error generating transaction'), {
        fundingPreflightOk: true,
      }),
    ).toBe(true)
  })

  it('returns false when the user dismissed the signing prompt', () => {
    expect(
      shouldAttemptRelayMethodAFallback(
        new Error('You dismissed the Base App signing prompt'),
        { fundingPreflightOk: true },
      ),
    ).toBe(false)
  })

  it('returns true for insufficient-funds surface when prefund already passed', () => {
    expect(
      shouldAttemptRelayMethodAFallback(new Error('not enough funds'), {
        fundingPreflightOk: true,
      }),
    ).toBe(true)
  })

  it('does not cascade to Relay when the CSW genuinely failed prefund', () => {
    expect(
      shouldAttemptRelayMethodAFallback(new Error('not enough funds'), {
        fundingPreflightOk: false,
      }),
    ).toBe(false)
  })

  it.each([
    'wallet_prepareCalls: Failed to fetch RPC request',
    'An internal error was received',
  ])('keeps pre-signing RPC failures in Base App without Relay fallback: %s', (message) => {
    expect(
      shouldAttemptRelayMethodAFallback(new Error(message), {
        fundingPreflightOk: true,
      }),
    ).toBe(false)
    expect(mapBaseAppOwnerInstallRpcError(new Error(message))).toMatch(/nothing was submitted on-chain/i)
  })
})
