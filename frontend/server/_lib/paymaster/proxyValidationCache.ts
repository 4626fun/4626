import type { Address, Hex } from 'viem'

/** Shared TTL for paymaster proxy validation caches (swap, ownership, allowlist). */
export const PAYMASTER_PROXY_VALIDATION_CACHE_MS = 45_000

type TimedEntry = { at: number }

type SponsoredSwapValidationCacheEntry = TimedEntry & {
  mode: string
  expectedCreatorToken: Address | null
}

const sponsoredSwapValidationCache = new Map<string, SponsoredSwapValidationCacheEntry>()
const sessionOwnershipCache = new Map<string, TimedEntry>()
const sessionAllowlistCache = new Map<string, TimedEntry>()

function isFresh(entry: TimedEntry | undefined, ttlMs: number): entry is TimedEntry {
  if (!entry) return false
  if (Date.now() - entry.at > ttlMs) return false
  return true
}

function pruneExpired<T extends TimedEntry>(cache: Map<string, T>, ttlMs: number): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now - entry.at > ttlMs) cache.delete(key)
  }
}

setInterval(() => {
  pruneExpired(sponsoredSwapValidationCache, PAYMASTER_PROXY_VALIDATION_CACHE_MS)
  pruneExpired(sessionOwnershipCache, PAYMASTER_PROXY_VALIDATION_CACHE_MS)
  pruneExpired(sessionAllowlistCache, PAYMASTER_PROXY_VALIDATION_CACHE_MS)
}, 5 * 60_000)

export function sponsoredSwapValidationCacheKey(sender: Address, callData: Hex): string {
  return `${sender.toLowerCase()}:${callData.toLowerCase()}`
}

export function readSponsoredSwapValidationCache(
  sender: Address,
  callData: Hex,
): SponsoredSwapValidationCacheEntry | null {
  const key = sponsoredSwapValidationCacheKey(sender, callData)
  const cached = sponsoredSwapValidationCache.get(key)
  if (!isFresh(cached, PAYMASTER_PROXY_VALIDATION_CACHE_MS)) {
    if (cached) sponsoredSwapValidationCache.delete(key)
    return null
  }
  return cached
}

export function writeSponsoredSwapValidationCache(
  sender: Address,
  callData: Hex,
  validated: { mode: string; expectedCreatorToken?: Address | null },
): void {
  if (validated.mode !== 'swap') return
  sponsoredSwapValidationCache.set(sponsoredSwapValidationCacheKey(sender, callData), {
    at: Date.now(),
    mode: validated.mode,
    expectedCreatorToken: validated.expectedCreatorToken ?? null,
  })
}

export function sessionOwnershipCacheKey(params: {
  sender: Address
  sessionAddress: Address
  initCode: Hex | null
}): string {
  const initMarker =
    params.initCode && params.initCode !== '0x'
      ? params.initCode.toLowerCase().slice(0, 130)
      : 'deployed'
  return `${params.sender.toLowerCase()}:${params.sessionAddress.toLowerCase()}:${initMarker}`
}

export function readSessionOwnershipCache(key: string): boolean {
  return isFresh(sessionOwnershipCache.get(key), PAYMASTER_PROXY_VALIDATION_CACHE_MS)
}

export function writeSessionOwnershipCache(key: string): void {
  sessionOwnershipCache.set(key, { at: Date.now() })
}

export function sessionAllowlistCacheKey(sessionAddress: Address, creatorToken: Address | null | undefined): string {
  const token = creatorToken ? creatorToken.toLowerCase() : 'none'
  return `${sessionAddress.toLowerCase()}:${token}`
}

export function readSessionAllowlistCache(key: string): boolean {
  return isFresh(sessionAllowlistCache.get(key), PAYMASTER_PROXY_VALIDATION_CACHE_MS)
}

export function writeSessionAllowlistCache(key: string): void {
  sessionAllowlistCache.set(key, { at: Date.now() })
}

/** Test-only: clears in-memory caches between vitest cases. */
export function clearProxyValidationCachesForTests(): void {
  sponsoredSwapValidationCache.clear()
  sessionOwnershipCache.clear()
  sessionAllowlistCache.clear()
}
