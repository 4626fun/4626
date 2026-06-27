# M-10 / 4626-421 — Drop spoofable `cf-connecting-ip` from `getClientIp`

## Severity
MEDIUM · Category: Rate-limit / spoofing

## Finding (from Codex audit 2026-04-23)
`getClientIp` in `frontend/server/_lib/infra/rateLimit.ts` trusts the
`cf-connecting-ip` HTTP header when determining the client IP. The project is
fronted by **Vercel, not Cloudflare**, so nothing in the request path
verifies or strips that header. A caller can attach any value and get a unique
"client IP" per request, bypassing IP-scoped rate limits and poisoning audit
logs.

## Fix
Remove `cf-connecting-ip` from the header priority list. Only
`x-vercel-forwarded-for` (stamped by the Vercel edge) is security-trustworthy;
`x-real-ip` and `x-forwarded-for` remain as conservative dev/preview fallbacks
(they are still spoofable but are never used as a security boundary on their
own — security-sensitive endpoints join the IP key with a session principal).

If this deployment ever moves behind Cloudflare in front of Vercel,
`cf-connecting-ip` can be reintroduced under a feature flag that asserts
Cloudflare is the true edge.

## Files changed
- `frontend/server/_lib/infra/rateLimit.ts` (+17 / -5)

Note: `frontend/packages/server-core/src/rate-limit.ts` re-exports from the
infra file, so the server-core barrel automatically picks up the fix. No other
files reference `cf-connecting-ip`.

## Acceptance
1. `getClientIp({ headers: { 'cf-connecting-ip': '1.2.3.4' } })` returns
   `'unknown'` (ignored).
2. `getClientIp({ headers: { 'x-vercel-forwarded-for': '9.9.9.9' } })` returns
   `'9.9.9.9'`.
3. When `x-vercel-forwarded-for` is absent, `x-real-ip` and `x-forwarded-for`
   are still honored in that order.
4. Rate-limit buckets on `agent-creative` (M-12), `auth-privy`,
   `solana-route-provision`, and all other IP-scoped keys no longer reset per
   spoofed `cf-connecting-ip` value.

## Rollback
Revert this PR. No DB migration, no env changes.

## References
- Companion: `packages/server-core/src/rate-limit.ts` (pure re-export)
- Codex finding id: row 10 of `codex-security-findings-2026-04-23T18-31-56.185Z.csv`
