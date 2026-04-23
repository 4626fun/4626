# Acceptance: L-15 — `esm.sh` CDN import in `csw-diag.html`

- **Finding ID:** L-15
- **Linear:** 4626-363
- **Severity (reported):** Low
- **Confidence (reported):** Confirmed
- **Status:** Accepted — file already removed from the tree
- **Source:** Phase 5 SEV-507

## Reported issue

The finding claims `frontend/public/csw-diag.html` loads a third-party
SDK from `https://esm.sh/...` inside a `<script type="module">` block
without an `integrity` attribute, enabling arbitrary code injection if
the `esm.sh` CDN were compromised.

## Current state of the repository

`frontend/public/csw-diag.html` does not exist in the current tree:

```
$ ls frontend/public/csw-diag.html
ls: cannot access 'frontend/public/csw-diag.html': No such file or directory
```

A repository-wide search for any remaining `esm.sh` references in
shippable code returns no results:

```
$ grep -rn "esm.sh" \
    --include="*.html" --include="*.tsx" --include="*.ts" \
    --include="*.mjs" --include="*.js" \
    | grep -v node_modules | grep -v "docs/audits"
(empty)
```

The diagnostic page was removed between the Phase 5 audit snapshot and
the current `main`. No surviving code loads modules from `esm.sh`.

## Controls that prevent regression

1. **CSP `script-src`** (`frontend/vercel.json`) does not allow
   `https://esm.sh` — any re-introduction would be blocked by the
   browser at load time.
2. **`script-src-elem`** (same policy) explicitly enumerates allowed
   origins (Cloudflare challenges, Telegram, Ajax Google APIs, Privy,
   Vercel Live); `esm.sh` is not among them.
3. Any attempt to re-add a diagnostic page pulling from `esm.sh` would
   be caught in review by the CSP allowlist delta.

## Decision

Closed without remediation. File no longer present; CSP prevents
re-introduction. Finding retained in the audit ledger for traceability.

## References

- Phase 5 SEV-507
- `frontend/vercel.json` (CSP `script-src` / `script-src-elem`)
