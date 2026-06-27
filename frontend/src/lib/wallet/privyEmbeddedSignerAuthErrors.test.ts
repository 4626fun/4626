import { describe, expect, it } from 'vitest'

import { isPrivyEmbeddedSignerAuthError } from '@/lib/wallet/privyEmbeddedSignerAuthErrors'

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
