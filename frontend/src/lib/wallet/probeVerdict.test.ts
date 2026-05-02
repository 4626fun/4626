import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'

import {
  computeProbeVerdict,
  hasUsableEcdsaRecovery,
  type VerdictOwnerSlot,
  type VerdictProbeInput,
} from './probeVerdict'

const OWNER_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
const OWNER_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address
const STRANGER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address

function baseInput(overrides: Partial<VerdictProbeInput> = {}): VerdictProbeInput {
  return {
    signatureShape: { kind: 'unknown', reason: 'unexpected byte length 97' },
    recoveredDirect: null,
    recoveredPrefixed: null,
    recoveredAgainstReplaySafe: null,
    recoveredAgainstPrefixedReplaySafe: null,
    recoveredAgainstOnchainReplaySafe: null,
    parsedOwnerIndex: 0,
    parsedOwnerAddressOnchain: null,
    ...overrides,
  }
}

const eoaOwner = (index: number, addr: Address): VerdictOwnerSlot => ({
  index,
  ownerType: 'eoa',
  ownerAddress: addr,
})

describe('hasUsableEcdsaRecovery', () => {
  it('returns false when every recovered* field is null', () => {
    expect(hasUsableEcdsaRecovery(baseInput())).toBe(false)
  })

  it('returns true when any recovered* field is set', () => {
    expect(hasUsableEcdsaRecovery(baseInput({ recoveredDirect: OWNER_A }))).toBe(true)
    expect(
      hasUsableEcdsaRecovery(baseInput({ recoveredAgainstOnchainReplaySafe: OWNER_A })),
    ).toBe(true)
    expect(hasUsableEcdsaRecovery(baseInput({ recoveredPrefixed: OWNER_A }))).toBe(true)
  })
})

describe('computeProbeVerdict — unknown shape with successful recovery', () => {
  // Regression for PR #500 (Codex comment 3176518223): a wrapped EOA signature
  // (`signature-wrapper-leading-offset` etc.) classifies as `unknown` because
  // the outer wrapper bytes aren't 65 and aren't a WebAuthn tuple — but we
  // already extracted a 65-byte inner ECDSA and the recovery rows are populated.
  // The verdict must NOT short-circuit to yellow; it should still grade
  // ownership against the on-chain owner snapshot.
  it('produces a green verdict when an inner-ECDSA recovery matches an on-chain owner', () => {
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: { kind: 'unknown', reason: 'unexpected byte length 97' },
        recoveredDirect: OWNER_A,
        parsedOwnerAddressOnchain: OWNER_A,
        parsedOwnerIndex: 1,
      }),
      [eoaOwner(0, OWNER_B), eoaOwner(1, OWNER_A)],
    )
    expect(verdict.state).toBe('green')
    expect(verdict.matchedOwnerIndex).toBe(1)
    expect(verdict.matchedHashLabel).toBe('recoveredDirect(userOpHash)')
  })

  it('produces a red verdict when recoveries succeed but match no owner', () => {
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: { kind: 'unknown', reason: 'abi decode failed' },
        recoveredDirect: STRANGER,
        recoveredPrefixed: STRANGER,
        parsedOwnerAddressOnchain: OWNER_A,
        parsedOwnerIndex: 0,
      }),
      [eoaOwner(0, OWNER_A)],
    )
    expect(verdict.state).toBe('red')
    expect(verdict.matchedOwnerIndex).toBeNull()
  })
})

describe('computeProbeVerdict — unknown shape with no recovery', () => {
  it('falls back to yellow "Unrecognized signature shape" when nothing recovers', () => {
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: { kind: 'unknown', reason: 'unexpected byte length 7' },
      }),
      [eoaOwner(0, OWNER_A)],
    )
    expect(verdict.state).toBe('yellow')
    expect(verdict.label).toMatch(/Unrecognized signature shape/i)
    expect(verdict.detail).toContain('unexpected byte length 7')
  })
})

describe('computeProbeVerdict — non-regression for other shapes', () => {
  it('webauthn shape returns the blue passkey banner regardless of recoveries', () => {
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: {
          kind: 'webauthn',
          authenticatorData: '0xabcd',
          clientDataJSON: '{}',
          r: 1n,
          s: 2n,
          challengeIndex: 0,
          typeIndex: 0,
        },
        recoveredDirect: OWNER_A,
      }),
      [eoaOwner(0, OWNER_A)],
    )
    expect(verdict.state).toBe('blue')
  })

  it('webauthn shape with EOA-claiming wrapper + passkey owner present → blue with shape-disagreement detail', () => {
    // Live Base App fixture: wrapper hard-codes ownerIndex=2 (EOA) but the
    // inner bytes are a WebAuthnAuth tuple, so the real signer is the passkey
    // at owner[0]. Verdict reason must call this out, not the ephemeral key.
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: {
          kind: 'webauthn',
          authenticatorData: '0xabcd',
          clientDataJSON: '{}',
          r: 1n,
          s: 2n,
          challengeIndex: 0,
          typeIndex: 0,
        },
        parsedOwnerIndex: 2,
        recoveredDirect: STRANGER,
      }),
      [
        { index: 0, ownerType: 'passkey', ownerAddress: null },
        eoaOwner(2, OWNER_B),
      ],
    )
    expect(verdict.state).toBe('blue')
    expect(verdict.detail).toMatch(/wrapper ownerIndex disagrees with signature shape/i)
    expect(verdict.detail).toMatch(/passkey owner\[0\]/i)
  })

  it('secp256k1 shape with matching recovery → green', () => {
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: {
          kind: 'secp256k1',
          r: '0xaa',
          s: '0xbb',
          v: 27,
        },
        recoveredDirect: OWNER_A,
        parsedOwnerAddressOnchain: OWNER_A,
        parsedOwnerIndex: 0,
      }),
      [eoaOwner(0, OWNER_A)],
    )
    expect(verdict.state).toBe('green')
  })

  it('secp256k1 shape with no on-chain owner snapshot → yellow', () => {
    const verdict = computeProbeVerdict(
      baseInput({
        signatureShape: {
          kind: 'secp256k1',
          r: '0xaa',
          s: '0xbb',
          v: 27,
        },
        recoveredDirect: OWNER_A,
        parsedOwnerAddressOnchain: null,
      }),
      [],
    )
    expect(verdict.state).toBe('yellow')
    expect(verdict.label).toMatch(/owner snapshot/i)
  })
})
