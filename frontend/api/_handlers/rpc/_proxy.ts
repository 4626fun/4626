import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'

type JsonRpcRequest = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown }

const DEFAULT_CHAIN_RPCS = {
  base: [
    'https://base.llamarpc.com',
    'https://base-mainnet.public.blastapi.io',
    'https://base.meowrpc.com',
    'https://mainnet.base.org',
  ],
  mainnet: [
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://eth.llamarpc.com',
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
    'https://arbitrum.llamarpc.com',
  ],
  optimism: [
    'https://mainnet.optimism.io',
    'https://rpc.ankr.com/optimism',
    'https://optimism.llamarpc.com',
  ],
  polygon: [
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
    'https://polygon.llamarpc.com',
  ],
} as const

type RpcChain = keyof typeof DEFAULT_CHAIN_RPCS

const CHAIN_ENV_KEYS: Record<RpcChain, string[]> = {
  base: ['BASE_READ_RPC_URL', 'BASE_LOGS_RPC_URL', 'BASE_RPC_URL'],
  mainnet: ['ETH_RPC_URL', 'ETHEREUM_RPC_URL'],
  arbitrum: ['ARBITRUM_RPC_URL'],
  optimism: ['OPTIMISM_RPC_URL'],
  polygon: ['POLYGON_RPC_URL'],
}

const EXPECTED_CHAIN_ID_HEX: Record<RpcChain, string> = {
  base: '0x2105',
  mainnet: '0x1',
  arbitrum: '0xa4b1',
  optimism: '0xa',
  polygon: '0x89',
}

const RETRYABLE_STATUS = new Set([429])
const MAX_ATTEMPTS_PER_RPC = 2
const RETRY_BACKOFF_MS = [0, 150]
const RPC_CHAIN_ID_CACHE_TTL_MS = 5 * 60_000
const RPC_CHAIN_ID_TIMEOUT_MS = 1_500
const RPC_FORWARD_TIMEOUT_MS = 5_000
const RPC_RATE_LIMIT_WINDOW_MS = 60_000
const RPC_RATE_LIMIT_MAX_REQUESTS = 120
const RPC_TELEMETRY_ENABLED = !['0', 'false', 'no', 'off'].includes(
  String(process.env.RPC_PROXY_TELEMETRY ?? '1').trim().toLowerCase(),
)
const RPC_TELEMETRY_WINDOW_MS = clampInteger(
  process.env.RPC_PROXY_TELEMETRY_WINDOW_MS,
  30_000,
  1_000,
  300_000,
)
const RPC_TELEMETRY_MAX_METHOD_KEYS = 24
const rpcChainIdCache = new Map<string, { value: string | null; expiresAt: number }>()
const rpcRateLimitState = new Map<string, { count: number; resetAt: number }>()
let rpcInFlightRequests = 0
let rpcTelemetryWindow = createRpcTelemetryWindow(Date.now())

type RateLimitBucketResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

type RpcRequestOutcome =
  | 'ok'
  | 'method_not_allowed'
  | 'unauthenticated'
  | 'local_rate_limited'
  | 'invalid_body'
  | 'missing_method'
  | 'blocked_method'
  | 'forwarded_non_retryable_error'
  | 'upstream_rate_limited'
  | 'upstream_failed'

type RpcTelemetryWindow = {
  startedAt: number
  totalRequests: number
  okResponses: number
  errorResponses: number
  localRateLimited: number
  upstreamRateLimited: number
  totalDurationMs: number
  maxDurationMs: number
  maxInFlight: number
  chainCounts: Record<RpcChain, number>
  methodCounts: Map<string, number>
  outcomeCounts: Map<string, number>
}

type RpcRequestTelemetry = {
  chain: RpcChain
  methods: string[]
  status: number
  outcome: RpcRequestOutcome
  attempts: number
  upstreamHost: string | null
  durationMs: number
  inFlightAtStart: number
}

const BLOCKED_RPC_METHOD_PREFIXES = ['eth_send', 'personal_', 'wallet_', 'admin_', 'debug_', 'trace_'] as const
const BLOCKED_RPC_METHODS = new Set<string>([
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'eth_sendRawTransaction',
  'eth_sendTransaction',
  'eth_submitWork',
  'eth_submitHashrate',
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

function readRpcHost(raw: string): string | null {
  try {
    const parsed = new URL(raw)
    return parsed.host || null
  } catch {
    return null
  }
}

function clampInteger(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function createChainCountRecord(): Record<RpcChain, number> {
  return {
    base: 0,
    mainnet: 0,
    arbitrum: 0,
    optimism: 0,
    polygon: 0,
  }
}

function createRpcTelemetryWindow(startedAt: number): RpcTelemetryWindow {
  return {
    startedAt,
    totalRequests: 0,
    okResponses: 0,
    errorResponses: 0,
    localRateLimited: 0,
    upstreamRateLimited: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    maxInFlight: 0,
    chainCounts: createChainCountRecord(),
    methodCounts: new Map<string, number>(),
    outcomeCounts: new Map<string, number>(),
  }
}

function incrementMapCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function normalizeMethodForTelemetry(method: string): string {
  const trimmed = method.trim()
  if (!trimmed) return '(none)'
  return trimmed.length <= 72 ? trimmed : `${trimmed.slice(0, 72)}...`
}

function topMapEntries(
  map: Map<string, number>,
  limit: number,
): Array<{ key: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function rotateRpcTelemetryWindow(now: number): void {
  if (!RPC_TELEMETRY_ENABLED) return
  const elapsedMs = now - rpcTelemetryWindow.startedAt
  if (elapsedMs < RPC_TELEMETRY_WINDOW_MS) return

  if (rpcTelemetryWindow.totalRequests > 0) {
    const durationSeconds = Math.max(1, elapsedMs / 1000)
    const avgDurationMs = Math.round(
      rpcTelemetryWindow.totalDurationMs / rpcTelemetryWindow.totalRequests,
    )
    const payload = {
      windowStartIso: new Date(rpcTelemetryWindow.startedAt).toISOString(),
      windowDurationMs: elapsedMs,
      requestsPerSecond: Number((rpcTelemetryWindow.totalRequests / durationSeconds).toFixed(2)),
      totalRequests: rpcTelemetryWindow.totalRequests,
      okResponses: rpcTelemetryWindow.okResponses,
      errorResponses: rpcTelemetryWindow.errorResponses,
      localRateLimited: rpcTelemetryWindow.localRateLimited,
      upstreamRateLimited: rpcTelemetryWindow.upstreamRateLimited,
      avgDurationMs,
      maxDurationMs: rpcTelemetryWindow.maxDurationMs,
      maxInFlight: rpcTelemetryWindow.maxInFlight,
      byChain: rpcTelemetryWindow.chainCounts,
      topMethods: topMapEntries(rpcTelemetryWindow.methodCounts, 8),
      outcomes: topMapEntries(rpcTelemetryWindow.outcomeCounts, 8),
    }
    console.info('[rpc-telemetry-window]', JSON.stringify(payload))
  }

  rpcTelemetryWindow = createRpcTelemetryWindow(now)
}

function recordRpcTelemetry(entry: RpcRequestTelemetry): void {
  if (!RPC_TELEMETRY_ENABLED) return
  const now = Date.now()
  rotateRpcTelemetryWindow(now)

  const window = rpcTelemetryWindow
  window.totalRequests += 1
  window.chainCounts[entry.chain] += 1
  window.totalDurationMs += entry.durationMs
  if (entry.durationMs > window.maxDurationMs) window.maxDurationMs = entry.durationMs
  if (entry.inFlightAtStart > window.maxInFlight) window.maxInFlight = entry.inFlightAtStart

  if (entry.status >= 200 && entry.status < 400) window.okResponses += 1
  else window.errorResponses += 1
  if (entry.outcome === 'local_rate_limited') window.localRateLimited += 1
  if (entry.outcome === 'upstream_rate_limited') window.upstreamRateLimited += 1

  incrementMapCount(window.outcomeCounts, entry.outcome)
  const methodKeys = entry.methods.length > 0 ? entry.methods : ['(none)']
  for (const method of methodKeys) {
    const normalized = normalizeMethodForTelemetry(method)
    if (
      window.methodCounts.has(normalized) ||
      window.methodCounts.size < RPC_TELEMETRY_MAX_METHOD_KEYS
    ) {
      incrementMapCount(window.methodCounts, normalized)
    } else {
      incrementMapCount(window.methodCounts, '(other)')
    }
  }
}

function parseRpcEnv(raw: string): string[] {
  const value = String(raw ?? '').trim()
  if (!value) return []
  return value
    .split(/[\s,]+/g)
    .map(normalizeRpcUrl)
    .filter((x): x is string => Boolean(x))
}

function readChainRpcUrlsFromEnv(chain: RpcChain): string[] {
  const keys = CHAIN_ENV_KEYS[chain]
  if (!Array.isArray(keys) || keys.length === 0) return []
  const out: string[] = []
  for (const key of keys) {
    out.push(...parseRpcEnv(process.env[key] ?? ''))
  }
  return out
}

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

function resolveRpcChain(req: VercelRequest): RpcChain {
  const raw = firstQueryValue(req.query?.chain as string | string[] | undefined).toLowerCase()
  if (!raw || raw === 'base') return 'base'
  if (raw === 'mainnet' || raw === 'eth' || raw === 'ethereum') return 'mainnet'
  if (raw === 'arbitrum' || raw === 'arb') return 'arbitrum'
  if (raw === 'optimism' || raw === 'op') return 'optimism'
  if (raw === 'polygon' || raw === 'matic') return 'polygon'
  return 'base'
}

function getRpcUrls(chain: RpcChain): string[] {
  const fromEnv = readChainRpcUrlsFromEnv(chain)
  const defaults = DEFAULT_CHAIN_RPCS[chain]
  const urls = fromEnv.length > 0 ? [...fromEnv, ...defaults] : [...defaults]
  return Array.from(new Set(urls))
}

function normalizeChainIdHex(raw: string): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  try {
    return `0x${BigInt(value).toString(16)}`
  } catch {
    return null
  }
}

async function readRpcChainId(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        }),
      },
      RPC_CHAIN_ID_TIMEOUT_MS,
    )
    if (!response.ok) return null
    const json = (await response.json().catch(() => null)) as { result?: unknown } | null
    if (!json || typeof json.result !== 'string') return null
    return normalizeChainIdHex(json.result)
  } catch {
    return null
  }
}

async function readRpcChainIdCached(url: string): Promise<string | null> {
  const now = Date.now()
  const cached = rpcChainIdCache.get(url)
  if (cached && cached.expiresAt > now) return cached.value
  const value = await readRpcChainId(url)
  rpcChainIdCache.set(url, { value, expiresAt: now + RPC_CHAIN_ID_CACHE_TTL_MS })
  return value
}

function isValidRpcBody(body: unknown): body is JsonRpcRequest | JsonRpcRequest[] {
  if (!body) return false
  if (Array.isArray(body)) return body.length > 0
  if (typeof body !== 'object') return false
  const b = body as JsonRpcRequest
  return Boolean(b.method)
}

function extractRpcMethods(payload: JsonRpcRequest | JsonRpcRequest[]): string[] {
  const requests = Array.isArray(payload) ? payload : [payload]
  const methods: string[] = []
  for (const request of requests) {
    const method = typeof request?.method === 'string' ? request.method.trim() : ''
    if (method) methods.push(method)
  }
  return methods
}

function isBlockedRpcMethod(method: string): boolean {
  const normalized = method.trim()
  if (!normalized) return true
  if (BLOCKED_RPC_METHODS.has(normalized)) return true
  const lower = normalized.toLowerCase()
  return BLOCKED_RPC_METHOD_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function parseRetryAfterSeconds(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const asNumber = Number(raw)
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.ceil(asNumber)
  const at = Date.parse(raw)
  if (!Number.isFinite(at)) return null
  const diffMs = at - Date.now()
  if (diffMs <= 0) return 1
  return Math.ceil(diffMs / 1000)
}

function toRetryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}

function setRateLimitHeaders(
  res: VercelResponse,
  data: { remaining: number; resetAt: number },
) {
  res.setHeader('X-RateLimit-Limit', String(RPC_RATE_LIMIT_MAX_REQUESTS))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, data.remaining)))
  res.setHeader('X-RateLimit-Reset', String(Math.floor(data.resetAt / 1000)))
}

function consumeRateLimitBucket(key: string): RateLimitBucketResult {
  const now = Date.now()
  const existing = rpcRateLimitState.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + RPC_RATE_LIMIT_WINDOW_MS
    rpcRateLimitState.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: RPC_RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt,
    }
  }
  if (existing.count >= RPC_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    }
  }
  existing.count += 1
  rpcRateLimitState.set(key, existing)
  return {
    allowed: true,
    remaining: RPC_RATE_LIMIT_MAX_REQUESTS - existing.count,
    resetAt: existing.resetAt,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  const telemetry: RpcRequestTelemetry = {
    chain: 'base',
    methods: [],
    status: 502,
    outcome: 'upstream_failed',
    attempts: 0,
    upstreamHost: null,
    durationMs: 0,
    inFlightAtStart: 0,
  }
  const requestStartedAt = Date.now()
  rpcInFlightRequests += 1
  telemetry.inFlightAtStart = rpcInFlightRequests

  const finalizeTelemetry = (status: number, outcome: RpcRequestOutcome) => {
    telemetry.status = status
    telemetry.outcome = outcome
  }

  try {
    if (req.method !== 'POST') {
      finalizeTelemetry(405, 'method_not_allowed')
      return res.status(405).json({ success: false, error: 'Method not allowed' })
    }

    const principalAddress = readRequestPrincipalAddress(req)
    if (!principalAddress) {
      finalizeTelemetry(401, 'unauthenticated')
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }
    const rateLimit = consumeRateLimitBucket(principalAddress.toLowerCase())
    setRateLimitHeaders(res, { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt })
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(toRetryAfterSeconds(rateLimit.resetAt)))
      finalizeTelemetry(429, 'local_rate_limited')
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'rpc_local_rate_limited',
      })
    }

    const body = await readJsonBody<unknown>(req, { maxBytes: 512_000 })
    if (!isValidRpcBody(body)) {
      finalizeTelemetry(400, 'invalid_body')
      return res.status(400).json({ success: false, error: 'Invalid JSON-RPC body' })
    }

    const payload = body
    const requestedMethods = extractRpcMethods(payload)
    telemetry.methods = requestedMethods
    if (requestedMethods.length === 0) {
      finalizeTelemetry(400, 'missing_method')
      return res.status(400).json({ success: false, error: 'Missing JSON-RPC method' })
    }
    if (requestedMethods.some(isBlockedRpcMethod)) {
      finalizeTelemetry(400, 'blocked_method')
      return res.status(400).json({ success: false, error: 'Unsupported JSON-RPC method' })
    }
    const chain = resolveRpcChain(req)
    telemetry.chain = chain
    const rpcUrls = getRpcUrls(chain)
    const envRpcUrls = new Set(readChainRpcUrlsFromEnv(chain))
    const expectedChainId = EXPECTED_CHAIN_ID_HEX[chain]
    let lastStatus = 502
    let lastError: string | null = null
    let lastRetryAfterSeconds: number | null = null

    for (const rpc of rpcUrls) {
      if (envRpcUrls.has(rpc) && expectedChainId) {
        const actualChainId = await readRpcChainIdCached(rpc)
        if (actualChainId && actualChainId !== expectedChainId) {
          lastStatus = 502
          lastError = 'RPC chain mismatch'
          continue
        }
      }

      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_RPC; attempt++) {
        if (attempt > 0) {
          const delay = RETRY_BACKOFF_MS[attempt] ?? 250
          if (delay > 0) await sleep(delay)
        }
        try {
          telemetry.attempts += 1
          telemetry.upstreamHost = readRpcHost(rpc)
          const response = await fetchWithTimeout(
            rpc,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            },
            RPC_FORWARD_TIMEOUT_MS,
          )

          if (response.ok) {
            const text = await response.text()
            const contentType = response.headers.get('content-type') || 'application/json'
            res.setHeader('Content-Type', contentType)
            finalizeTelemetry(response.status, 'ok')
            return res.status(response.status).send(text)
          }

          const status = response.status
          const text = await response.text().catch(() => '')
          const retryable = RETRYABLE_STATUS.has(status) || status >= 500
          if (retryable) {
            if (status === 429) {
              lastRetryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'))
            }
            lastStatus = status
            lastError = text || `Upstream RPC error (${status})`
            if (attempt + 1 < MAX_ATTEMPTS_PER_RPC) continue
            break
          }

          // Forward non-retryable response
          const contentType = response.headers.get('content-type') || 'application/json'
          res.setHeader('Content-Type', contentType)
          finalizeTelemetry(status, 'forwarded_non_retryable_error')
          return res.status(status).send(text)
        } catch (e) {
          if (isAbortError(e)) {
            lastError = 'RPC request timeout'
          } else {
            lastError = 'RPC proxy error'
          }
          lastStatus = 502
          if (attempt + 1 < MAX_ATTEMPTS_PER_RPC) continue
          break
        }
      }
    }

    if (lastStatus === 429 && lastRetryAfterSeconds && lastRetryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(lastRetryAfterSeconds))
    }
    finalizeTelemetry(
      lastStatus,
      lastStatus === 429 ? 'upstream_rate_limited' : 'upstream_failed',
    )

    return res.status(lastStatus).json({
      success: false,
      error: lastError || `RPC proxy failed (${chain})`,
      code: lastStatus === 429 ? 'rpc_upstream_rate_limited' : 'rpc_proxy_failed',
    })
  } finally {
    rpcInFlightRequests = Math.max(0, rpcInFlightRequests - 1)
    telemetry.durationMs = Date.now() - requestStartedAt
    recordRpcTelemetry(telemetry)
  }
}
