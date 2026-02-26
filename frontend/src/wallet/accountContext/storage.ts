import type { AccountModePreference } from './types'

const MODE_STORAGE_KEY_PREFIX = 'cv.account.preferred_mode.v1'

function buildModeStorageKey(params: { signerAddress?: `0x${string}`; chainId: number | null }): string | null {
  if (!params.signerAddress || typeof params.chainId !== 'number') return null
  return `${MODE_STORAGE_KEY_PREFIX}:${params.chainId}:${params.signerAddress.toLowerCase()}`
}

export function readPreferredAccountMode(params: {
  signerAddress?: `0x${string}`
  chainId: number | null
}): AccountModePreference | null {
  if (typeof window === 'undefined') return null
  const key = buildModeStorageKey(params)
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw === 'SMART_WALLET' || raw === 'EOA' ? raw : null
  } catch {
    return null
  }
}

export function writePreferredAccountMode(
  params: {
    signerAddress?: `0x${string}`
    chainId: number | null
  },
  mode: AccountModePreference,
): void {
  if (typeof window === 'undefined') return
  const key = buildModeStorageKey(params)
  if (!key) return
  try {
    window.localStorage.setItem(key, mode)
  } catch {
    // no-op (webviews/private mode)
  }
}

