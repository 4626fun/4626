// Basenames integration using OnchainKit
// Docs: https://docs.base.org/base-account/basenames/basenames-onchainkit-tutorial

import { createPublicClient, fallback, getAddress, http, isAddress, toCoinType } from 'viem'
import { base, baseSepolia, mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { trackEvent } from './analytics'
import { apiFetch } from './apiBase'
import { logger } from './logger'

export interface BasenameInfo {
  name: string | null // e.g., "akita.base.eth"
  avatar?: string | null
  displayName?: string | null
  description?: string | null
  twitter?: string | null
  github?: string | null
  discord?: string | null
  email?: string | null
  url?: string | null
}

const IS_BROWSER = typeof window !== 'undefined'
const ENS_GATEWAY_URLS = ['https://ccip.ens.xyz'] as const
const BASENAME_CACHE_TTL_SUCCESS_MS = 5 * 60_000
const BASENAME_CACHE_TTL_MISS_MS = 60_000
const BASENAME_TELEMETRY_BATCH_SIZE = 20
const BASENAME_TELEMETRY_FLUSH_INTERVAL_MS = 60_000
const BASENAME_TELEMETRY_SAMPLE_RATE = 0.2
const BASENAME_TELEMETRY_SLOW_MS = 1_500

type BasenameLookupKind =
  | 'get_basename'
  | 'resolve_basename_address'
  | 'get_basename_profile'
  | 'get_basename_profile_by_name'

type BasenameLookupStatus = 'hit' | 'miss' | 'error' | 'timeout'

type BasenameLookupSample = {
  kind: BasenameLookupKind
  status: BasenameLookupStatus
  durationMs: number
}

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const basenameByAddressCache = new Map<string, CacheEntry<string | null>>()
const basenameAddressByInputCache = new Map<string, CacheEntry<string | null>>()
const basenameProfileByAddressCache = new Map<string, CacheEntry<BasenameInfo>>()
const basenameProfileByNameCache = new Map<string, CacheEntry<BasenameInfo>>()
const pendingBasenameByAddress = new Map<string, Promise<string | null>>()
const pendingBasenameAddressByInput = new Map<string, Promise<string | null>>()
const pendingBasenameProfileByAddress = new Map<string, Promise<BasenameInfo>>()
const pendingBasenameProfileByName = new Map<string, Promise<BasenameInfo>>()
const basenameLookupSamples: BasenameLookupSample[] = []
let basenameTelemetryLastFlushAt = 0

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number = BASENAME_CACHE_TTL_SUCCESS_MS): T {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
  return value
}

function cacheAddressKey(address: string, chainId: number): string {
  return `${address.trim().toLowerCase()}:${chainId}`
}

function cacheInputKey(input: string, chainId: number): string {
  return `${input.trim().toLowerCase()}:${chainId}`
}

function cacheBasenameKey(input: string): string {
  return input.trim().toLowerCase()
}

function cloneBasenameInfo(value: BasenameInfo): BasenameInfo {
  return { ...value }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.toLowerCase()
  return String(error ?? '').toLowerCase()
}

function isBasenameDebugLoggingEnabled(): boolean {
  if (import.meta.env.VITE_DEBUG_BASENAME_LOOKUPS === 'true') return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug:basename') === 'true'
  } catch {
    return false
  }
}

function isBasenameTelemetryEnabled(): boolean {
  if (!IS_BROWSER) return false
  if (import.meta.env.VITE_BASENAME_LOOKUP_TELEMETRY === 'true') return true
  if (import.meta.env.PROD) return true
  try {
    return window.localStorage.getItem('cv:debug:basename-telemetry') === 'true'
  } catch {
    return false
  }
}

function isTimeoutBasenameError(error: unknown): boolean {
  const msg = errorMessage(error)
  if (!msg) return false
  return (
    msg.includes('timed out') ||
    msg.includes('request took too long') ||
    msg.includes('timeout') ||
    msg.includes('aborterror')
  )
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  const index = Math.max(0, Math.min(sorted.length - 1, rank - 1))
  return sorted[index] ?? null
}

function flushBasenameLookupTelemetry(reason: 'batch' | 'interval' | 'timeout'): void {
  if (!IS_BROWSER) return
  if (basenameLookupSamples.length === 0) return

  const samples = basenameLookupSamples.splice(0, basenameLookupSamples.length)
  basenameTelemetryLastFlushAt = Date.now()

  const kindStats: Record<
    BasenameLookupKind,
    { count: number; timeoutCount: number; errorCount: number; missCount: number; durations: number[] }
  > = {
    get_basename: { count: 0, timeoutCount: 0, errorCount: 0, missCount: 0, durations: [] },
    resolve_basename_address: { count: 0, timeoutCount: 0, errorCount: 0, missCount: 0, durations: [] },
    get_basename_profile: { count: 0, timeoutCount: 0, errorCount: 0, missCount: 0, durations: [] },
    get_basename_profile_by_name: { count: 0, timeoutCount: 0, errorCount: 0, missCount: 0, durations: [] },
  }

  let timeoutCount = 0
  let errorCount = 0
  let missCount = 0
  const durations: number[] = []

  for (const sample of samples) {
    durations.push(sample.durationMs)
    const stats = kindStats[sample.kind]
    stats.count += 1
    stats.durations.push(sample.durationMs)

    if (sample.status === 'timeout') {
      timeoutCount += 1
      stats.timeoutCount += 1
    } else if (sample.status === 'error') {
      errorCount += 1
      stats.errorCount += 1
    } else if (sample.status === 'miss') {
      missCount += 1
      stats.missCount += 1
    }
  }

  const payload = {
    reason,
    source: 'basename-api',
    sampleCount: samples.length,
    timeoutCount,
    errorCount,
    missCount,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    kinds: Object.fromEntries(
      (Object.keys(kindStats) as BasenameLookupKind[]).map((kind) => [
        kind,
        {
          count: kindStats[kind].count,
          timeoutCount: kindStats[kind].timeoutCount,
          errorCount: kindStats[kind].errorCount,
          missCount: kindStats[kind].missCount,
          p95Ms: percentile(kindStats[kind].durations, 95),
        },
      ]),
    ),
  }

  trackEvent('xmtp_basename_lookup_batch', payload)
  void apiFetch('/api/v1/chat/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'xmtp_basename_lookup_batch',
      ...payload,
    }),
  }).catch(() => undefined)

  if (isBasenameDebugLoggingEnabled()) {
    logger.debug('[Basename] Telemetry batch', payload)
  }
}

function recordBasenameLookupTelemetry(kind: BasenameLookupKind, status: BasenameLookupStatus, durationMs: number): void {
  if (!isBasenameTelemetryEnabled()) return
  const roundedDuration = Math.max(0, Math.round(durationMs))

  const sample: BasenameLookupSample = { kind, status, durationMs: roundedDuration }
  const isInterestingSample = status === 'timeout' || roundedDuration >= BASENAME_TELEMETRY_SLOW_MS
  const shouldSample = isInterestingSample || Math.random() < BASENAME_TELEMETRY_SAMPLE_RATE
  if (!shouldSample) return

  basenameLookupSamples.push(sample)
  const now = Date.now()
  const shouldFlushByInterval =
    basenameTelemetryLastFlushAt > 0 && now - basenameTelemetryLastFlushAt >= BASENAME_TELEMETRY_FLUSH_INTERVAL_MS
  if (status === 'timeout') {
    flushBasenameLookupTelemetry('timeout')
    return
  }
  if (basenameLookupSamples.length >= BASENAME_TELEMETRY_BATCH_SIZE) {
    flushBasenameLookupTelemetry('batch')
    return
  }
  if (shouldFlushByInterval) {
    flushBasenameLookupTelemetry('interval')
  }
}

export function isExpectedBasenameLookupError(error: unknown): boolean {
  const msg = errorMessage(error)
  if (!msg) return false
  if (msg.includes('reversewithgateways')) return true
  if (msg.includes('0x0d1947a9')) return true
  if (msg.includes('offchainlookup') || msg.includes('offchain lookup')) return true
  if (msg.includes('coinbase.com') && msg.includes('cors')) return true
  if (msg.includes('api/v1/domain/resolver/resolvedomain') && msg.includes('blocked by cors policy')) return true
  if (
    (msg.includes('failed to fetch') || msg.includes('network error') || msg.includes('networkerror')) &&
    (msg.includes('ccip') || msg.includes('gateway') || msg.includes('ens') || msg.includes('basename'))
  ) {
    return true
  }
  if (
    (msg.includes('timed out') || msg.includes('request took too long') || msg.includes('timeout')) &&
    (msg.includes('ccip') || msg.includes('gateway') || msg.includes('ens') || msg.includes('basename') || msg.includes('/api/rpc'))
  ) {
    return true
  }
  return false
}

function logBasenameLookupError(message: string, error: unknown): void {
  if (isExpectedBasenameLookupError(error)) {
    if (!isBasenameDebugLoggingEnabled()) return
    logger.debug(`${message} (expected miss): ${errorMessage(error)}`)
    return
  }
  logger.error(message, error)
}

function createMainnetReadClient() {
  const buildReadTransport = (url: string) => {
    if (url.startsWith('/api/rpc')) {
      // Same-origin RPC proxy already retries upstream; avoid multiplying retries in the client.
      return http(url, {
        retryCount: 0,
        retryDelay: 150,
      })
    }
    return http(url)
  }
  // Avoid viem's default public endpoint selection in browsers (can pick
  // providers without permissive CORS, e.g. eth.merkle.io).
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      (IS_BROWSER
        ? ['/api/rpc?chain=mainnet']
        : ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth', 'https://eth.llamarpc.com']).map((url) =>
        buildReadTransport(url),
      ),
    ),
  })
}

/**
 * Get Basename for an address
 */
export async function getBasename(
  address: string,
  chainId: number = base.id
): Promise<string | null> {
  const key = cacheAddressKey(address, chainId)
  const cached = readCache(basenameByAddressCache, key)
  if (cached !== undefined) return cached

  const pending = pendingBasenameByAddress.get(key)
  if (pending) return pending

  const request = (async () => {
    const startedAt = Date.now()
    try {
      // Basenames are resolved via ENSIP-19 reverse resolution on Ethereum mainnet,
      // using Base chain coinType + CCIP gateways.
      //
      // This works in browsers without requiring Base L2 ENS universal resolver config.
      const client = createMainnetReadClient()

      const name = await client.getEnsName({
        address: address as `0x${string}`,
        coinType: toCoinType(chainId === baseSepolia.id ? baseSepolia.id : base.id),
        gatewayUrls: [...ENS_GATEWAY_URLS],
      })

      if (!name) {
        const cached = writeCache(basenameByAddressCache, key, null, BASENAME_CACHE_TTL_MISS_MS)
        recordBasenameLookupTelemetry('get_basename', 'miss', Date.now() - startedAt)
        return cached
      }
      // Guardrail: ENSIP-19 can resolve non-Basenames depending on user config.
      // For 4626 identity UI, only treat *.base.eth as a Basename.
      if (!name.toLowerCase().endsWith('.base.eth')) {
        const cached = writeCache(basenameByAddressCache, key, null, BASENAME_CACHE_TTL_MISS_MS)
        recordBasenameLookupTelemetry('get_basename', 'miss', Date.now() - startedAt)
        return cached
      }
      const cached = writeCache(basenameByAddressCache, key, name)
      recordBasenameLookupTelemetry('get_basename', 'hit', Date.now() - startedAt)
      return cached
    } catch (error) {
      logBasenameLookupError('Failed to fetch Basename', error)
      writeCache(basenameByAddressCache, key, null, BASENAME_CACHE_TTL_MISS_MS)
      recordBasenameLookupTelemetry(
        'get_basename',
        isTimeoutBasenameError(error) ? 'timeout' : 'error',
        Date.now() - startedAt,
      )
      return null
    }
  })()
  pendingBasenameByAddress.set(key, request)
  request.finally(() => pendingBasenameByAddress.delete(key))
  return request
}

function normalizeBasenameInput(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const withoutAt = raw.startsWith('@') ? raw.slice(1).trim() : raw
  if (!withoutAt) return null
  if (withoutAt.endsWith('.base.eth')) return withoutAt
  if (withoutAt.includes('.')) return null
  if (!/^[a-z0-9-]{1,255}$/.test(withoutAt)) return null
  return `${withoutAt}.base.eth`
}

/**
 * Resolve a Basename handle (or full basename) to an EVM address.
 * Accepts:
 * - "akita"
 * - "@akita"
 * - "akita.base.eth"
 * - "0x..." (passes through normalized checksum)
 */
export async function resolveBasenameAddress(
  input: string,
  chainId: number = base.id,
): Promise<string | null> {
  const inputKey = cacheInputKey(input, chainId)
  const cached = readCache(basenameAddressByInputCache, inputKey)
  if (cached !== undefined) return cached

  const pending = pendingBasenameAddressByInput.get(inputKey)
  if (pending) return pending

  const request = (async () => {
    const startedAt = Date.now()
    try {
      const raw = input.trim()
      if (!raw) return null
      if (isAddress(raw)) return getAddress(raw)

      const basename = normalizeBasenameInput(raw)
      if (!basename) return writeCache(basenameAddressByInputCache, inputKey, null, BASENAME_CACHE_TTL_MISS_MS)

      const client = createMainnetReadClient()
      const resolved = await client.getEnsAddress({
        name: normalize(basename),
        coinType: toCoinType(chainId === baseSepolia.id ? baseSepolia.id : base.id),
        gatewayUrls: [...ENS_GATEWAY_URLS],
      })
      if (!resolved) {
        const cached = writeCache(basenameAddressByInputCache, inputKey, null, BASENAME_CACHE_TTL_MISS_MS)
        recordBasenameLookupTelemetry('resolve_basename_address', 'miss', Date.now() - startedAt)
        return cached
      }
      const cached = writeCache(basenameAddressByInputCache, inputKey, getAddress(resolved))
      recordBasenameLookupTelemetry('resolve_basename_address', 'hit', Date.now() - startedAt)
      return cached
    } catch (error) {
      logBasenameLookupError('Failed to resolve Basename address', error)
      writeCache(basenameAddressByInputCache, inputKey, null, BASENAME_CACHE_TTL_MISS_MS)
      recordBasenameLookupTelemetry(
        'resolve_basename_address',
        isTimeoutBasenameError(error) ? 'timeout' : 'error',
        Date.now() - startedAt,
      )
      return null
    }
  })()
  pendingBasenameAddressByInput.set(inputKey, request)
  request.finally(() => pendingBasenameAddressByInput.delete(inputKey))
  return request
}

/**
 * Get Basename with full profile info
 */
export async function getBasenameProfile(
  address: string,
  chainId: number = base.id
): Promise<BasenameInfo> {
  const key = cacheAddressKey(address, chainId)
  const cached = readCache(basenameProfileByAddressCache, key)
  if (cached !== undefined) return cloneBasenameInfo(cached)

  const pending = pendingBasenameProfileByAddress.get(key)
  if (pending) return pending.then(cloneBasenameInfo)

  const request = (async () => {
    const startedAt = Date.now()
    try {
      const name = await getBasename(address, chainId)

      if (!name) {
        const result = cloneBasenameInfo(
          writeCache(basenameProfileByAddressCache, key, { name: null }, BASENAME_CACHE_TTL_MISS_MS),
        )
        recordBasenameLookupTelemetry('get_basename_profile', 'miss', Date.now() - startedAt)
        return result
      }

      const client = createMainnetReadClient()
      const normalizedName = normalize(name)

      // Fetch ENS text records in parallel
      const [avatar, displayName, description, twitter, github, discord, email, url] =
        await Promise.all([
          client.getEnsAvatar({ name: normalizedName, gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'name', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'description', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'com.twitter', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'com.github', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'com.discord', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'email', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'url', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
        ])

      const profile: BasenameInfo = {
        name,
        avatar,
        displayName,
        description,
        twitter,
        github,
        discord,
        email,
        url,
      }
      const result = cloneBasenameInfo(writeCache(basenameProfileByAddressCache, key, profile))
      recordBasenameLookupTelemetry('get_basename_profile', 'hit', Date.now() - startedAt)
      return result
    } catch (error) {
      logBasenameLookupError('Failed to fetch Basename profile', error)
      const result = cloneBasenameInfo(
        writeCache(basenameProfileByAddressCache, key, { name: null }, BASENAME_CACHE_TTL_MISS_MS),
      )
      recordBasenameLookupTelemetry(
        'get_basename_profile',
        isTimeoutBasenameError(error) ? 'timeout' : 'error',
        Date.now() - startedAt,
      )
      return result
    }
  })()
  pendingBasenameProfileByAddress.set(key, request)
  request.finally(() => pendingBasenameProfileByAddress.delete(key))
  return request
}

/**
 * Get Basename profile info directly from a basename handle.
 * Accepts "akita", "@akita", or "akita.base.eth".
 */
export async function getBasenameProfileByName(
  input: string,
): Promise<BasenameInfo> {
  const basename = normalizeBasenameInput(input)
  if (!basename) return { name: null }
  const key = cacheBasenameKey(basename)
  const cached = readCache(basenameProfileByNameCache, key)
  if (cached !== undefined) return cloneBasenameInfo(cached)

  const pending = pendingBasenameProfileByName.get(key)
  if (pending) return pending.then(cloneBasenameInfo)

  const request = (async () => {
    const startedAt = Date.now()
    try {
      const client = createMainnetReadClient()
      const normalizedName = normalize(basename)

      const [avatar, displayName, description, twitter, github, discord, email, url] =
        await Promise.all([
          client.getEnsAvatar({ name: normalizedName, gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'name', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'description', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'com.twitter', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'com.github', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'com.discord', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'email', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
          client.getEnsText({ name: normalizedName, key: 'url', gatewayUrls: [...ENS_GATEWAY_URLS] }).catch(() => null),
        ])

      const profile: BasenameInfo = {
        name: basename,
        avatar,
        displayName,
        description,
        twitter,
        github,
        discord,
        email,
        url,
      }
      const result = cloneBasenameInfo(writeCache(basenameProfileByNameCache, key, profile))
      recordBasenameLookupTelemetry('get_basename_profile_by_name', 'hit', Date.now() - startedAt)
      return result
    } catch (error) {
      logBasenameLookupError('Failed to fetch Basename profile by name', error)
      const result = cloneBasenameInfo(
        writeCache(basenameProfileByNameCache, key, { name: null }, BASENAME_CACHE_TTL_MISS_MS),
      )
      recordBasenameLookupTelemetry(
        'get_basename_profile_by_name',
        isTimeoutBasenameError(error) ? 'timeout' : 'error',
        Date.now() - startedAt,
      )
      return result
    }
  })()
  pendingBasenameProfileByName.set(key, request)
  request.finally(() => pendingBasenameProfileByName.delete(key))
  return request
}

/**
 * Format Basename for display (remove .base.eth suffix for cleaner look)
 */
export function formatBasename(name: string | null): string {
  if (!name) return ''
  return name.replace('.base.eth', '')
}

/**
 * Check if address has a Basename
 */
export async function hasBasename(address: string): Promise<boolean> {
  const name = await getBasename(address)
  return name !== null
}
