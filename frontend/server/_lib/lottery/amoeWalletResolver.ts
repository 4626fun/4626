import { resolveAuthorizedWalletProfile } from '../wallet/canonicalWalletResolver.js'

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(normalized) ? (normalized as `0x${string}`) : null
}

export type ResolvedAmoeWallet = {
  wallet: `0x${string}`
  profileId: number | null
  canonicalSmartWalletAddress: `0x${string}` | null
  activeOwnerWalletAddress: `0x${string}` | null
}

export type ResolveAmoeWalletResult =
  | { ok: true; value: ResolvedAmoeWallet }
  | { ok: false; error: 'invalid_wallet' | 'wallet_authority_mismatch' }

export async function resolveAmoeWallet(params: {
  requestedWallet?: string | null
  authAddress?: string | null
}): Promise<ResolveAmoeWalletResult> {
  const requestedWallet = normalizeAddress(params.requestedWallet)
  const authAddress = normalizeAddress(params.authAddress)

  if (params.requestedWallet && !requestedWallet) {
    return { ok: false, error: 'invalid_wallet' }
  }
  if (params.authAddress && !authAddress) {
    return { ok: false, error: 'invalid_wallet' }
  }

  if (authAddress) {
    const authAuthority = await resolveAuthorizedWalletProfile(authAddress)
    if (authAuthority) {
      const canonicalSmartWalletAddress = normalizeAddress(authAuthority.canonicalSmartWalletAddress)
      const activeOwnerWalletAddress = normalizeAddress(authAuthority.activeOwnerWalletAddress)
      const allowedWallets = new Set(
        [authAddress, canonicalSmartWalletAddress, activeOwnerWalletAddress].filter(Boolean) as string[],
      )
      if (requestedWallet && !allowedWallets.has(requestedWallet)) {
        return { ok: false, error: 'wallet_authority_mismatch' }
      }

      return {
        ok: true,
        value: {
          wallet: canonicalSmartWalletAddress ?? requestedWallet ?? authAddress,
          profileId: authAuthority.profileId,
          canonicalSmartWalletAddress,
          activeOwnerWalletAddress,
        },
      }
    }
  }

  const targetWallet = requestedWallet ?? authAddress
  if (!targetWallet) return { ok: false, error: 'invalid_wallet' }

  const authority = await resolveAuthorizedWalletProfile(targetWallet)
  const canonicalSmartWalletAddress = normalizeAddress(authority?.canonicalSmartWalletAddress)
  const activeOwnerWalletAddress = normalizeAddress(authority?.activeOwnerWalletAddress)

  return {
    ok: true,
    value: {
      wallet: canonicalSmartWalletAddress ?? targetWallet,
      profileId: authority?.profileId ?? null,
      canonicalSmartWalletAddress,
      activeOwnerWalletAddress,
    },
  }
}
