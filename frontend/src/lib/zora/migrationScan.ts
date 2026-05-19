import { decodeAbiParameters, isAddress, parseAbiParameters } from 'viem'

export const LIQUIDITY_MIGRATED_TOPIC = '0x907fbdc07b1c9a591dc1287635b072fa848f4da7c86645dfc9b8bfb3b94f82ab'
const LIQUIDITY_MIGRATED_DATA_ABI = parseAbiParameters(
  '(address,address,uint24,int24,address),bytes32,(address,address,uint24,int24,address),bytes32',
)

export const DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST = [
  '0x88cc4e08c7608723f3e44e17ac669fb43b6a8313',
  '0xca72309aaf706d290e08608b1af47943902f69b2',
] as const

export const V4_LAUNCH_BLOCK = 31250000n

const RATE_LIMIT_RETRY_BASE_MS = 5_000
const RATE_LIMIT_RETRY_MAX_MS = 60_000
const MAX_RATE_LIMIT_RETRIES_PER_CHUNK = 6

export type MigratedCoinScanClient = {
  getBlockNumber(): Promise<bigint>
  request(args: { method: string; params?: unknown }): Promise<unknown>
}

export type ScanMigratedCoinsOptions = {
  fromBlock?: bigint
  topic?: string
  initialChunkDelta?: bigint
  verifyImplementation?: boolean
  allowedImplementations?: Set<string>
  trustCheckConcurrency?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export function parseAddressAllowlist(raw: string | undefined, fallback: readonly string[]): Set<string> {
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

    const oldPair = [oldCurrency0, oldCurrency1].sort().join(':')
    const newPair = [newCurrency0, newCurrency1].sort().join(':')
    if (oldPair !== newPair) return null

    if (emitter !== oldCurrency0 && emitter !== oldCurrency1) return null
    if (emitter !== newCurrency0 && emitter !== newCurrency1) return null

    return emitter
  } catch {
    return null
  }
}

async function isTrustedMigratedCoin(
  client: MigratedCoinScanClient,
  coinAddress: string,
  allowedImplementations: Set<string>,
): Promise<boolean> {
  if (!isAddress(coinAddress)) return false
  try {
    const bytecode = (await client.request({
      method: 'eth_getCode',
      params: [coinAddress as `0x${string}`, 'latest'],
    })) as `0x${string}`
    const implementation = parseMinimalProxyImplementation(bytecode)
    if (!implementation) return false
    return allowedImplementations.has(implementation.toLowerCase())
  } catch {
    return false
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, Math.floor(concurrency))
  const results = new Array<R>(items.length)
  let cursor = 0

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index]!)
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

function extractSuggestedRangeDelta(error: unknown): bigint | null {
  const msg = String((error as { message?: unknown } | null)?.message ?? error ?? '')
  const rangeMatch = msg.match(/\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/)
  if (rangeMatch) {
    try {
      const from = BigInt(rangeMatch[1]!)
      const to = BigInt(rangeMatch[2]!)
      if (to >= from) return to - from
    } catch {
      // ignore
    }
  }
  const limitMatch = msg.toLowerCase().match(/up to a (\d+) block range/)
  if (limitMatch) {
    try {
      const n = BigInt(limitMatch[1]!)
      if (n > 0n) return n - 1n
    } catch {
      // ignore
    }
  }
  return null
}

function getErrorStatus(error: unknown): number | null {
  const direct = Number((error as { status?: unknown } | null)?.status)
  if (Number.isFinite(direct) && direct > 0) return direct
  const cause = Number((error as { cause?: { status?: unknown } } | null)?.cause?.status)
  if (Number.isFinite(cause) && cause > 0) return cause
  return null
}

function readRetryAfterHeader(error: unknown): string | null {
  const headers = (error as { headers?: Headers | { get?: (name: string) => string | null } } | null)?.headers
  const direct = typeof headers?.get === 'function' ? headers.get('Retry-After') ?? headers.get('retry-after') : null
  if (direct) return direct
  const causeHeaders = (
    error as { cause?: { headers?: Headers | { get?: (name: string) => string | null } } } | null
  )?.cause?.headers
  return typeof causeHeaders?.get === 'function'
    ? causeHeaders.get('Retry-After') ?? causeHeaders.get('retry-after')
    : null
}

function parseRetryAfterMs(value: string | null): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000)
  const timestamp = Date.parse(raw)
  if (!Number.isFinite(timestamp)) return null
  const delayMs = timestamp - Date.now()
  if (delayMs <= 0) return 1_000
  return delayMs
}

function isRateLimitError(error: unknown): boolean {
  if (getErrorStatus(error) === 429) return true
  const code = Number((error as { code?: unknown } | null)?.code)
  if (Number.isFinite(code) && code === -32005) return true
  const msg = String((error as { message?: unknown; details?: unknown } | null)?.message
    ?? (error as { details?: unknown } | null)?.details
    ?? error
    ?? '').toLowerCase()
  return msg.includes('rate limit')
}

function getRateLimitRetryDelayMs(error: unknown, attempt: number): number {
  const headerDelayMs = parseRetryAfterMs(readRetryAfterHeader(error))
  if (headerDelayMs !== null) return Math.min(RATE_LIMIT_RETRY_MAX_MS, Math.max(1_000, headerDelayMs))
  const exponent = Math.max(0, attempt - 1)
  return Math.min(RATE_LIMIT_RETRY_MAX_MS, RATE_LIMIT_RETRY_BASE_MS * (2 ** exponent))
}

function readRpcErrorText(error: unknown): string {
  return String((error as { message?: unknown; details?: unknown } | null)?.message
    ?? (error as { details?: unknown } | null)?.details
    ?? error
    ?? '')
}

export function isPrunedHistoryError(error: unknown): boolean {
  const msg = readRpcErrorText(error).toLowerCase()
  return msg.includes('pruned history') || msg.includes('history unavailable')
}

export async function scanMigratedCoinsWithClient(
  client: MigratedCoinScanClient,
  options: ScanMigratedCoinsOptions = {},
): Promise<Set<string>> {
  const fromBlockStart = options.fromBlock ?? V4_LAUNCH_BLOCK
  const topic = options.topic ?? LIQUIDITY_MIGRATED_TOPIC
  const verifyImplementation = options.verifyImplementation ?? true
  const allowedImplementations = options.allowedImplementations
    ?? parseAddressAllowlist(undefined, DEFAULT_ZORA_COIN_IMPLEMENTATION_ALLOWLIST)
  const trustCheckConcurrency = options.trustCheckConcurrency ?? 8

  const latestBlock = await client.getBlockNumber()

  let chunkDelta = options.initialChunkDelta ?? 100_000n
  let warnedRangeLimit = false
  let warnedRateLimit = false
  let warnedPrunedHistory = false
  const migratedAddresses = new Set<string>()
  const trustedAddressCache = new Map<string, boolean>()
  let rejectedUntrustedCandidates = 0

  let fromBlock = fromBlockStart
  let rateLimitRetriesForChunk = 0

  while (fromBlock < latestBlock) {
    const toBlock = fromBlock + chunkDelta > latestBlock ? latestBlock : fromBlock + chunkDelta

    try {
      const logs = (await client.request({
        method: 'eth_getLogs',
        params: [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
          topics: [topic as `0x${string}`],
        }],
      })) as Array<{ address: string; data: `0x${string}` }>

      const chunkCandidates = new Set<string>()
      for (const log of logs) {
        const candidate = extractMigratedCoinAddressFromLog(log)
        if (!candidate) continue
        chunkCandidates.add(candidate)
      }

      const uncachedCandidates = Array.from(chunkCandidates).filter((candidate) => !trustedAddressCache.has(candidate))
      if (uncachedCandidates.length > 0) {
        if (verifyImplementation) {
          const trustResults = await mapWithConcurrency(
            uncachedCandidates,
            trustCheckConcurrency,
            async (candidate) => {
              const trusted = await isTrustedMigratedCoin(client, candidate, allowedImplementations)
              return [candidate, trusted] as const
            },
          )
          for (const [candidate, trusted] of trustResults) {
            trustedAddressCache.set(candidate, trusted)
          }
        } else {
          for (const candidate of uncachedCandidates) {
            trustedAddressCache.set(candidate, true)
          }
        }
      }

      for (const candidate of chunkCandidates) {
        if (trustedAddressCache.get(candidate)) {
          migratedAddresses.add(candidate)
        } else {
          rejectedUntrustedCandidates += 1
        }
      }
      rateLimitRetriesForChunk = 0
    } catch (e) {
      if (isPrunedHistoryError(e)) {
        if (!warnedPrunedHistory) {
          warnedPrunedHistory = true
          console.warn('[migrations] RPC does not retain log history; aborting on-chain migration scan.')
        }
        break
      }

      if (isRateLimitError(e)) {
        rateLimitRetriesForChunk += 1
        if (rateLimitRetriesForChunk > MAX_RATE_LIMIT_RETRIES_PER_CHUNK) {
          console.warn(
            `[migrations] Rate limit persisted for blocks ${fromBlock}-${toBlock}. Skipping chunk after ${MAX_RATE_LIMIT_RETRIES_PER_CHUNK} retries.`,
          )
          rateLimitRetriesForChunk = 0
          fromBlock = toBlock + 1n
          continue
        }

        const delayMs = getRateLimitRetryDelayMs(e, rateLimitRetriesForChunk)
        if (!warnedRateLimit) {
          warnedRateLimit = true
          console.warn(
            `[migrations] RPC rate limit detected. Waiting ${delayMs}ms before retrying block range ${fromBlock}-${toBlock}.`,
          )
        }
        await sleep(delayMs)
        continue
      }

      rateLimitRetriesForChunk = 0
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
      if (chunkDelta > 1n) {
        const reduced = chunkDelta / 2n
        chunkDelta = reduced < 1n ? 1n : reduced
        continue
      }
      console.warn(`[migrations] Failed to fetch logs for blocks ${fromBlock}-${toBlock}:`, e)
      fromBlock = toBlock + 1n
      continue
    }

    fromBlock = toBlock + 1n
  }

  console.log(
    `[migrations] Scanned ${migratedAddresses.size} migrated coins (rejected ${rejectedUntrustedCandidates} untrusted candidates)`,
  )
  return migratedAddresses
}
