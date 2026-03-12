import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'

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
const rpcChainIdCache = new Map<string, { value: string | null; expiresAt: number }>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
    })
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const body = await readJsonBody<unknown>(req, { maxBytes: 512_000 })
  if (!isValidRpcBody(body)) {
    return res.status(400).json({ success: false, error: 'Invalid JSON-RPC body' })
  }

  const payload = body
  const chain = resolveRpcChain(req)
  const rpcUrls = getRpcUrls(chain)
  const envRpcUrls = new Set(readChainRpcUrlsFromEnv(chain))
  const expectedChainId = EXPECTED_CHAIN_ID_HEX[chain]
  let lastStatus = 502
  let lastError: string | null = null

  for (const rpc of rpcUrls) {
    if (envRpcUrls.has(rpc) && expectedChainId) {
      const actualChainId = await readRpcChainIdCached(rpc)
      if (actualChainId && actualChainId !== expectedChainId) {
        lastStatus = 502
        lastError = `RPC chain mismatch for ${rpc}: expected ${expectedChainId}, got ${actualChainId}`
        continue
      }
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_RPC; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_BACKOFF_MS[attempt] ?? 250
        if (delay > 0) await sleep(delay)
      }
      try {
        const response = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          const text = await response.text()
          const contentType = response.headers.get('content-type') || 'application/json'
          res.setHeader('Content-Type', contentType)
          return res.status(response.status).send(text)
        }

        const status = response.status
        const text = await response.text().catch(() => '')
        const retryable = RETRYABLE_STATUS.has(status) || status >= 500
        if (retryable) {
          lastStatus = status
          lastError = text || `Upstream RPC error (${status})`
          if (attempt + 1 < MAX_ATTEMPTS_PER_RPC) continue
          break
        }

        // Forward non-retryable response
        const contentType = response.headers.get('content-type') || 'application/json'
        res.setHeader('Content-Type', contentType)
        return res.status(status).send(text)
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e ?? 'RPC proxy error')
        lastStatus = 502
        if (attempt + 1 < MAX_ATTEMPTS_PER_RPC) continue
        break
      }
    }
  }

  return res.status(lastStatus).json({
    success: false,
    error: lastError || `RPC proxy failed (${chain})`,
  })
}
