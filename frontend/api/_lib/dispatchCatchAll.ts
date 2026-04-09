import type { VercelRequest, VercelResponse } from '@vercel/node'
import { enforceCookieSessionTrustedOrigin, setNoStore } from '../../packages/server-core/src/auth.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>
const MAX_API_SUBPATH_LENGTH = 256
const ALLOWED_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])

function firstQueryPathSegment(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : String(entry)))
      .filter(Boolean)
      .join('/')
  }
  return ''
}

function normalizePrefix(prefix: string): string {
  const trimmed = String(prefix ?? '').trim()
  if (!trimmed) return '/api/'
  if (trimmed.endsWith('/')) return trimmed
  return `${trimmed}/`
}

function normalizeSubpath(value: string): string {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return ''
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

function getApiSubpath(req: VercelRequest, prefixes: string[]): string {
  const query = (req as any)?.query
  const hasExplicitQueryPath =
    query != null &&
    typeof query === 'object' &&
    Object.prototype.hasOwnProperty.call(query, 'path')
  const qp = normalizeSubpath(firstQueryPathSegment(query?.path))
  if (qp || hasExplicitQueryPath) return qp

  const rawUrl = typeof req.url === 'string' ? req.url : ''
  const pathname = (rawUrl.split('?')[0] ?? '').trim()
  if (!pathname) return ''

  for (const prefix of prefixes.map(normalizePrefix)) {
    const exact = prefix.slice(0, -1)
    if (pathname === exact || pathname === `${exact}/`) return ''
    if (pathname.startsWith(prefix)) return normalizeSubpath(pathname.slice(prefix.length))
  }

  if (pathname.startsWith('/')) return normalizeSubpath(pathname.slice(1))
  return normalizeSubpath(pathname)
}

function isSafeSubpath(p: string): boolean {
  if (p === '') return true
  if (!p) return false
  if (p.length > MAX_API_SUBPATH_LENGTH) return false
  if (p.includes('\\')) return false
  if (p.includes('..')) return false
  if (p.includes('%')) return false
  if (p.includes('\0')) return false
  return /^[a-zA-Z0-9/_\.-]+$/.test(p)
}

function setApiSecurityHeaders(res: VercelResponse) {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
  } catch {
    // ignore header errors in edge cases where the response is already finalized
  }
}

export async function dispatchCatchAllRequest(params: {
  req: VercelRequest
  res: VercelResponse
  prefixes: string[]
  resolveHandler: (subpath: string) => Promise<ApiHandler | null>
  routeLabel?: string
  jsonRpcCompatSubpath?: string
}) {
  const { req, res, prefixes, resolveHandler, routeLabel = 'api', jsonRpcCompatSubpath } = params

  let subpath = ''
  try {
    setApiSecurityHeaders(res)
    const method = String(req.method ?? '').trim().toUpperCase()
    if (!ALLOWED_HTTP_METHODS.has(method)) {
      setNoStore(res)
      return res.status(405).json({ success: false, error: 'Method not allowed' })
    }

    subpath = getApiSubpath(req, prefixes)
    if (!isSafeSubpath(subpath)) {
      setNoStore(res)
      return res.status(404).json({ success: false, error: 'Not found' })
    }

    const handler = await resolveHandler(subpath)
    if (!handler) {
      setNoStore(res)
      return res.status(404).json({ success: false, error: 'Not found' })
    }

    if (enforceCookieSessionTrustedOrigin(req, res)) {
      return
    }

    return await handler(req, res)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[${routeLabel}] Unhandled route error`, {
      route: subpath || '(unknown)',
      error: errorMessage || 'unknown_error',
    })

    if (jsonRpcCompatSubpath && subpath === jsonRpcCompatSubpath) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'request denied - paymaster proxy internal error',
        },
      })
    }

    setNoStore(res)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
