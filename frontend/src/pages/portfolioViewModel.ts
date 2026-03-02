import type { Address } from 'viem'

export function isEvmAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function normalizeAddress(value: string | null | undefined): Address | null {
  const next = typeof value === 'string' ? value.trim() : ''
  if (!isEvmAddress(next)) return null
  return next.toLowerCase() as Address
}

export function resolvePortfolioAddresses(input: {
  routeAddress: string | null | undefined
  wagmiAddress: string | null | undefined
  siweAuthAddress: string | null | undefined
}): {
  publicAddress: Address | null
  effectiveAddress: Address | null
  isPublicMode: boolean
} {
  const publicAddress = normalizeAddress(input.routeAddress)
  if (publicAddress) {
    return { publicAddress, effectiveAddress: publicAddress, isPublicMode: true }
  }

  const effectiveAddress = normalizeAddress(input.wagmiAddress) ?? normalizeAddress(input.siweAuthAddress)
  return { publicAddress: null, effectiveAddress, isPublicMode: false }
}

export function deriveCreatorCoinOptions(addresses: string[]): Address[] {
  const normalized = addresses.map((value) => normalizeAddress(value)).filter((value): value is Address => Boolean(value))
  return Array.from(new Set(normalized))
}
