# M-12 / 4626-424 — Gate `POST /api/agent/creative` behind session auth

## Severity
MEDIUM · Category: Authentication / Abuse of paid LLM resource

## Finding (from Codex audit 2026-04-23)
`frontend/api/_handlers/agent/_creative.ts` is reachable without authentication. The
handler jumps straight from the method check into `getClientIp` → IP rate limit →
`generateCreativeEnvelope`, which ultimately calls the Eliza LLM service. Any
unauthenticated caller on the public internet can burn the project's LLM quota
and exfiltrate generated marketing copy that is otherwise gated to logged-in
creators.

Peer agent endpoint `frontend/api/_handlers/agent/_stream.ts` already enforces
the correct pattern using `readSessionFromRequest` + address-shape guard + 401.

## Fix
Insert the standard session-cookie guard before `getClientIp`, matching the
`_stream.ts` pattern verbatim:

```ts
const session = readSessionFromRequest(req)
const sessionAddress = String(session?.address ?? '').trim().toLowerCase()
if (!/^0x[a-f0-9]{40}$/.test(sessionAddress)) {
  return res.status(401).json({ success: false, error: 'Unauthorized' })
}
```

Rate limiting is tightened to apply both per-IP and per-principal windows so a
logged-in attacker who rotates IPs cannot bypass the quota. Reserves the
`agent-creative-principal:<address>` key under the existing `RATE_LIMITS.agentCreative`
budget.

## Files changed
- `frontend/api/_handlers/agent/_creative.ts` (+16 / -5)

## Acceptance
1. Unauthenticated `POST /api/agent/creative` returns 401 `Unauthorized`.
2. Authenticated session with a valid SIWE cookie returns the envelope as
   before, with `X-RateLimit-*` headers reflecting the tighter of the IP and
   principal windows.
3. 24 requests in 60 s from the same session hit 429 independent of source IP.

## Rollback
Revert this PR. No DB migration, no env changes.

## References
- Peer pattern: `frontend/api/_handlers/agent/_stream.ts` lines 37–65
- Codex finding id: `0f3d0c49-9d3a-4f5e-b55a-2a6b1f8b7a1a` (row 26 of
  `codex-security-findings-2026-04-23T18-31-56.185Z.csv`)
