import type { VercelRequest, VercelResponse } from '@vercel/node'

import { dispatchCatchAllRequest } from './_lib/dispatchCatchAll.js'

const PRIVY_PROXY_HOST = 'privy.4626.fun'
const PRIVY_PROXY_UPSTREAM = 'https://auth.privy.io'

function shouldProxyToPrivyUpstream(req: VercelRequest): boolean {
  const host = String(req.headers?.host ?? '')
    .trim()
    .toLowerCase()
  return host === PRIVY_PROXY_HOST
}

function buildPrivyProxyUrl(req: VercelRequest): string | null {
  const raw = String(req.url ?? '').trim()
  if (!raw.startsWith('/api/')) return null
  return `${PRIVY_PROXY_UPSTREAM}${raw}`
}

function toProxyBody(req: VercelRequest): string | Buffer | undefined {
  const method = String(req.method ?? 'GET')
    .trim()
    .toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return undefined
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body
  if (req.body == null) return undefined
  return JSON.stringify(req.body)
}

async function proxyPrivyRequest(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!shouldProxyToPrivyUpstream(req)) return false

  const targetUrl = buildPrivyProxyUrl(req)
  if (!targetUrl) return false

  const upstreamHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (!value) continue
    const lower = key.toLowerCase()
    if (lower === 'host' || lower === 'content-length') continue
    if (Array.isArray(value)) {
      upstreamHeaders[key] = value.join(', ')
    } else {
      upstreamHeaders[key] = value
    }
  }

  const upstreamResponse = await fetch(targetUrl, {
    method: req.method,
    headers: upstreamHeaders,
    body: toProxyBody(req),
    redirect: 'manual',
  })

  res.status(upstreamResponse.status)
  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    res.setHeader(key, value)
  })

  if (req.method?.toUpperCase() === 'HEAD') {
    res.end()
    return true
  }

  const text = await upstreamResponse.text()
  res.send(text)
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (await proxyPrivyRequest(req, res)) return

  const { getApiHandler } = await import('./_handlers/_routes.js')
  return dispatchCatchAllRequest({
    req,
    res,
    prefixes: ['/api/', '/__api/'],
    resolveHandler: getApiHandler,
    routeLabel: 'api',
    jsonRpcCompatSubpath: 'paymaster',
  })
}
