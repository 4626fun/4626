import { getAddress, isAddress, type Address } from 'viem'

import { resolvePolicyCanonicalAddress } from '@/wallet/canonicalWalletPolicy'

export function normalizeSwapAddress(value: string | null | undefined): Address | null {
  if (!value || !isAddress(value)) return null
  return getAddress(value)
}

/** Asset-holding wallet for swap balance reads — always parent CSW when known. */
export function resolveSwapBalanceOwner(params: {
  accountMeCanonicalCsw?: string | null
  accountContextCsw?: string | null
  privyEmbeddedEoa?: string | null
  connectedExternalEoa?: string | null
  executionAddress?: string | null
}): Address | null {
  const fromAccountMe = normalizeSwapAddress(params.accountMeCanonicalCsw)
  const fromContext = normalizeSwapAddress(params.accountContextCsw)
  const policyResolved = resolvePolicyCanonicalAddress({
    canonicalAddress: fromAccountMe ?? fromContext,
    signerAddress: params.privyEmbeddedEoa ?? params.connectedExternalEoa,
  })
  if (policyResolved) return policyResolved as Address
  return normalizeSwapAddress(fromAccountMe ?? fromContext ?? params.executionAddress)
}
