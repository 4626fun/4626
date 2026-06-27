import { describe, expect, it } from 'vitest'

import {
  isPrivyEmbeddedSignerAuthError,
  isSigningSessionRecoveryRequired,
} from '@/lib/auth/privyEmbeddedSignerAuthErrors'

describe('isPrivyEmbeddedSignerAuthError', () => {
  it('matches missing auth token errors', () => {
    expect(isPrivyEmbeddedSignerAuthError('Missing auth token.')).toBe(true)
  })

  it('matches Privy wallet RPC authorization signature 401 errors', () => {
    expect(
      isPrivyEmbeddedSignerAuthError(
        'No valid authorization signatures were provided. Your payload may be malformed or your signing keys may be incorrect or expired.',
      ),
    ).toBe(true)
  })

  it('does not match unrelated wallet extension collisions', () => {
    expect(isPrivyEmbeddedSignerAuthError('Cannot redefine property: ethereum')).toBe(false)
  })
})

describe('isSigningSessionRecoveryRequired', () => {
  it('matches post-refresh signing failures', () => {
    expect(
      isSigningSessionRecoveryRequired(
        'Signing session was refreshed but raw digest signing still failed — sign out and sign in again, then retry.',
      ),
    ).toBe(true)
  })

  it('matches explicit Privy session expiry from refresh helper', () => {
    expect(isSigningSessionRecoveryRequired('Privy session expired — sign in again with email OTP.')).toBe(true)
  })

  it('does not match generic swap slippage errors', () => {
    expect(isSigningSessionRecoveryRequired('Slippage tolerance exceeded')).toBe(false)
  })
})
