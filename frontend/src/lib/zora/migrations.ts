/**
 * Zora Coin Migration Detection
 * 
 * Detects coins that have migrated from legacy 3% fee structure to V4 1% fee structure
 * by tracking LiquidityMigrated events on Base.
 */

import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

// LiquidityMigrated event signature
// event LiquidityMigrated(PoolKey oldPoolKey, bytes32 indexed oldPoolKeyHash, PoolKey newPoolKey, bytes32 indexed newPoolKeyHash)
const LIQUIDITY_MIGRATED_TOPIC = '0x907fbdc07b1c9a591dc1287635b072fa848f4da7c86645dfc9b8bfb3b94f82ab'

// V4 launch block (June 6, 2025)
const V4_LAUNCH_BLOCK = 31250000n

// Cache keys
const CACHE_KEY = 'zora_migrated_coins'
const CACHE_TIMESTAMP_KEY = 'zora_migrated_coins_ts'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

// In-memory cache for faster lookups
let migratedCoinsSet: Set<string> | null = null
let lastFetchTime = 0

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
        }) as Array<{ address: string }>
        
        for (const log of logs) {
          // The emitting address is the coin contract
          migratedAddresses.add(log.address.toLowerCase())
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
    
    console.log(`[migrations] Cached ${addressArray.length} migrated coins`)
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
