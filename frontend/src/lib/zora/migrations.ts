/**
 * Zora Coin Migration Detection
 * 
 * Detects coins that have migrated from legacy 3% fee structure to V4 1% fee structure
 * by tracking LiquidityMigrated events on Base.
 */

import { createPublicClient, http } from 'viem'
import { decodeAbiParameters, isAddress, parseAbiParameters } from 'viem'
import { base } from 'viem/chains'

// LiquidityMigrated event signature
// event LiquidityMigrated(PoolKey oldPoolKey, bytes32 indexed oldPoolKeyHash, PoolKey newPoolKey, bytes32 indexed newPoolKeyHash)
const LIQUIDITY_MIGRATED_TOPIC = '0x907fbdc07b1c9a591dc1287635b072fa848f4da7c86645dfc9b8bfb3b94f82ab'
const LIQUIDITY_MIGRATED_DATA_ABI = parseAbiParameters(
  '(address,address,uint24,int24,address),bytes32,(address,address,uint24,int24,address),bytes32',
)

// Known Zora coin proxy implementation addresses observed on Base migrations.
// You can override via VITE_ZORA_COIN_IMPLEMENTATION_ALLOWLIST (comma-separated).
const DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST = [
  '0x88cc4e08c7608723f3e44e17ac669fb43b6a8313',
  '0xca72309aaf706d290e08608b1af47943902f69b2',
] as const

// V4 launch block (June 6, 2025)
const V4_LAUNCH_BLOCK = 31250000n

// Cache keys
const CACHE_KEY = 'zora_migrated_coins'
const CACHE_TIMESTAMP_KEY = 'zora_migrated_coins_ts'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

// In-memory cache for faster lookups
let migratedCoinsSet: Set<string> | null = null
let lastFetchTime = 0

function parseAddressAllowlist(raw: string | undefined, fallback: readonly string[]): Set<string> {
  const parsed = new Set<string>()
  const entries = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const source = entries.length > 0 ? entries : [...fallback]
  for (const entry of source) {
    if (isAddress(entry)) parsed.add(entry.toLowerCase())
  }
  if (parsed.size > 0) return parsed
  return new Set(fallback.map((a) => a.toLowerCase()))
}

const ALLOWED_ZORA_COIN_IMPLEMENTATIONS = parseAddressAllowlist(
  import.meta.env.VITE_ZORA_COIN_IMPLEMENTATION_ALLOWLIST as string | undefined,
  DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST,
)

const BASE_RPC_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'

function isCorsRestrictedRpc(url: string): boolean {
  // Alchemy browser CORS is opt-in; avoid hard failures by default.
  return /(^|\/\/)base-mainnet\.g\.alchemy\.com/i.test(url) || /\.g\.alchemy\.com\//i.test(url)
}

function normalizeRpcUrl(url: string): string | null {
  const s = String(url || '').trim()
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/')) return s
  return null
}

function getBaseRpcUrl(): string {
  const normalized = normalizeRpcUrl(BASE_RPC_RAW)
  if (IS_BROWSER) {
    if (normalized && !isCorsRestrictedRpc(normalized)) return normalized
    return '/api/rpc'
  }
  if (normalized) return normalized
  return 'https://base-mainnet.public.blastapi.io'
}

/**
 * Get the public client for Base
 */
function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrl()),
  })
}

/**
 * Fetch migrated coins from localStorage cache
 */
function getCachedMigratedCoins(): Set<string> | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    
    if (!cached || !timestamp) return null
    
    const age = Date.now() - parseInt(timestamp, 10)
    if (age > CACHE_TTL) return null
    
    const addresses = JSON.parse(cached) as string[]
    return new Set(addresses.map(a => a.toLowerCase()))
  } catch {
    return null
  }
}

/**
 * Save migrated coins to localStorage cache
 */
function setCachedMigratedCoins(addresses: string[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(addresses))
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()))
  } catch {
    // localStorage might be full or unavailable
  }
}

function getInitialLogRangeDelta(): bigint {
  const raw = import.meta.env.VITE_BASE_LOG_RANGE_DELTA as string | undefined
  if (!raw) return 50000n
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 50000n
  return BigInt(Math.floor(n))
}

export function parseMinimalProxyImplementation(bytecode: string): string | null {
  const code = String(bytecode || '').toLowerCase()
  const match = code.match(
    /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/,
  )
  if (!match) return null
  return `0x${match[1]}`
}

export function extractMigratedCoinAddressFromLog(log: { address?: string; data?: string }): string | null {
  const emitter = String(log.address ?? '').toLowerCase()
  const data = String(log.data ?? '')
  if (!isAddress(emitter) || !data) return null

  try {
    const [oldPoolKey, , newPoolKey] = decodeAbiParameters(
      LIQUIDITY_MIGRATED_DATA_ABI,
      data as `0x${string}`,
    ) as [[string, string, number, number, string], string, [string, string, number, number, string], string]

    const oldCurrency0 = String(oldPoolKey[0] ?? '').toLowerCase()
    const oldCurrency1 = String(oldPoolKey[1] ?? '').toLowerCase()
    const newCurrency0 = String(newPoolKey[0] ?? '').toLowerCase()
    const newCurrency1 = String(newPoolKey[1] ?? '').toLowerCase()
    if (
      !isAddress(oldCurrency0) ||
      !isAddress(oldCurrency1) ||
      !isAddress(newCurrency0) ||
      !isAddress(newCurrency1)
    ) {
      return null
    }

    // Enforce pool-pair consistency across old/new keys.
    const oldPair = [oldCurrency0, oldCurrency1].sort().join(':')
    const newPair = [newCurrency0, newCurrency1].sort().join(':')
    if (oldPair !== newPair) return null

    // Enforce source authenticity: the emitting contract must be the migrated coin.
    if (emitter !== oldCurrency0 && emitter !== oldCurrency1) return null
    if (emitter !== newCurrency0 && emitter !== newCurrency1) return null

    return emitter
  } catch {
    return null
  }
}

async function isTrustedMigratedCoin(client: ReturnType<typeof getPublicClient>, coinAddress: string): Promise<boolean> {
  if (!isAddress(coinAddress)) return false
  try {
    const bytecode = await client.request({
      method: 'eth_getCode',
      params: [coinAddress as `0x${string}`, 'latest'],
    }) as `0x${string}`
    const implementation = parseMinimalProxyImplementation(bytecode)
    if (!implementation) return false
    return ALLOWED_ZORA_COIN_IMPLEMENTATIONS.has(implementation.toLowerCase())
  } catch {
    return false
  }
}

function extractSuggestedRangeDelta(error: unknown): bigint | null {
  const msg = String((error as any)?.message ?? error ?? '')
  const rangeMatch = msg.match(/\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/)
  if (rangeMatch) {
    try {
      const from = BigInt(rangeMatch[1])
      const to = BigInt(rangeMatch[2])
      if (to >= from) return to - from
    } catch {
      // ignore
    }
  }
  const limitMatch = msg.toLowerCase().match(/up to a (\d+) block range/)
  if (limitMatch) {
    try {
      const n = BigInt(limitMatch[1])
      if (n > 0n) return n - 1n
    } catch {
      // ignore
    }
  }
  return null
}

/**
 * Fetch all migrated coin addresses from LiquidityMigrated events
 */
export async function fetchMigratedCoins(): Promise<Set<string>> {
  // Return memory cache if fresh
  if (migratedCoinsSet && Date.now() - lastFetchTime < CACHE_TTL) {
    return migratedCoinsSet
  }

  // Check localStorage cache
  const cached = getCachedMigratedCoins()
  if (cached) {
    migratedCoinsSet = cached
    lastFetchTime = Date.now()
    return cached
  }

  try {
    const client = getPublicClient()
    const latestBlock = await client.getBlockNumber()
    
    // Query logs in chunks to avoid RPC limits
    let chunkDelta = getInitialLogRangeDelta()
    let warnedRangeLimit = false
    const migratedAddresses = new Set<string>()
    const trustedAddressCache = new Map<string, boolean>()
    let rejectedUntrustedCandidates = 0
    
    let fromBlock = V4_LAUNCH_BLOCK
    
    while (fromBlock < latestBlock) {
      const toBlock = fromBlock + chunkDelta > latestBlock ? latestBlock : fromBlock + chunkDelta
      
      try {
        // Use raw RPC request for topic-based filtering
        const logs = await client.request({
          method: 'eth_getLogs',
          params: [{
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock: `0x${toBlock.toString(16)}`,
            topics: [LIQUIDITY_MIGRATED_TOPIC as `0x${string}`],
          }],
        }) as Array<{ address: string; data: `0x${string}` }>

        const chunkCandidates = new Set<string>()
        for (const log of logs) {
          const candidate = extractMigratedCoinAddressFromLog(log)
          if (!candidate) continue
          chunkCandidates.add(candidate)
        }

        const uncachedCandidates = Array.from(chunkCandidates).filter((candidate) => !trustedAddressCache.has(candidate))
        if (uncachedCandidates.length > 0) {
          const trustResults = await Promise.all(
            uncachedCandidates.map(async (candidate) => {
              const trusted = await isTrustedMigratedCoin(client, candidate)
              return [candidate, trusted] as const
            }),
          )
          for (const [candidate, trusted] of trustResults) {
            trustedAddressCache.set(candidate, trusted)
          }
        }

        for (const candidate of chunkCandidates) {
          if (trustedAddressCache.get(candidate)) {
            migratedAddresses.add(candidate)
          } else {
            rejectedUntrustedCandidates += 1
          }
        }
      } catch (e) {
        const suggestedDelta = extractSuggestedRangeDelta(e)
        if (suggestedDelta !== null && suggestedDelta < chunkDelta) {
          chunkDelta = suggestedDelta
          if (!warnedRangeLimit) {
            warnedRangeLimit = true
            console.warn(
              `[migrations] RPC log range limit detected. Reducing block delta to ${chunkDelta} and retrying.`,
            )
          }
          continue
        }
        if (chunkDelta > 0n) {
          const reduced = chunkDelta / 10n
          chunkDelta = reduced < 1n ? 0n : reduced
          continue
        }
        // If we can't reduce further, skip this block to avoid stalling.
        console.warn(`[migrations] Failed to fetch logs for blocks ${fromBlock}-${toBlock}:`, e)
        fromBlock = toBlock + 1n
        continue
      }
      
      fromBlock = toBlock + 1n
    }
    
    // Cache results
    const addressArray = Array.from(migratedAddresses)
    setCachedMigratedCoins(addressArray)
    migratedCoinsSet = migratedAddresses
    lastFetchTime = Date.now()
    
    console.log(
      `[migrations] Cached ${addressArray.length} migrated coins (rejected ${rejectedUntrustedCandidates} untrusted candidates)`,
    )
    return migratedAddresses
  } catch (e) {
    console.error('[migrations] Failed to fetch migrated coins:', e)
    // Return empty set on error, don't block the UI
    return new Set()
  }
}

/**
 * Check if a specific coin has migrated to V4
 * 
 * @param coinAddress - The coin contract address
 * @returns true if the coin has migrated, false otherwise
 */
export async function hasCoinMigrated(coinAddress: string): Promise<boolean> {
  const migrated = await fetchMigratedCoins()
  return migrated.has(coinAddress.toLowerCase())
}

/**
 * Synchronous check using cached data only
 * Returns undefined if cache is not available
 */
export function hasCoinMigratedSync(coinAddress: string): boolean | undefined {
  if (!migratedCoinsSet) {
    // Try to load from localStorage
    const cached = getCachedMigratedCoins()
    if (cached) {
      migratedCoinsSet = cached
      lastFetchTime = Date.now()
    } else {
      return undefined
    }
  }
  return migratedCoinsSet.has(coinAddress.toLowerCase())
}

/**
 * Preload migrated coins cache
 * Call this early in the app lifecycle
 */
export function preloadMigratedCoins(): void {
  fetchMigratedCoins().catch(console.error)
}

/**
 * Get migration stats
 */
export async function getMigrationStats(): Promise<{ count: number; lastUpdated: number }> {
  const migrated = await fetchMigratedCoins()
  return {
    count: migrated.size,
    lastUpdated: lastFetchTime,
  }
}
