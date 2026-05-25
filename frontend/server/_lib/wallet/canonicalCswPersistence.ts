import {
  TARGET_CANONICAL_CSW_ADDRESS,
  isAllowedOwnerEoa,
  resolvePolicyCanonicalAddress,
} from '../../../src/wallet/canonicalWalletPolicy.js'
import type { ClassifiedLinkedAccounts } from './walletMapping.js'

function normalizeAddress(value: unknown): string | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

/**
 * Normalize what we persist in `profiles.csw_address`.
 *
 * Allowed-owner EOAs (for example `0x6c0ea…`, slot 0 of the project CSW) must
 * never be stored as the CSW itself. When the profile signer is an allowed
 * owner, map to `TARGET_CANONICAL_CSW_ADDRESS` instead.
 */
export function resolveStoredCanonicalCswAddress(params: {
  candidate: string | null | undefined
  embeddedEoa?: string | null | undefined
  activeOwnerEoa?: string | null | undefined
}): string | null {
  const signer = normalizeAddress(params.embeddedEoa) ?? normalizeAddress(params.activeOwnerEoa)
  const policyCanonical = resolvePolicyCanonicalAddress({
    canonicalAddress: params.candidate ?? null,
    signerAddress: signer,
  })
  if (policyCanonical === TARGET_CANONICAL_CSW_ADDRESS) {
    return TARGET_CANONICAL_CSW_ADDRESS
  }

  const candidate = normalizeAddress(params.candidate)
  if (!candidate) return null
  if (isAllowedOwnerEoa(candidate)) return null
  return candidate
}

export function applyCanonicalCswPolicyToClassification(
  classification: ClassifiedLinkedAccounts,
): ClassifiedLinkedAccounts {
  const resolved = resolveStoredCanonicalCswAddress({
    candidate: classification.canonicalSmartWallet?.address ?? null,
    embeddedEoa: classification.embeddedEoa?.address ?? null,
    activeOwnerEoa: classification.activeOwnerWallet?.address ?? null,
  })
  const current = normalizeAddress(classification.canonicalSmartWallet?.address)
  if (resolved === current) return classification
  if (!resolved) {
    return { ...classification, canonicalSmartWallet: null }
  }
  return {
    ...classification,
    canonicalSmartWallet: {
      address: resolved,
      provider: classification.canonicalSmartWallet?.provider ?? 'unknown',
    },
  }
}
