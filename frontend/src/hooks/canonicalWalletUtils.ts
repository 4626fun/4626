import { getAddress } from 'viem'

export type WaitlistMeData = {
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  connectedAccounts?: Array<{
    address?: string | null
    walletType?: string | null
    provider?: string | null
    verifiedAt?: string | null
    isCanonicalSmartWallet?: boolean
    isExecutionSubAccount?: boolean
  }>
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

export function pickCanonicalSmartWalletAddress(row: WaitlistMeData | null | undefined): string | null {
  if (!row) return null

  const canonicalFromAccounts = (row.connectedAccounts ?? [])
    .filter((item) => item?.isCanonicalSmartWallet && isAddressLike(item?.address))
    .sort((a, b) => {
      const aProvider = String(a.provider ?? '').toLowerCase()
      const bProvider = String(b.provider ?? '').toLowerCase()
      if (aProvider.includes('privy') !== bProvider.includes('privy')) {
        return aProvider.includes('privy') ? 1 : -1
      }
      const aMs = Date.parse(String(a.verifiedAt ?? ''))
      const bMs = Date.parse(String(b.verifiedAt ?? ''))
      if (Number.isFinite(aMs) && Number.isFinite(bMs)) return bMs - aMs
      if (Number.isFinite(aMs)) return -1
      if (Number.isFinite(bMs)) return 1
      return String(a.address ?? '').localeCompare(String(b.address ?? ''))
    })[0]

  const candidates: Array<string | null | undefined> = [
    canonicalFromAccounts?.address,
    row.cswAddress,
    row.primarySmartWallet,
  ]
  for (const value of candidates) {
    if (!isAddressLike(value)) continue
    return getAddress(value).toLowerCase()
  }
  return null
}
