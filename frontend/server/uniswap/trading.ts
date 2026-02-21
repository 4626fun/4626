import type { VercelRequest } from '@vercel/node'

import { readJsonBody } from '../auth/_shared.js'

type JsonObject = Record<string, unknown>

const DEFAULT_TRADE_API_BASE = 'https://trade.api.uniswap.org/v1'

function getTradeApiBase(): string {
  const raw = (process.env.UNISWAP_TRADE_API_BASE ?? '').trim()
  if (!raw) return DEFAULT_TRADE_API_BASE
  return raw.replace(/\/+$/, '')
}

export function getUniswapApiKey(): string {
  return (process.env.UNISWAP_API_KEY ?? process.env.UNISWAP_API ?? '').trim()
}

export function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export async function readJsonObjectBody(req: VercelRequest): Promise<JsonObject | null> {
  const body = await readJsonBody<unknown>(req, { maxBytes: 2_000_000 })
  if (!isObject(body)) return null
  return body
}

export function toCleanErrorMessage(value: unknown, fallback = 'Uniswap request failed'): string {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 400)
  if (isObject(value)) {
    const message = typeof value.message === 'string' ? value.message : typeof value.error === 'string' ? value.error : ''
    if (message.trim()) return message.trim().slice(0, 400)
  }
  return fallback
}

export async function uniswapTradeFetch(params: {
  path: string
  method: 'POST' | 'GET' | 'PATCH'
  body?: JsonObject
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  timeoutMs?: number
}): Promise<{ status: number; payload: unknown }> {
  const apiKey = getUniswapApiKey()
  if (!apiKey) {
    return {
      status: 503,
      payload: { success: false, error: 'UNISWAP_API_KEY/UNISWAP_API is not configured' },
    }
  }

  const base = getTradeApiBase()
  const url = new URL(`${base}${params.path.startsWith('/') ? params.path : `/${params.path}`}`)
  if (params.query) {
    for (const [k, v] of Object.entries(params.query)) {
      if (v === undefined) continue
      url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    Accept: 'application/json',
    ...params.headers,
  }
  if (params.method !== 'GET') headers['Content-Type'] = 'application/json'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Number(params.timeoutMs ?? 15_000)))
    const res = await fetch(url.toString(), {
      method: params.method,
      headers,
      body: params.method === 'GET' ? undefined : JSON.stringify(params.body ?? {}),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const raw = await res.text()
    let payload: unknown = null
    try {
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = { message: raw || '' }
    }

    return { status: res.status, payload }
  } catch (error: any) {
    const isTimeout = String(error?.name ?? '').toLowerCase() === 'aborterror'
    return {
      status: isTimeout ? 504 : 502,
      payload: {
        success: false,
        error: isTimeout
          ? 'Uniswap API request timed out. Please retry.'
          : toCleanErrorMessage(error?.message, 'Upstream Uniswap API unreachable'),
      },
    }
  }
}
