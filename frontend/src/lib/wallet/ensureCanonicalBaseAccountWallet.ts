import { getAddress } from 'viem'

import { isBaseAccountWallet } from '@/lib/swap/useSwapSubAccountRuntime'

export function normalizeWalletAddress(value: unknown): string | null {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null
  try {
    return getAddress(value).toLowerCase()
  } catch {
    return null
  }
}

export function findBaseAccountWalletInList(wallets: unknown[]): Record<string, unknown> | null {
  for (const wallet of wallets) {
    if (isBaseAccountWallet(wallet)) return wallet as Record<string, unknown>
  }
  return null
}

export function isCanonicalBaseAccountWalletReady(params: {
  wallets: unknown[]
  canonicalCswAddress: string | null | undefined
  providerAccounts?: string[] | null
}): boolean {
  const expected = normalizeWalletAddress(params.canonicalCswAddress)
  if (!expected) return false

  for (const account of params.providerAccounts ?? []) {
    if (normalizeWalletAddress(account) === expected) return true
  }

  const baseWallet = findBaseAccountWalletInList(params.wallets)
  return normalizeWalletAddress(baseWallet?.address) === expected
}

export async function readBaseAccountProviderAccounts(
  baseAccountSdk: unknown,
): Promise<string[]> {
  const sdk = baseAccountSdk as
    | { getProvider?: () => { request?: (args: { method: string }) => Promise<unknown> } }
    | null
    | undefined
  const provider = sdk?.getProvider?.()
  if (!provider?.request) return []

  try {
    const raw = await provider.request({ method: 'eth_requestAccounts' })
    if (!Array.isArray(raw)) return []
    return raw.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}
