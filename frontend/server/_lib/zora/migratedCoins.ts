import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

import {
  LIQUIDITY_MIGRATED_TOPIC,
  parseAddressAllowlist,
  scanMigratedCoinsWithClient,
  V4_LAUNCH_BLOCK,
  DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST,
} from '../../../src/lib/zora/migrationScan.js'

declare const process: { env: Record<string, string | undefined> }

const SERVER_CACHE_TTL_MS = 60 * 60 * 1000

let cachedAddresses: Set<string> | null = null
let cachedAt = 0
let inFlightScan: Promise<Set<string>> | null = null

function getLogsRpcUrl(): string {
  const logs = (process.env.BASE_LOGS_RPC_URL ?? '').trim()
  if (logs) return logs
  const read = (process.env.BASE_READ_RPC_URL ?? '').trim()
  if (read) return read
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://base-mainnet.public.blastapi.io'
}

function getInitialLogRangeDelta(): bigint {
  const raw = process.env.BASE_LOGS_RPC_RANGE ?? process.env.BASE_LOG_RANGE_DELTA
  if (!raw) return 100_000n
  try {
    const n = BigInt(raw)
    return n > 0n ? n : 100_000n
  } catch {
    return 100_000n
  }
}

function getAllowedImplementations(): Set<string> {
  return parseAddressAllowlist(
    process.env.ZORA_COIN_IMPLEMENTATION_ALLOWLIST,
    DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST,
  )
}

export async function fetchServerMigratedCoins(options?: {
  forceRefresh?: boolean
}): Promise<{ addresses: Set<string>; lastUpdated: number }> {
  const forceRefresh = options?.forceRefresh === true
  const now = Date.now()

  if (!forceRefresh && cachedAddresses && now - cachedAt < SERVER_CACHE_TTL_MS) {
    return { addresses: cachedAddresses, lastUpdated: cachedAt }
  }

  if (!forceRefresh && inFlightScan) {
    const addresses = await inFlightScan
    return { addresses, lastUpdated: cachedAt || now }
  }

  inFlightScan = (async () => {
    const client = createPublicClient({
      chain: base,
      transport: http(getLogsRpcUrl(), { timeout: 20_000 }),
    })
    const addresses = await scanMigratedCoinsWithClient(client, {
      fromBlock: V4_LAUNCH_BLOCK,
      topic: LIQUIDITY_MIGRATED_TOPIC,
      initialChunkDelta: getInitialLogRangeDelta(),
      verifyImplementation: true,
      allowedImplementations: getAllowedImplementations(),
    })
    cachedAddresses = addresses
    cachedAt = Date.now()
    return addresses
  })()

  try {
    const addresses = await inFlightScan
    return { addresses, lastUpdated: cachedAt }
  } finally {
    inFlightScan = null
  }
}
