import type { Address } from 'viem'
import { base } from 'viem/chains'
import { parseApiEnvelope, resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { logger } from '@/lib/observability/logger'

import { initZoraCoinsSdk } from './init'
import type { ZoraCoin, ZoraExploreList, ZoraExploreListType, ZoraProfile } from './types'

const HEX_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const BURST_CACHE_TTL_MS = 10_000

type CacheEntry<T> = { value: T; expiresAt: number }
type ZoraClientOperation = 'coin' | 'profile' | 'profileCoins' | 'explore'
type ZoraClientCounters = {
  requests: number
  cacheHits: number
  inFlightHits: number
  upstreamCalls: number
  sdkFallbackCalls: number
  successes: number
  errors: number
}

const EMPTY_COUNTERS: ZoraClientCounters = {
  requests: 0,
  cacheHits: 0,
  inFlightHits: 0,
  upstreamCalls: 0,
  sdkFallbackCalls: 0,
  successes: 0,
  errors: 0,
}

const zoraClientTelemetry: Record<ZoraClientOperation, ZoraClientCounters> = {
  coin: { ...EMPTY_COUNTERS },
  profile: { ...EMPTY_COUNTERS },
  profileCoins: { ...EMPTY_COUNTERS },
  explore: { ...EMPTY_COUNTERS },
}
let lastTelemetryLogAtMs = 0

const zoraCoinInFlight = new Map<string, Promise<ZoraCoin | null>>()
const zoraProfileInFlight = new Map<string, Promise<ZoraProfile | null>>()
const zoraProfileCoinsInFlight = new Map<string, Promise<ZoraProfile | null>>()
const zoraExploreInFlight = new Map<string, Promise<ZoraExploreList | null>>()
const zoraCoinCache = new Map<string, CacheEntry<ZoraCoin | null>>()
const zoraProfileCache = new Map<string, CacheEntry<ZoraProfile | null>>()
const zoraProfileCoinsCache = new Map<string, CacheEntry<ZoraProfile | null>>()
const zoraExploreCache = new Map<string, CacheEntry<ZoraExploreList | null>>()

function getWindowObject(): (Window & typeof globalThis) | null {
  return typeof window === 'undefined' ? null : window
}

function getDebugTelemetryFlag(): boolean {
  const w = getWindowObject()
  if (!w) return false
  try {
    return w.localStorage.getItem('cv:debug:zora-client-telemetry') === 'true'
  } catch {
    return false
  }
}

function syncWindowTelemetryDebugHandle(): void {
  const w = getWindowObject()
  if (!w) return
  const win = w as Window & typeof globalThis & {
    __cvZoraClientTelemetry?: {
      getSnapshot: typeof getZoraClientTelemetrySnapshot
      reset: typeof resetZoraClientDebugState
    }
  }

  if (getDebugTelemetryFlag()) {
    if (!win.__cvZoraClientTelemetry) {
      win.__cvZoraClientTelemetry = {
        getSnapshot: getZoraClientTelemetrySnapshot,
        reset: resetZoraClientDebugState,
      }
    }
    return
  }

  if (win.__cvZoraClientTelemetry) delete win.__cvZoraClientTelemetry
}

function countZoraTelemetry(op: ZoraClientOperation, field: keyof ZoraClientCounters): void {
  zoraClientTelemetry[op][field] += 1
}

function telemetryTotalRequests(): number {
  return Object.values(zoraClientTelemetry).reduce((sum, counters) => sum + counters.requests, 0)
}

function shouldLogTelemetry(): boolean {
  const enabled = getDebugTelemetryFlag()
  syncWindowTelemetryDebugHandle()
  return enabled
}

function maybeLogTelemetry(): void {
  if (!shouldLogTelemetry()) return
  const now = Date.now()
  if (now - lastTelemetryLogAtMs < 30_000) return
  const totalRequests = telemetryTotalRequests()
  if (totalRequests === 0 || totalRequests % 25 !== 0) return
  lastTelemetryLogAtMs = now
  logger.warn('[ZoraClient] telemetry', getZoraClientTelemetrySnapshot())
}

function withUpstreamAttempt<T>(op: ZoraClientOperation, fn: () => Promise<T>): Promise<T> {
  countZoraTelemetry(op, 'upstreamCalls')
  maybeLogTelemetry()
  return fn()
}

function withSdkFallback<T>(op: ZoraClientOperation, fn: () => Promise<T>): Promise<T> {
  countZoraTelemetry(op, 'sdkFallbackCalls')
  maybeLogTelemetry()
  return fn()
}

function resetCounters(target: ZoraClientCounters): void {
  target.requests = 0
  target.cacheHits = 0
  target.inFlightHits = 0
  target.upstreamCalls = 0
  target.sdkFallbackCalls = 0
  target.successes = 0
  target.errors = 0
}

export function getZoraClientTelemetrySnapshot(): Record<ZoraClientOperation, ZoraClientCounters> {
  return {
    coin: { ...zoraClientTelemetry.coin },
    profile: { ...zoraClientTelemetry.profile },
    profileCoins: { ...zoraClientTelemetry.profileCoins },
    explore: { ...zoraClientTelemetry.explore },
  }
}

export function resetZoraClientTelemetry(): void {
  resetCounters(zoraClientTelemetry.coin)
  resetCounters(zoraClientTelemetry.profile)
  resetCounters(zoraClientTelemetry.profileCoins)
  resetCounters(zoraClientTelemetry.explore)
  lastTelemetryLogAtMs = 0
}

export function resetZoraClientDebugState(): void {
  resetZoraClientTelemetry()
  zoraCoinInFlight.clear()
  zoraProfileInFlight.clear()
  zoraProfileCoinsInFlight.clear()
  zoraExploreInFlight.clear()
  zoraCoinCache.clear()
  zoraProfileCache.clear()
  zoraProfileCoinsCache.clear()
  zoraExploreCache.clear()
  syncWindowTelemetryDebugHandle()
}

function readFreshCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

async function dedupeAndCache<T>(
  op: ZoraClientOperation,
  key: string,
  inFlight: Map<string, Promise<T>>,
  cache: Map<string, CacheEntry<T>>,
  fn: () => Promise<T>,
): Promise<T> {
  countZoraTelemetry(op, 'requests')
  const cached = readFreshCache(cache, key)
  if (cached !== undefined) {
    countZoraTelemetry(op, 'cacheHits')
    maybeLogTelemetry()
    return cached
  }

  const pending = inFlight.get(key)
  if (pending) {
    countZoraTelemetry(op, 'inFlightHits')
    maybeLogTelemetry()
    return pending
  }

  const task = (async () => {
    try {
      const value = await fn()
      countZoraTelemetry(op, 'successes')
      writeCache(cache, key, value, BURST_CACHE_TTL_MS)
      return value
    } catch (error) {
      countZoraTelemetry(op, 'errors')
      throw error
    } finally {
      maybeLogTelemetry()
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, task)
  return task
}

export function normalizeZoraCoinAddress(address: Address): Address {
  return String(address).trim().toLowerCase() as Address
}

export function normalizeZoraProfileIdentifier(identifier: string): string {
  const trimmed = String(identifier || '').trim()
  if (!trimmed) return ''
  return HEX_ADDRESS_RE.test(trimmed) ? trimmed.toLowerCase() : trimmed
}

function hasPublicKey(): boolean {
  return typeof import.meta.env.VITE_ZORA_PUBLIC_API_KEY === 'string' && import.meta.env.VITE_ZORA_PUBLIC_API_KEY.length > 0
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await parseApiEnvelope<unknown>(res)
    const msg = resolveApiErrorMessage(body, `HTTP ${res.status}`)
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }
  return (await res.json()) as T
}

export async function fetchZoraCoin(address: Address, chainId: number = base.id): Promise<ZoraCoin | null> {
  const normalizedAddress = normalizeZoraCoinAddress(address)
  const key = `${normalizedAddress}:${chainId}`
  return dedupeAndCache('coin', key, zoraCoinInFlight, zoraCoinCache, async () => {
    try {
      const envelope = await withUpstreamAttempt('coin', () =>
        fetchJson<ApiEnvelope<ZoraCoin | null>>(
          `/api/zora/coin?address=${encodeURIComponent(normalizedAddress)}&chain=${encodeURIComponent(String(chainId))}`,
        ),
      )
      return envelope.data ?? null
    } catch (e: any) {
      if (!hasPublicKey()) throw e
    }

    // Fallback (local dev / missing server key): query directly via SDK (public key required).
    const response = await withSdkFallback('coin', async () => {
      await initZoraCoinsSdk()
      const { getCoin } = await import('@zoralabs/coins-sdk')
      return getCoin({ address: normalizedAddress, chain: chainId })
    })
    return (response.data?.zora20Token as any) ?? null
  })
}

export async function fetchZoraProfile(identifier: string): Promise<ZoraProfile | null> {
  const normalizedIdentifier = normalizeZoraProfileIdentifier(identifier)
  return dedupeAndCache('profile', normalizedIdentifier, zoraProfileInFlight, zoraProfileCache, async () => {
    try {
      const envelope = await withUpstreamAttempt('profile', () =>
        fetchJson<ApiEnvelope<ZoraProfile | null>>(
          `/api/zora/profile?identifier=${encodeURIComponent(normalizedIdentifier)}`,
        ),
      )
      return envelope.data ?? null
    } catch (e: any) {
      if (!hasPublicKey()) throw e
    }

    const response = await withSdkFallback('profile', async () => {
      await initZoraCoinsSdk()
      const { getProfile } = await import('@zoralabs/coins-sdk')
      return getProfile({ identifier: normalizedIdentifier })
    })
    return ((response as any)?.data?.profile as ZoraProfile | undefined) ?? null
  })
}

export async function fetchZoraProfileCoins(params: {
  identifier: string
  count?: number
  after?: string
}): Promise<ZoraProfile | null> {
  const identifier = normalizeZoraProfileIdentifier(params.identifier)
  const count = params.count
  const after = params.after
  const key = `${identifier}:${count ?? ''}:${after ?? ''}`

  return dedupeAndCache('profileCoins', key, zoraProfileCoinsInFlight, zoraProfileCoinsCache, async () => {
    try {
      const qs = new URLSearchParams({
        identifier,
        ...(count ? { count: String(count) } : {}),
        ...(after ? { after } : {}),
      })
      const envelope = await withUpstreamAttempt('profileCoins', () =>
        fetchJson<ApiEnvelope<ZoraProfile | null>>(`/api/zora/profileCoins?${qs.toString()}`),
      )
      return envelope.data ?? null
    } catch (e: any) {
      if (!hasPublicKey()) throw e
    }

    const response = await withSdkFallback('profileCoins', async () => {
      await initZoraCoinsSdk()
      const { getProfileCoins } = await import('@zoralabs/coins-sdk')
      return getProfileCoins({
        identifier,
        count,
        after,
        chainIds: [base.id],
      })
    })
    return ((response as any)?.data?.profile as ZoraProfile | undefined) ?? null
  })
}

export async function fetchZoraExplore(params: {
  list: ZoraExploreListType
  count?: number
  after?: string
  sort?: 'ETHOS_SCORE'
  ethosMin?: number
}): Promise<ZoraExploreList | null> {
  const { list, count, after, sort, ethosMin } = params
  const key = `${list}:${count ?? ''}:${after ?? ''}:${sort ?? ''}:${ethosMin ?? ''}`

  return dedupeAndCache('explore', key, zoraExploreInFlight, zoraExploreCache, async () => {
    try {
      const qs = new URLSearchParams({
        list,
        ...(count ? { count: String(count) } : {}),
        ...(after ? { after } : {}),
        ...(sort ? { sort } : {}),
        ...(typeof ethosMin === 'number' && Number.isFinite(ethosMin) ? { ethosMin: String(ethosMin) } : {}),
      })

      const envelope = await withUpstreamAttempt('explore', () =>
        fetchJson<ApiEnvelope<ZoraExploreList | null>>(`/api/zora/explore?${qs.toString()}`),
      )
      return envelope.data ?? null
    } catch (e: any) {
      if (!hasPublicKey()) throw e
    }

    const response = await withSdkFallback('explore', async () => {
      await initZoraCoinsSdk()
      const sdk = await import('@zoralabs/coins-sdk')

      const options = { count, after }

      // Map list type to SDK function
      const sdkFunctions: Record<ZoraExploreListType, () => Promise<any>> = {
        'TOP_GAINERS': () => sdk.getCoinsTopGainers(options),
        'TOP_VOLUME_24H': () => sdk.getCoinsTopVolume24h(options),
        'MOST_VALUABLE': () => sdk.getCoinsMostValuable(options),
        'NEW': () => sdk.getCoinsNew(options),
        'LAST_TRADED': () => sdk.getCoinsLastTraded(options),
        'LAST_TRADED_UNIQUE': () => sdk.getCoinsLastTradedUnique(options),
        // Trend-specific
        'MOST_VALUABLE_TRENDS': () => sdk.getMostValuableTrends(options),
        'NEW_TRENDS': () => sdk.getNewTrends(options),
        'TOP_VOLUME_TRENDS_24H': () => sdk.getTopVolumeTrends24h(options),
        'TRENDING_TRENDS': () => sdk.getTrendingTrends(options),
        // Creator-specific (these return creator coins, not profiles)
        'NEW_CREATORS': () => sdk.getCreatorCoins(options),
        'MOST_VALUABLE_CREATORS': () => sdk.getMostValuableCreatorCoins(options),
        'TOP_VOLUME_CREATORS_24H': () => sdk.getExploreTopVolumeCreators24h(options),
        'FEATURED_CREATORS': () => sdk.getExploreFeaturedCreators(options),
        'TRENDING_CREATORS': () => sdk.getTrendingCreators(options),
        // Content-specific
        'FEATURED_VIDEOS': () => sdk.getExploreFeaturedVideos(options),
        'TRENDING_POSTS': () => sdk.getTrendingPosts(options),
        // Combined
        'TRENDING_ALL': () => sdk.getTrendingAll(options),
        'TOP_VOLUME_ALL_24H': () => sdk.getExploreTopVolumeAll24h(options),
        'NEW_ALL': () => sdk.getExploreNewAll(options),
        'MOST_VALUABLE_ALL': () => sdk.getMostValuableAll(options),
      }

      const fn = sdkFunctions[list] || (() => sdk.getCoinsLastTradedUnique(options))
      return fn()
    })

    // Handle different response structures
    const data = response.data
    return (data?.exploreList ?? data?.creatorCoins ?? data?.coins) as ZoraExploreList | null
  })
}

export async function fetchZoraTopCreators(params?: { count?: number; after?: string }): Promise<ZoraExploreList | null> {
  const count = params?.count
  const after = params?.after

  const qs = new URLSearchParams({
    ...(count ? { count: String(count) } : {}),
    ...(after ? { after } : {}),
  })

  const url = qs.toString() ? `/api/zora/topCreators?${qs.toString()}` : '/api/zora/topCreators'
  try {
    const envelope = await fetchJson<ApiEnvelope<ZoraExploreList | null>>(url)
    return envelope.data ?? null
  } catch {
    return null
  }
}
