// Basenames integration using OnchainKit
// Docs: https://docs.base.org/base-account/basenames/basenames-onchainkit-tutorial

import { createPublicClient, fallback, getAddress, http, isAddress, toCoinType } from 'viem'
import { base, baseSepolia, mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
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
const BASENAME_CACHE_TTL_MS = 60_000

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const basenameByAddressCache = new Map<string, CacheEntry<string | null>>()
const basenameAddressByInputCache = new Map<string, CacheEntry<string | null>>()
const basenameProfileByAddressCache = new Map<string, CacheEntry<BasenameInfo>>()
const basenameProfileByNameCache = new Map<string, CacheEntry<BasenameInfo>>()

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): T {
  cache.set(key, {
    value,
    expiresAt: Date.now() + BASENAME_CACHE_TTL_MS,
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
  return false
}

function logBasenameLookupError(message: string, error: unknown): void {
  if (isExpectedBasenameLookupError(error)) {
    logger.debug(`${message} (expected miss)`, error)
    return
  }
  logger.error(message, error)
}

function createMainnetReadClient() {
  // Avoid viem's default public endpoint selection in browsers (can pick
  // providers without permissive CORS, e.g. eth.merkle.io).
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      (IS_BROWSER
        ? ['/api/rpc?chain=mainnet']
        : ['https://ethereum-rpc.publicnode.com', 'https://rpc.ankr.com/eth', 'https://eth.llamarpc.com']).map((url) =>
        http(url),
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

    if (!name) return writeCache(basenameByAddressCache, key, null)
    // Guardrail: ENSIP-19 can resolve non-Basenames depending on user config.
    // For 4626 identity UI, only treat *.base.eth as a Basename.
    if (!name.toLowerCase().endsWith('.base.eth')) return writeCache(basenameByAddressCache, key, null)
    return writeCache(basenameByAddressCache, key, name)
  } catch (error) {
    logBasenameLookupError('Failed to fetch Basename', error)
    writeCache(basenameByAddressCache, key, null)
    return null
  }
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

  try {
    const raw = input.trim()
    if (!raw) return null
    if (isAddress(raw)) return getAddress(raw)

    const basename = normalizeBasenameInput(raw)
    if (!basename) return writeCache(basenameAddressByInputCache, inputKey, null)

    const client = createMainnetReadClient()
    const resolved = await client.getEnsAddress({
      name: normalize(basename),
      coinType: toCoinType(chainId === baseSepolia.id ? baseSepolia.id : base.id),
      gatewayUrls: [...ENS_GATEWAY_URLS],
    })
    return writeCache(basenameAddressByInputCache, inputKey, resolved ? getAddress(resolved) : null)
  } catch (error) {
    logBasenameLookupError('Failed to resolve Basename address', error)
    writeCache(basenameAddressByInputCache, inputKey, null)
    return null
  }
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

  try {
    const name = await getBasename(address, chainId)
    
    if (!name) {
      return cloneBasenameInfo(writeCache(basenameProfileByAddressCache, key, { name: null }))
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
    return cloneBasenameInfo(writeCache(basenameProfileByAddressCache, key, profile))
  } catch (error) {
    logBasenameLookupError('Failed to fetch Basename profile', error)
    return cloneBasenameInfo(writeCache(basenameProfileByAddressCache, key, { name: null }))
  }
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
    return cloneBasenameInfo(writeCache(basenameProfileByNameCache, key, profile))
  } catch (error) {
    logBasenameLookupError('Failed to fetch Basename profile by name', error)
    return cloneBasenameInfo(writeCache(basenameProfileByNameCache, key, { name: null }))
  }
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
