/**
 * AlfaClub API proxy.
 *
 * Why this exists: Cloudflare's bot-fight challenge ("Just a moment...")
 * was rejecting the AlfaClub chat bridge's outbound calls from Vercel
 * egress IPs. The 4626 frontend already supports a routing/fingerprint
 * split (`ALFACLUB_CHAT_API_PROXY_URL` + `ALFACLUB_CHAT_API_BASE_URL`)
 * so requests can be sent to a clean origin while still presenting the
 * `Origin: https://alfaclub.app` browser fingerprint.
 *
 * This Worker is that clean origin. It:
 *   - accepts requests from the bridge (gated by `x-proxy-secret`),
 *   - rewrites them to the configured `UPSTREAM_API_BASE`,
 *   - strips Cloudflare-injected headers that would confuse the
 *     upstream WAF,
 *   - preserves the bridge's existing browser fingerprint headers
 *     (User-Agent, Origin, Referer, sec-ch-ua*, Sec-Fetch-*),
 *   - forwards the response unchanged.
 *
 * It is NOT a JWT minter, NOT a token store, and NEVER inspects
 * request bodies. The only auth state in this Worker is the
 * shared-secret gate.
 */

interface Env {
  UPSTREAM_API_BASE: string
  ALLOWED_PATH_PREFIXES: string
  EDGE_CACHE_TTL_SECONDS: string
  PROXY_SHARED_SECRET: string
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-authenticate',
  'upgrade',
])

// Cloudflare adds these on every inbound request — they must NOT be
// forwarded upstream or the receiving CF zone (alfaclub.app's) will
// see contradictory metadata and re-challenge.
const CF_INJECTED = new Set([
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-warp-tag-id',
  'cf-worker',
  'cf-ew-via',
  'cdn-loop',
  'true-client-ip',
  'x-real-ip',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-forwarded-host',
])

// Headers we should not let the bridge override on the response side.
const RESPONSE_STRIP = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
])

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}


function normalizeSharedSecret(value: unknown): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''
  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return normalized.slice(1, -1).trim()
  }
  return normalized
}

function isAllowedPath(pathname: string, allowed: string[]): boolean {
  return allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}?`) || pathname.startsWith(`${prefix}/`))
}

function buildUpstreamHeaders(req: Request): Headers {
  const next = new Headers()
  for (const [name, value] of req.headers) {
    const lower = name.toLowerCase()
    if (HOP_BY_HOP.has(lower)) continue
    if (CF_INJECTED.has(lower)) continue
    if (lower === 'host') continue           // Let fetch() set Host from the upstream URL.
    if (lower === 'x-proxy-secret') continue // Auth gate — never forward.
    next.set(name, value)
  }
  return next
}

function buildResponseHeaders(upstream: Response, requestId: string): Headers {
  const next = new Headers()
  for (const [name, value] of upstream.headers) {
    const lower = name.toLowerCase()
    if (RESPONSE_STRIP.has(lower)) continue
    next.set(name, value)
  }
  // Surface a stable correlation id back to the bridge so we can
  // cross-reference Worker logs with `tick.errors[]`. Use the
  // Worker's own cf-ray when present; otherwise mint a short id.
  next.set('x-proxy-request-id', requestId)
  next.set('x-proxy', 'alfaclub-proxy')
  // The bridge's existing CF-detail extractor reads upstream `cf-ray`
  // verbatim, so we leave that header untouched.
  return next
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)

    // Health probe — useful during deploy.
    if (url.pathname === '/_health' && req.method === 'GET') {
      return jsonResponse(200, { ok: true, upstream: env.UPSTREAM_API_BASE })
    }

    // Method allowlist. The bridge sends GET (history) and POST (mark-read);
    // HEAD/OPTIONS are bodyless probes and preflight-style requests.
    const bodylessMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
    if (!bodylessMethod && req.method !== 'POST') {
      return jsonResponse(405, { error: 'method_not_allowed' })
    }

    // Shared-secret gate. Constant-time compare to avoid timing leaks
    // (Workers' default string compare is fine for this length, but
    // we use a manual XOR for clarity).
    const presented = normalizeSharedSecret(req.headers.get('x-proxy-secret'))
    const expected = normalizeSharedSecret(env.PROXY_SHARED_SECRET)
    if (!expected) {
      return jsonResponse(503, { error: 'proxy_misconfigured:no_secret' })
    }
    if (!constantTimeEqual(presented, expected)) {
      return jsonResponse(401, { error: 'unauthorized' })
    }

    // Path allowlist.
    const allowed = (env.ALLOWED_PATH_PREFIXES ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!isAllowedPath(url.pathname, allowed)) {
      return jsonResponse(404, { error: 'path_not_allowed', path: url.pathname })
    }

    // Build the upstream URL, preserving query string verbatim.
    let upstreamBase: URL
    try {
      upstreamBase = new URL(env.UPSTREAM_API_BASE)
    } catch {
      return jsonResponse(503, { error: 'proxy_misconfigured:bad_upstream' })
    }
    const upstreamUrl = new URL(url.pathname + url.search, upstreamBase)

    const requestId = req.headers.get('cf-ray') ?? crypto.randomUUID()
    const upstreamHeaders = buildUpstreamHeaders(req)

    // Streaming body passthrough. POST `/update_read_msg` carries a
    // small JSON body; never read it here, just forward.
    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: req.method,
      headers: upstreamHeaders,
      body: bodylessMethod ? undefined : req.body,
      redirect: 'manual',
    })

    let upstream: Response
    try {
      upstream = await fetch(upstreamRequest, {
        // Skip Cloudflare's edge cache for chat history. Stale data
        // here would directly cause `/gmeow` to be missed.
        cf: {
          cacheTtl: Number(env.EDGE_CACHE_TTL_SECONDS) || 0,
          cacheEverything: false,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return jsonResponse(502, {
        error: 'upstream_fetch_failed',
        detail: message.slice(0, 200),
        requestId,
      })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildResponseHeaders(upstream, requestId),
    })
  },
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
