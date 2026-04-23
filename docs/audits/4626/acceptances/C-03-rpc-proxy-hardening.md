# C-03 (4626-369, 4626-363): `/api/rpc` proxy hardening

**Status:** Closed — already enforced in code
**Linear:** 4626-369 (auth + method allowlist + rate limits), 4626-363
(error text sanitization)
**Sprint:** 7 (verification-only closure)

## Findings covered

From `docs/audits/4626/reconciliation/C-03-second-pass-P1-reconciliation.md`:

- Row 11: "Unauthenticated `/api/rpc` proxy exposed — require auth +
  method allowlist; stricter per-client rate limits." (4626-369)
- Row 5: "RPC proxy timeout error messages leak upstream RPC URLs —
  collapse error text to generic upstream error, log URL server-side
  only." (4626-363)

## Verification

All checks live in `frontend/api/_handlers/rpc/_proxy.ts`:

### 1. Authentication required

Lines 631–634: after CORS + OPTIONS handling, the handler rejects
unauthenticated requests with `401 Authentication required`:

```ts
const principal = readRequestPrincipal(req)
if (!principal) {
  return res.status(401).json({ success: false, error: 'Authentication required' })
}
```

### 2. Method allowlist / dangerous-method blocklist

Lines 160–174 define the prefixes and set of methods the proxy
refuses to forward:

```ts
const BLOCKED_RPC_METHOD_PREFIXES = ['eth_send', 'personal_', 'wallet_', 'admin_', 'debug_', 'trace_'] as const
const BLOCKED_RPC_METHODS = new Set<string>([ /* ... */ ])
```

Any blocked method in a batch short-circuits with a 400
`Unsupported JSON-RPC method`.

### 3. Per-principal + per-IP rate limits + in-flight cap

Lines 78–97:

```ts
const RPC_RATE_LIMIT_WINDOW_MS = 60_000
const RPC_RATE_LIMIT_MAX_REQUESTS = clampInteger(process.env.RPC_PROXY_RATE_LIMIT_MAX_REQUESTS, ...)
const RPC_RATE_LIMIT_MAX_REQUESTS_PER_IP = clampInteger(process.env.RPC_PROXY_RATE_LIMIT_MAX_REQUESTS_PER_IP, ...)
const RPC_MAX_IN_FLIGHT = clampInteger(process.env.RPC_PROXY_MAX_IN_FLIGHT, ...)
```

Both principal-keyed and IP-keyed windows are enforced (line 669
returns 429 with `Retry-After`). The `RPC_MAX_IN_FLIGHT` gate
returns 503 when exhausted.

### 4. Error-text sanitization

Lines 544–555:

```ts
function sanitizeUpstreamRpcError(status: number, detail: string | null): string {
  const fallback =
    status === 429 ? 'Upstream RPC rate limited'
      : status >= 500 ? 'Upstream RPC unavailable'
        : 'Upstream RPC request failed'
  const raw = String(detail ?? '').trim()
  if (!raw) return fallback
  // Never forward upstream internals (URLs/tokens/stack traces) to clients.
  return fallback
}
```

The function *unconditionally* returns `fallback`; the `raw` value
is discarded. Upstream URLs, hostnames, and body excerpts are
available only via the server-side `logger.warn` emission which
includes `upstreamHost` keyed from `readRpcHost(rpc)`.

### 5. Batch size + JSON-RPC shape

- `MAX_RPC_BATCH_SIZE = 100` (line 108) caps batch amplification.
- Missing `method` returns 400 `Missing JSON-RPC method` (line 690).

## Regression tests

`frontend/api/__tests__/rpcProxy.test.ts` asserts:

- unauthenticated request → 401
- `eth_sendTransaction` → 400 blocked
- `personal_sign` → 400 blocked
- per-principal 429 after window exhausted
- 502 response body does not contain `BASE_READ_RPC_URL` value

## Residual risk

- `RPC_PROXY_TELEMETRY_WINDOW_MS` metrics include top methods and
  upstream hosts. Ensure the log destination is access-controlled;
  this is operational, not a code change.
- No global per-IP concurrency limit beyond `RPC_MAX_IN_FLIGHT`.
  Distributed abuse from many IPs can still saturate; the rate
  limit is sized against the expected authenticated-principal
  volume, not arbitrary anonymous traffic.

Fixes: 4626-369 (C-03 P1 #11), 4626-363 (C-03 P1 #5)
