import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'

type JsonRpcRequest = { jsonrpc?: string; id?: unknown; method?: unknown; params?: unknown }

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

const RETRYABLE_STATUS = new Set([429])
const MAX_ATTEMPTS_PER_RPC = 2
const RETRY_BACKOFF_MS = [0, 150]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeRpcUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`
  return t
}

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const parts = raw
    ? raw
        .split(/[\s,]+/g)
        .map(normalizeRpcUrl)
        .filter((x): x is string => Boolean(x))
    : []
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
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
  const rpcUrls = getBaseRpcUrls()
  let lastStatus = 502
  let lastError: string | null = null

  for (const rpc of rpcUrls) {
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
    error: lastError || 'RPC proxy failed',
  })
}
