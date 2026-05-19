/**
 * Zora Coin Migration Detection
 *
 * Detects coins that have migrated from legacy 3% fee structure to V4 1% fee structure
 * by tracking LiquidityMigrated events on Base.
 */

import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

import { getBrowserBaseReadRpcUrl } from '@/lib/base/baseReadRpcPolicy'
import { zoraMigrationVerifyImplFlag } from '@/lib/flags/featureFlags'
import {
  DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST,
  parseAddressAllowlist,
  scanMigratedCoinsWithClient,
} from '@/lib/zora/migrationScan'

export {
  extractMigratedCoinAddressFromLog,
  LIQUIDITY_MIGRATED_TOPIC,
  parseMinimalProxyImplementation,
  scanMigratedCoinsWithClient,
  V4_LAUNCH_BLOCK,
} from '@/lib/zora/migrationScan'
export type { MigratedCoinScanClient, ScanMigratedCoinsOptions } from '@/lib/zora/migrationScan'

const MIGRATED_COINS_API_PATH = '/api/zora/migratedCoins'

const CACHE_KEY = 'zora_migrated_coins'
const CACHE_TIMESTAMP_KEY = 'zora_migrated_coins_ts'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour
const TRUST_CHECK_CONCURRENCY = (() => {
  const raw = Number(import.meta.env.VITE_ZORA_MIGRATION_TRUST_CONCURRENCY ?? 8)
  if (!Number.isFinite(raw)) return 8
  const rounded = Math.floor(raw)
  if (rounded < 1) return 1
  if (rounded > 32) return 32
  return rounded
})()

let migratedCoinsSet: Set<string> | null = null
let lastFetchTime = 0
let inFlightFetchMigratedCoins: Promise<Set<string>> | null = null

const ALLOWED_ZORA_COIN_IMPLEMENTATIONS = parseAddressAllowlist(
  import.meta.env.VITE_ZORA_COIN_IMPLEMENTATION_ALLOWLIST as string | undefined,
  DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST,
)

const BASE_RPC_RAW =
  (import.meta.env.VITE_BASE_READ_RPC_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_BASE_RPC as string | undefined)?.trim() ||
  ''

const IS_BROWSER = typeof window !== 'undefined'
const VERIFY_MIGRATION_IMPLEMENTATION = (() => {
  if (!IS_BROWSER) return true
  return zoraMigrationVerifyImplFlag()
})()

function normalizeRpcUrl(url: string): string | null {
  const s = String(url || '').trim()
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/')) return s
  return null
}

function getBaseRpcUrl(): string {
  const normalized = normalizeRpcUrl(BASE_RPC_RAW)
  if (IS_BROWSER) return getBrowserBaseReadRpcUrl(normalized ?? '')
  if (normalized) return normalized
  return 'https://base-mainnet.public.blastapi.io'
}

function getPublicClient() {
  const rpcUrl = getBaseRpcUrl()
  const transport = rpcUrl.startsWith('/api/rpc')
    ? http(rpcUrl, {
        retryCount: 0,
        retryDelay: 150,
      })
    : http(rpcUrl)
  return createPublicClient({
    chain: base,
    transport,
  })
}

function getCachedMigratedCoins(): Set<string> | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    if (!cached || !timestamp) return null

    const age = Date.now() - parseInt(timestamp, 10)
    if (age > CACHE_TTL) return null

    const addresses = JSON.parse(cached) as string[]
    return new Set(addresses.map((a) => a.toLowerCase()))
  } catch {
    return null
  }
}

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
  if (!raw) return 100_000n
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 100_000n
  return BigInt(Math.floor(n))
}

async function fetchMigratedCoinsFromApi(): Promise<Set<string>> {
  const response = await fetch(MIGRATED_COINS_API_PATH, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`migrated coins API failed (${response.status})`)
  }
  const payload = (await response.json()) as {
    success?: boolean
    addresses?: string[]
    error?: string
  }
  if (!payload.success || !Array.isArray(payload.addresses)) {
    throw new Error(payload.error || 'migrated coins API returned invalid payload')
  }
  return new Set(payload.addresses.map((address) => address.toLowerCase()))
}

async function fetchMigratedCoinsFromRpc(): Promise<Set<string>> {
  return scanMigratedCoinsWithClient(getPublicClient(), {
    initialChunkDelta: getInitialLogRangeDelta(),
    verifyImplementation: VERIFY_MIGRATION_IMPLEMENTATION,
    allowedImplementations: ALLOWED_ZORA_COIN_IMPLEMENTATIONS,
    trustCheckConcurrency: TRUST_CHECK_CONCURRENCY,
  })
}

export async function fetchMigratedCoins(): Promise<Set<string>> {
  if (migratedCoinsSet && Date.now() - lastFetchTime < CACHE_TTL) {
    return migratedCoinsSet
  }

  const cached = getCachedMigratedCoins()
  if (cached) {
    migratedCoinsSet = cached
    lastFetchTime = Date.now()
    return cached
  }

  if (inFlightFetchMigratedCoins) return inFlightFetchMigratedCoins

  inFlightFetchMigratedCoins = (async () => {
    try {
      const migratedAddresses = IS_BROWSER
        ? await fetchMigratedCoinsFromApi()
        : await fetchMigratedCoinsFromRpc()

      const addressArray = Array.from(migratedAddresses)
      setCachedMigratedCoins(addressArray)
      migratedCoinsSet = migratedAddresses
      lastFetchTime = Date.now()

      console.log(`[migrations] Cached ${addressArray.length} migrated coins`)
      return migratedAddresses
    } catch (e) {
      console.error('[migrations] Failed to fetch migrated coins:', e)
      return new Set()
    }
  })()

  try {
    return await inFlightFetchMigratedCoins
  } finally {
    inFlightFetchMigratedCoins = null
  }
}

export async function hasCoinMigrated(coinAddress: string): Promise<boolean> {
  const migrated = await fetchMigratedCoins()
  return migrated.has(coinAddress.toLowerCase())
}

export function hasCoinMigratedSync(coinAddress: string): boolean | undefined {
  if (!migratedCoinsSet) {
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

export function preloadMigratedCoins(): void {
  fetchMigratedCoins().catch(console.error)
}

export async function getMigrationStats(): Promise<{ count: number; lastUpdated: number }> {
  const migrated = await fetchMigratedCoins()
  return {
    count: migrated.size,
    lastUpdated: lastFetchTime,
  }
}
