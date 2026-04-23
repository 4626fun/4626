# Closure — M-28: CSP Deployed as Report-Only (Not Enforced)

- **Finding ID:** M-28 (AUDIT_REPORT.md §Medium)
- **Linear issue:** 4626-337
- **Severity:** Medium
- **Status:** CLOSED — CSP is already enforcing in every header emitted by `frontend/vercel.json` and the two runtime handlers. No code change required.

## Summary of finding

M-28 flags that the production CSP could be deployed with the
`Content-Security-Policy-Report-Only` header rather than the enforcing
`Content-Security-Policy`, meaning XSS and script-injection violations
would only be reported, not blocked.

## Current state (verified 2026-04-22)

The remediation is already in place:

1. **`frontend/vercel.json`** carries a full enforcing `content-security-policy`
   header across every route. The header name is the enforcing variant
   (no `-Report-Only` suffix). `grep -i "report-only" frontend/ -rn`
   returns zero hits outside unrelated comments in `.env.example`.
2. **`frontend/api/_handlers/seo/_seo.ts`** (line ~107) emits a minimal
   enforcing CSP: `default-src 'none'; frame-ancestors 'none'; base-uri 'none'`.
3. **`frontend/api/_handlers/social/_socialPreview.ts`** (line ~870)
   emits an enforcing CSP tailored to the social-preview response.

All three paths use `Content-Security-Policy` as the header name.

## Verification command

Run from the repo root:

```sh
grep -rn -i "content-security-policy-report-only\|csp-report-only" frontend/ \
  | grep -v node_modules
```

Expect zero results. If any enforcement path regresses to
`Content-Security-Policy-Report-Only`, the output will flag it.

## Residual risk

None specific to M-28. Ongoing CSP policy tuning (adding/removing
allowed origins, tightening `script-src` away from `unsafe-inline`) is
tracked separately and is not in scope here.

## Closure criteria

- [x] No `Content-Security-Policy-Report-Only` header emitted anywhere
      in `frontend/` or `api/`.
- [x] `frontend/vercel.json` emits `content-security-policy`
      (enforcing) on every matching route.
- [ ] Add a CI guard rejecting the report-only header in a future
      hardening pass (tracked under Sprint 9 informational cleanup).

## References

- `frontend/vercel.json` — global header set
- `frontend/api/_handlers/seo/_seo.ts`
- `frontend/api/_handlers/social/_socialPreview.ts`
- AUDIT_REPORT.md — M-28
