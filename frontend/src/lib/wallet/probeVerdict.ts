// Pure verdict reducer for the CSW signature probe page. Lives outside the
// component so it can be unit-tested without React/wagmi.
//
// The probe dashboard turns a raw probe result + on-chain owner snapshot into
// a tri-state verdict (green/yellow/red, plus a blue info banner for passkeys).
//
// IMPORTANT: classifying a signature as `unknown` does NOT mean we can't grade
// ownership. `parseWalletSignature` extracts a 65-byte inner ECDSA from
// `signature-wrapper-*` formats whose outer bytes are neither 65 bytes nor a
// WebAuthn tuple — those wrappers fall through `detectSignatureShape` as
// `unknown`. As long as ANY of the recovery candidates produced an address,
// we have enough to evaluate against the on-chain owner array.

import type { Address } from 'viem'
import type { SignatureShape } from './signatureShape'

export type VerdictProbeInput = {
  signatureShape: SignatureShape
  recoveredDirect: Address | null
  recoveredPrefixed: Address | null
  recoveredAgainstReplaySafe: Address | null
  recoveredAgainstPrefixedReplaySafe: Address | null
  recoveredAgainstOnchainReplaySafe: Address | null
  parsedOwnerIndex: number | null
  parsedOwnerAddressOnchain: Address | null
}

export type VerdictOwnerSlot = {
  index: number
  ownerType: 'eoa' | 'passkey' | 'unknown'
  ownerAddress: Address | null
}

export type ProbeVerdict = {
  state: 'green' | 'yellow' | 'red' | 'blue'
  label: string
  detail: string
  matchedOwnerIndex: number | null
  matchedHashLabel: string | null
}

export function hasUsableEcdsaRecovery(probe: VerdictProbeInput): boolean {
  return Boolean(
    probe.recoveredDirect ||
      probe.recoveredPrefixed ||
      probe.recoveredAgainstReplaySafe ||
      probe.recoveredAgainstPrefixedReplaySafe ||
      probe.recoveredAgainstOnchainReplaySafe,
  )
}

export function computeProbeVerdict(
  probe: VerdictProbeInput,
  ownerSlots: VerdictOwnerSlot[],
): ProbeVerdict {
  // Passkey signatures don't go through ecrecover. Surface the right path
  // and skip the recovery-table verdict entirely; the secp256k1 candidates
  // would all garbage out if we tried to grade them.
  if (probe.signatureShape.kind === 'webauthn') {
    return {
      state: 'blue',
      label: 'ℹ️ Passkey signature detected — bundler routes through CSW.WebAuthn.verify',
      detail:
        'ecrecover-based checks below are inapplicable. Compare the clientDataJSON challenge to the signed userOpHash / on-chain replaySafeHash to validate.',
      matchedOwnerIndex: null,
      matchedHashLabel: null,
    }
  }

  // Wrapped EOA signatures (e.g. signature-wrapper-leading-offset from Base
  // App) classify as `unknown` because the outer bytes aren't 65 and don't
  // abi-decode as WebAuthnAuth — but parseWalletSignature still pulls a 65-
  // byte inner ECDSA out of them, and the recovery rows are populated. Only
  // short-circuit to yellow when nothing recovered.
  if (probe.signatureShape.kind === 'unknown' && !hasUsableEcdsaRecovery(probe)) {
    return {
      state: 'yellow',
      label: '⚠️ Unrecognized signature shape',
      detail: `Cannot evaluate ownership match. Reason: ${probe.signatureShape.reason}.`,
      matchedOwnerIndex: null,
      matchedHashLabel: null,
    }
  }

  const candidates: Array<{ label: string; address: Address | null }> = [
    { label: 'recoveredDirect(userOpHash)', address: probe.recoveredDirect },
    { label: 'recoveredAgainstOnchainReplaySafe', address: probe.recoveredAgainstOnchainReplaySafe },
    { label: 'recoveredAgainstReplaySafe(local)', address: probe.recoveredAgainstReplaySafe },
    { label: 'recoveredPrefixed(EIP191(userOpHash))', address: probe.recoveredPrefixed },
    { label: 'recoveredAgainstPrefixedReplaySafe', address: probe.recoveredAgainstPrefixedReplaySafe },
  ]
  const onchainOwnerAddresses = ownerSlots
    .filter((slot) => slot.ownerType === 'eoa' && slot.ownerAddress)
    .map((slot) => ({ index: slot.index, address: slot.ownerAddress as Address }))
  const haveOwnerSnapshot =
    probe.parsedOwnerAddressOnchain !== null || onchainOwnerAddresses.length > 0
  if (!haveOwnerSnapshot) {
    return {
      state: 'yellow',
      label: '⚠️ Unknown — could not read on-chain owner snapshot',
      detail:
        'Click "load owner slots" or re-run the probe — this CSW may be non-standard, or the RPC call reverted.',
      matchedOwnerIndex: null,
      matchedHashLabel: null,
    }
  }
  const haveAnyRecovery = candidates.some((c) => c.address !== null)
  if (!haveAnyRecovery) {
    return {
      state: 'yellow',
      label: '⚠️ Unknown — no recoverable signature',
      detail: 'Recovery returned null for every candidate hash (likely a malformed or wrapped signature).',
      matchedOwnerIndex: null,
      matchedHashLabel: null,
    }
  }
  const parsedOwnerLower = probe.parsedOwnerAddressOnchain?.toLowerCase() ?? null
  for (const candidate of candidates) {
    if (!candidate.address) continue
    const lower = candidate.address.toLowerCase()
    if (parsedOwnerLower && lower === parsedOwnerLower) {
      return {
        state: 'green',
        label: `✅ Wallet key matches owner[${probe.parsedOwnerIndex}] (${probe.parsedOwnerAddressOnchain})`,
        detail: `Match path: ${candidate.label}.`,
        matchedOwnerIndex: probe.parsedOwnerIndex,
        matchedHashLabel: candidate.label,
      }
    }
    const ownerHit = onchainOwnerAddresses.find((o) => o.address.toLowerCase() === lower)
    if (ownerHit) {
      return {
        state: 'green',
        label: `✅ Wallet key matches owner[${ownerHit.index}] (${ownerHit.address})`,
        detail: `Match path: ${candidate.label}. Note: parsedOwnerIndex was ${probe.parsedOwnerIndex}; consider re-running with target=${ownerHit.index}.`,
        matchedOwnerIndex: ownerHit.index,
        matchedHashLabel: candidate.label,
      }
    }
  }
  return {
    state: 'red',
    label: '❌ Wallet key does NOT match any on-chain owner',
    detail:
      'All recoveries succeeded but recovered to addresses that are not in the CSW owner array. ' +
      'Base App may be signing with a substituted sub-account key — see the side-by-side block below.',
    matchedOwnerIndex: null,
    matchedHashLabel: null,
  }
}
