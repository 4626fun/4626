import { describe, expect, it } from 'vitest'

import { resolveCreatorIdentity } from './creatorIdentity'

const A = '0x00000000000000000000000000000000000000a1'
const B = '0x00000000000000000000000000000000000000b2'

describe('resolveCreatorIdentity', () => {
  it('does not promote Privy wallet to canonical when no creator coin exists', () => {
    const identity = resolveCreatorIdentity({
      connectedWallet: B as any,
      privySmartWallet: A as any,
      zoraCoin: null,
    })

    expect(identity.canonicalIdentity.address).toBeNull()
    expect(identity.execution.address).toBe(A.toLowerCase())
    expect(identity.blockingReason).toContain('No canonical Zora Coinbase Smart Wallet found yet')
  })

  it('keeps existing creator coin creator as canonical identity', () => {
    const identity = resolveCreatorIdentity({
      connectedWallet: null,
      privySmartWallet: A as any,
      zoraCoin: {
        creatorAddress: B,
        payoutRecipientAddress: B,
      } as any,
    })

    expect(identity.canonicalIdentity.address).toBe(B.toLowerCase())
    expect(identity.canonicalIdentity.source).toBe('zoraCoinCreatorAddress')
    expect(identity.blockingReason).toContain("doesn't match")
  })
})
