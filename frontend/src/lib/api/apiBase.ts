import { getStoredSiwaReceipt } from '@/lib/auth/siwaReceiptStorage'

// Centralized API URL helper.
//
// Some privacy/adblock extensions block requests to `/api/*` by pattern.
// We expose a stable alias `/__api/*` and prefer it, with a fallback to `/api/*`
// for local dev or older deployments.

export type ApiFetchInit = RequestInit & { withCredentials?: boolean }

// Some deployments don’t route `/__api/*` to the API function for non-GETs,
// which causes noisy 405s in the console before we fall back to `/api/*`.
// Cache that signal per page load so we stop probing the alias repeatedly.
let aliasNonGetDisabledUntil = 0

export function apiAliasPath(path: string): string {
  if (typeof path !== 'string') return path as any
  if (!path.startsWith('/api/')) return path
  return `/__api/${path.slice('/api/'.length)}`
}

function joinBase(base: string, path: string): string {
  const b = String(base || '').replace(/\/+$/, '')
  if (!b) return path
  return `${b}${path}`
}

function isProbablyHtml(res: Response): boolean {
  const ct = (res.headers.get('content-type') ?? '').toLowerCase()
  return ct.includes('text/html')
}

async function shouldTreat404AsRouteMiss(res: Response): Promise<boolean> {
  const ct = (res.headers.get('content-type') ?? '').toLowerCase()
  if (!ct.includes('application/json')) return true
  const responseReader =
    typeof (res as { clone?: unknown }).clone === 'function'
      ? (res as Response).clone()
      : (res as { json?: () => Promise<unknown> })
  const payload =
    typeof (responseReader as { json?: unknown }).json === 'function'
      ? await (responseReader as { json: () => Promise<unknown> }).json().catch(() => null)
      : null
  const error =
    payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
      ? (payload as { error: string }).error.trim().toLowerCase()
      : ''

  // Our catch-all resolver returns this for unknown routes. Retry remaining
  // alias/base candidates in that case.
  return error === 'not found'
}

/**
 * Fetch an API route with a best-effort alias fallback:
 * - try `/__api/*` first (to avoid extension blocks on `/api/*`)
 * - then fall back to `/api/*`
 *
 * If `bases` is provided, the function will try each base origin in order.
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}, bases?: string[]): Promise<Response> {
  const withCreds = Boolean(init.withCredentials)
  // Best-effort: attach our SIWE session token when present.
  // This allows authenticated routes to work even when cookies are unavailable.
  const headers = new Headers(init.headers ?? undefined)
  if (typeof window !== 'undefined' && path.startsWith('/api/') && !headers.has('Authorization')) {
    try {
      const token = sessionStorage.getItem('cv_siwe_session_token')
      if (token && token.trim()) headers.set('Authorization', `Bearer ${token.trim()}`)
    } catch {
      // ignore
    }
  }

  // Attach SIWA receipt for agent API calls when available.
  if (
    typeof window !== 'undefined' &&
    path.startsWith('/api/v1/agents/') &&
    !headers.has('X-SIWA-Receipt')
  ) {
    const receipt = getStoredSiwaReceipt()
    if (receipt) headers.set('X-SIWA-Receipt', receipt)
  }

  const baseInit: RequestInit = {
    ...init,
    headers,
    ...(withCreds ? { credentials: 'include' as const } : null),
  }
  delete (baseInit as any).withCredentials

  const method = String((baseInit as any)?.method || 'GET').toUpperCase()
  const canTryAlias = !(
    method !== 'GET' &&
    method !== 'HEAD' &&
    typeof window !== 'undefined' &&
    Date.now() < aliasNonGetDisabledUntil
  )
  const tryPaths = path.startsWith('/api/') ? (canTryAlias ? [apiAliasPath(path), path] : [path]) : [path]
  const baseList = Array.isArray(bases) && bases.length > 0 ? bases : ['']
  const alias = path.startsWith('/api/') ? apiAliasPath(path) : null

  let lastErr: unknown = null
  for (let baseIndex = 0; baseIndex < baseList.length; baseIndex += 1) {
    const base = baseList[baseIndex]!
    for (let pathIndex = 0; pathIndex < tryPaths.length; pathIndex += 1) {
      const p = tryPaths[pathIndex]
      const hasNextAttempt = pathIndex < tryPaths.length - 1 || baseIndex < baseList.length - 1
      const url = joinBase(base, p!)
      try {
        const res = await fetch(url, baseInit)
        // In dev, Vite may serve index.html for unknown paths; treat that as a miss.
        if (isProbablyHtml(res)) continue
        // Try remaining path/base fallbacks only when 404 looks like a route
        // miss. Some APIs (including Uniswap routes) use 404 for meaningful
        // business errors, and those should be surfaced immediately.
        if (res.status === 404 && hasNextAttempt && (await shouldTreat404AsRouteMiss(res))) continue
        // Some deployments serve `/__api/*` as static content, which returns 405 on POST.
        // Treat that as a miss so we fall back to the real `/api/*` handlers.
        if (alias && p === alias && res.status === 405) {
          if (typeof window !== 'undefined' && method !== 'GET' && method !== 'HEAD') {
            aliasNonGetDisabledUntil = Date.now() + 10 * 60_000
          }
          continue
        }
        return res
      } catch (e: unknown) {
        lastErr = e
        continue
      }
    }
  }
  throw lastErr ?? new Error('Request failed')
}
