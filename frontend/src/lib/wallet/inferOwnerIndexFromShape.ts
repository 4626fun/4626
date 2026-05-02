// Infer which CSW owner actually signed by looking at the SHAPE of the inner
// signature, not the wrapper's claimed `ownerIndex`.
//
// Why this helper exists: Base App returns SignatureWrapper bytes that
// hard-code `ownerIndex = 2` (an EOA owner) even when the inner bytes look
// like a misencoded WebAuthnAuth tuple — i.e. the actual signer is the
// passkey owner at a different index. ecrecover on those bytes returns
// junk addresses with no on-chain history. The signature shape (passkey
// vs ECDSA) is the source of truth; the wrapper's index field is a hint
// at best.
//
// Probe-only consumer: `pages/dev/CswSignatureProbe.tsx` shows the
// inferred index next to the wrapper-claimed index, and re-runs ERC-1271
// against the inferred owner when they disagree.

export type InferOwnerShape = 'secp256k1' | 'webauthn' | 'unknown'

export type InferOwnerSlot = {
  index: number
  kind: 'eoa' | 'passkey'
  address?: string
  pubkey?: string
}

export type InferOwnerArgs = {
  shape: InferOwnerShape
  wrapperClaimedIndex: number | null
  owners: InferOwnerSlot[]
  recoveredCandidates?: { raw?: string; eip191?: string }
}

export type InferOwnerResult = {
  inferredIndex: number | null
  inferredKind: 'eoa' | 'passkey' | null
  reason: string
  wrapperAgrees: boolean
}

function eqLower(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

export function inferOwnerIndexFromShape(args: InferOwnerArgs): InferOwnerResult {
  const { shape, wrapperClaimedIndex, owners, recoveredCandidates } = args

  if (shape === 'unknown') {
    return {
      inferredIndex: null,
      inferredKind: null,
      reason: 'shape unknown — cannot infer',
      wrapperAgrees: false,
    }
  }

  if (shape === 'webauthn') {
    const passkeyOwners = owners
      .filter((o) => o.kind === 'passkey')
      .sort((a, b) => a.index - b.index)
    const chosen = passkeyOwners[0]
    if (!chosen) {
      return {
        inferredIndex: null,
        inferredKind: 'passkey',
        reason: 'shape is WebAuthn but no passkey owner exists in the on-chain owners array',
        wrapperAgrees: false,
      }
    }
    const reason =
      passkeyOwners.length === 1
        ? `shape is WebAuthn → only passkey owner is at index ${chosen.index}`
        : `shape is WebAuthn → multiple passkey owners; preferring lowest index ${chosen.index}`
    const wrapperAgrees =
      wrapperClaimedIndex !== null && wrapperClaimedIndex === chosen.index
    return {
      inferredIndex: chosen.index,
      inferredKind: 'passkey',
      reason,
      wrapperAgrees,
    }
  }

  // shape === 'secp256k1'
  const eoaOwners = owners.filter((o) => o.kind === 'eoa')
  const raw = recoveredCandidates?.raw
  const eip191 = recoveredCandidates?.eip191

  const rawHit = raw ? eoaOwners.find((o) => eqLower(o.address, raw)) : undefined
  if (rawHit) {
    return {
      inferredIndex: rawHit.index,
      inferredKind: 'eoa',
      reason: `shape is secp256k1 → raw recovery matched EOA owner[${rawHit.index}]`,
      wrapperAgrees:
        wrapperClaimedIndex !== null && wrapperClaimedIndex === rawHit.index,
    }
  }

  const eipHit = eip191 ? eoaOwners.find((o) => eqLower(o.address, eip191)) : undefined
  if (eipHit) {
    return {
      inferredIndex: eipHit.index,
      inferredKind: 'eoa',
      reason: `shape is secp256k1 → EIP-191 recovery matched EOA owner[${eipHit.index}]`,
      wrapperAgrees:
        wrapperClaimedIndex !== null && wrapperClaimedIndex === eipHit.index,
    }
  }

  const haveCandidates = Boolean(raw || eip191)
  return {
    inferredIndex: null,
    inferredKind: 'eoa',
    reason: haveCandidates
      ? 'shape is secp256k1 but neither raw nor EIP-191 recovery matched any EOA owner'
      : 'shape is secp256k1 but no recovered candidates were provided',
    wrapperAgrees: false,
  }
}
