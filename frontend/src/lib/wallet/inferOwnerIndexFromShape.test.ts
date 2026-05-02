import { describe, expect, it } from 'vitest'

import {
  inferOwnerIndexFromShape,
  type InferOwnerSlot,
} from './inferOwnerIndexFromShape'

const EOA_OWNER_1_ADDRESS = '0x5E1a0AFa913aD95aA3762b18Ea9AdD73d31313cf'
const EOA_OWNER_2_ADDRESS = '0xCf8D17Ce01B73637ef936fe7c47bA7100b820142'

const PASSKEY_OWNER: InferOwnerSlot = {
  index: 0,
  kind: 'passkey',
  pubkey: '0x983314af' + '00'.repeat(60),
}
const EOA_OWNER_1: InferOwnerSlot = {
  index: 1,
  kind: 'eoa',
  address: EOA_OWNER_1_ADDRESS,
}
const EOA_OWNER_2: InferOwnerSlot = {
  index: 2,
  kind: 'eoa',
  address: EOA_OWNER_2_ADDRESS,
}

const OWNERS: InferOwnerSlot[] = [PASSKEY_OWNER, EOA_OWNER_1, EOA_OWNER_2]

describe('inferOwnerIndexFromShape', () => {
  it('webauthn shape with passkey at index 0 → returns 0', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'webauthn',
      wrapperClaimedIndex: 0,
      owners: OWNERS,
    })
    expect(result.inferredIndex).toBe(0)
    expect(result.inferredKind).toBe('passkey')
    expect(result.wrapperAgrees).toBe(true)
    expect(result.reason).toMatch(/WebAuthn/)
  })

  it('secp256k1 with raw recovered matching owner[1] → returns 1', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'secp256k1',
      wrapperClaimedIndex: 1,
      owners: OWNERS,
      recoveredCandidates: { raw: EOA_OWNER_1_ADDRESS },
    })
    expect(result.inferredIndex).toBe(1)
    expect(result.inferredKind).toBe('eoa')
    expect(result.wrapperAgrees).toBe(true)
    expect(result.reason).toMatch(/raw recovery/)
  })

  it('secp256k1 with eip191 recovered matching owner[2] → returns 2 and reports EIP-191', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'secp256k1',
      wrapperClaimedIndex: 2,
      owners: OWNERS,
      // raw recovery returns junk; only the EIP-191 path matches.
      recoveredCandidates: {
        raw: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        eip191: EOA_OWNER_2_ADDRESS,
      },
    })
    expect(result.inferredIndex).toBe(2)
    expect(result.inferredKind).toBe('eoa')
    expect(result.wrapperAgrees).toBe(true)
    expect(result.reason).toMatch(/EIP-191/)
  })

  it('secp256k1 with no recovered match → null inferredIndex with sensible reason', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'secp256k1',
      wrapperClaimedIndex: 2,
      owners: OWNERS,
      recoveredCandidates: {
        raw: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        eip191: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbee0',
      },
    })
    expect(result.inferredIndex).toBeNull()
    expect(result.inferredKind).toBe('eoa')
    expect(result.wrapperAgrees).toBe(false)
    expect(result.reason).toMatch(/neither raw nor EIP-191/)
  })

  it('unknown shape → all nulls', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'unknown',
      wrapperClaimedIndex: 2,
      owners: OWNERS,
    })
    expect(result.inferredIndex).toBeNull()
    expect(result.inferredKind).toBeNull()
    expect(result.wrapperAgrees).toBe(false)
    expect(result.reason).toMatch(/shape unknown/)
  })

  it('wrapper claims 2 but shape says webauthn → wrapperAgrees=false, inferred=0', () => {
    // This is the live-fixture scenario: Base App hard-codes ownerIndex=2 in
    // the wrapper, but the inner bytes are a (mis)encoded WebAuthnAuth, so the
    // real signer is the passkey at owner[0].
    const result = inferOwnerIndexFromShape({
      shape: 'webauthn',
      wrapperClaimedIndex: 2,
      owners: OWNERS,
    })
    expect(result.inferredIndex).toBe(0)
    expect(result.inferredKind).toBe('passkey')
    expect(result.wrapperAgrees).toBe(false)
  })

  it('case-insensitively matches recovered EOA address against owner address', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'secp256k1',
      wrapperClaimedIndex: 1,
      owners: OWNERS,
      recoveredCandidates: { raw: EOA_OWNER_1_ADDRESS.toLowerCase() },
    })
    expect(result.inferredIndex).toBe(1)
    expect(result.wrapperAgrees).toBe(true)
  })

  it('webauthn with multiple passkey owners → prefers lowest index and notes it', () => {
    const second: InferOwnerSlot = { index: 3, kind: 'passkey', pubkey: '0xab' }
    const result = inferOwnerIndexFromShape({
      shape: 'webauthn',
      wrapperClaimedIndex: null,
      owners: [...OWNERS, second],
    })
    expect(result.inferredIndex).toBe(0)
    expect(result.reason).toMatch(/multiple passkey/)
  })

  it('webauthn with no passkey owner → null index, reason explains', () => {
    const result = inferOwnerIndexFromShape({
      shape: 'webauthn',
      wrapperClaimedIndex: 1,
      owners: [EOA_OWNER_1, EOA_OWNER_2],
    })
    expect(result.inferredIndex).toBeNull()
    expect(result.inferredKind).toBe('passkey')
    expect(result.reason).toMatch(/no passkey owner/)
  })
})
