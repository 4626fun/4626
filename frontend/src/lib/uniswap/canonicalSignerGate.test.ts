import { describe, expect, it } from 'vitest'

import { evaluateCanonicalSignerGate } from './canonicalSignerGate'

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

  it('fails when embedded wallet is missing in canonical mode', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
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
      canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
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
      canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
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
      canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
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

  it('fails when embedded wallet is not an owner', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
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

  it('is ready when embedded wallet can sign and is owner', () => {
    const result = evaluateCanonicalSignerGate({
      executionMode: 'canonical',
      canonicalAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      authStatus: 'authenticated',
      embeddedWalletDetected: true,
      embeddedWalletAddress: '0x1111111111111111111111111111111111111111',
      embeddedWalletCanSign: true,
      ownerCheckStatus: 'owner',
    })

    expect(result.required).toBe(true)
    expect(result.ready).toBe(true)
    expect(result.code).toBe('ok')
    expect(result.reason).toBeNull()
  })
})
