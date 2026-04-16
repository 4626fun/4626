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

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (!Number.isFinite(n) || n < 0 || n > 255) return null
    out.push(n)
  }
  return out
}

function isForbiddenHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '0.0.0.0') return true
  if (host === '::1' || host === '::') return true

  const ipv4 = parseIpv4(host)
  if (!ipv4) return false
  const [a, b] = ipv4
  if (a === undefined || b === undefined) return false
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

export function buildPortfolioImageProxyUrl(rawUrl: string | null | undefined): string | null {
  const value = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!value) return null
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (isForbiddenHost(parsed.hostname)) return null
  return `/api/image/external?url=${encodeURIComponent(parsed.toString())}`
}
