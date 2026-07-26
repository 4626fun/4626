import { describe, expect, it } from 'vitest'

import {
  deriveCanonicalOwnerCheckStatus,
  evaluateCanonicalSignerGate,
  resolveSwapExecutionMode,
} from './canonicalSignerGate'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const USER_CANONICAL_CSW = '0xcccccccccccccccccccccccccccccccccccccccc'

describe('deriveCanonicalOwnerCheckStatus', () => {
  it('requires live owner probe evidence before returning owner', () => {
    expect(deriveCanonicalOwnerCheckStatus({ probeResult: true })).toBe('owner')
    expect(deriveCanonicalOwnerCheckStatus({ probeResult: false })).toBe('not-owner')
    expect(deriveCanonicalOwnerCheckStatus({ probeResult: null })).toBe('pending')
    expect(deriveCanonicalOwnerCheckStatus({ probeResult: undefined })).toBe('unknown')
  })

  it('keeps loading probes pending even when prior data is absent', () => {
    expect(deriveCanonicalOwnerCheckStatus({ probeLoading: true })).toBe('pending')
    expect(deriveCanonicalOwnerCheckStatus({ probeFetching: true })).toBe('pending')
  })
})

describe('resolveSwapExecutionMode', () => {
  it('keeps a matching Base Account connector on canonical routing while signer detection hydrates', () => {
    expect(
      resolveSwapExecutionMode({
        activeAccountType: 'EOA',
        isConnected: true,
        executionTrack: 'base-app-direct',
        baseAppDirectConnected: true,
      }),
    ).toBe('canonical')
  })

  it('keeps a disconnected base-app-direct profile in canonical mode so the connect action is available', () => {
    expect(
      resolveSwapExecutionMode({
        activeAccountType: 'UNKNOWN',
        isConnected: false,
        executionTrack: 'base-app-direct',
        baseAppDirectConnected: false,
      }),
    ).toBe('canonical')
  })

  it('preserves direct EOA mode when an external wallet is connected', () => {
    expect(
      resolveSwapExecutionMode({
        activeAccountType: 'EOA',
        isConnected: true,
        executionTrack: 'base-app-direct',
        baseAppDirectConnected: false,
      }),
    ).toBe('eoa')
  })
})

describe('evaluateCanonicalSignerGate', () => {
  it('is not required in eoa mode', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'eoa',
      canonicalAddress: null,
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
    })

    expect(result.required).toBe(false)
    expect(result.ready).toBe(true)
    expect(result.code).toBe('not-required')
    expect(result.reason).toBeNull()
  })

  it('fails with privy-client-disabled when canonical mode has no Privy client', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'disabled',
      authStatus: 'unknown',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('privy-client-disabled')
    expect(result.reason).toContain('Privy is not configured')
  })

  it('returns auth-loading while Privy client is initializing', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'loading',
      authStatus: 'unknown',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('privy-auth-loading')
    expect(result.reason).toContain('still initializing')
  })

  it('fails when embedded wallet is missing in canonical mode', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('embedded-wallet-missing')
    expect(result.reason).toContain('Privy embedded wallet not detected')
  })

  it('returns auth-loading while Privy state is unresolved and no embedded wallet is detected', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'unknown',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('privy-auth-loading')
    expect(result.reason).toContain('Waiting for Privy')
  })

  it('fails with auth-required when canonical mode is not Privy-authenticated', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'unauthenticated',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('privy-auth-required')
    expect(result.reason).toContain('Sign in with Privy')
  })

  it('fails when ownership check is still pending', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'pending',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('owner-check-pending')
    expect(result.reason).toContain('ownership check')
  })

  it('allows none-yet track when embedded owner is already confirmed', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'none-yet',
      canonicalAddress: USER_CANONICAL_CSW,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'owner',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.code).toBe('ok')
  })

  it('asks to connect Base App CSW when server track is base-app-direct but wallet is not linked', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'base-app-direct',
      canonicalAddress: USER_CANONICAL_CSW,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'not-owner',
      baseAppDirectConnected: false,
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('execution-setup-required')
    expect(result.reason).toContain('Base App')
  })

  it('is ready for a live Base Account match even while Privy is disabled or loading', () => {
    for (const clientStatus of ['disabled', 'loading'] as const) {
      const result = evaluateCanonicalSignerGate({
        executionMode: 'canonical',
        executionTrack: 'base-app-direct',
        canonicalAddress: USER_CANONICAL_CSW,
        clientStatus,
        authStatus: 'unauthenticated',
        embeddedWalletDetected: false,
        embeddedWalletAddress: null,
        embeddedWalletCanSign: false,
        ownerCheckStatus: 'unknown',
        baseAppDirectConnected: true,
      })

      expect(result.required).toBe(true)
      expect(result.ready).toBe(true)
      expect(result.code).toBe('ok')
    }
  })

  it('asks disconnected base-app-direct profiles to connect without waiting on Privy', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'base-app-direct',
      canonicalAddress: USER_CANONICAL_CSW,
      clientStatus: 'loading',
      authStatus: 'unknown',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'unknown',
      baseAppDirectConnected: false,
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('execution-setup-required')
    expect(result.reason).toContain('Base App')
  })

  it('is ready for Base App direct CSW signing without embedded-owner install', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'base-app-direct',
      canonicalAddress: USER_CANONICAL_CSW,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'not-owner',
      baseAppDirectConnected: true,
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.code).toBe('ok')
  })

  it('is ready for a live Base Account CSW match even when server track still says none-yet', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'none-yet',
      canonicalAddress: USER_CANONICAL_CSW,
      clientStatus: 'ready',
      authStatus: 'unauthenticated',
      embeddedWalletDetected: false,
      embeddedWalletAddress: null,
      embeddedWalletCanSign: false,
      ownerCheckStatus: 'not-owner',
      baseAppDirectConnected: true,
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.code).toBe('ok')
  })

  it('fails for none-yet track when owner is not confirmed', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'none-yet',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'not-owner',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('execution-setup-required')
  })

  it('fails when embedded wallet is not an owner', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'not-owner',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('embedded-wallet-not-owner')
    expect(result.reason).toContain('not an owner')
  })

  it('surfaces recoverable code when stale legacy-owner-install track loses owner', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      executionTrack: 'legacy-owner-install',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'not-owner',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(false)
    expect(result.code).toBe('owner-removed-stale-track')
    expect(result.reason).toContain('Re-enable 4626 signing')
  })

  it('is ready when embedded wallet can sign and is owner', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: CANONICAL_CSW_ADDRESS,
      clientStatus: 'ready',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'owner',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.code).toBe('ok')
    expect(result.reason).toBeNull()
  })
})
