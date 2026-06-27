# L-12 / L-13 / L-17: `VITE_` Env Vars Exposed to Browser Bundle

**Status:** Closed — accepted as intentional (public identifiers)
**Linear:** 4626-360 (L-12), 4626-361 (L-13), 4626-365 (L-17)
**Sprint:** 8 (acceptance-doc closure)

## Findings

- **L-12**: `VITE_PRIVY_APP_ID` and `VITE_PRIVY_CLIENT_ID` are bundled client-side.
- **L-13**: `VITE_ZORA_PUBLIC_API_KEY` is bundled client-side.
- **L-17**: `VITE_CDP_PAYMASTER_URL` is bundled client-side.

## Verification

The `VITE_` prefix is a Vite convention signalling "this value will be
inlined into the browser bundle". Every key listed above is an
identifier the client-side SDKs require at init time, and each vendor
considers their value appropriate for public exposure:

| Var | Vendor guidance | Current state |
|---|---|---|
| `VITE_PRIVY_APP_ID` | Privy docs explicitly document the app id as a public identifier. | Unchanged; safe to expose. |
| `VITE_PRIVY_CLIENT_ID` | Also public per Privy's OAuth model. | Unchanged; safe to expose. |
| `VITE_ZORA_PUBLIC_API_KEY` | `frontend/.env.example:14` already labels this `Public key (safe to expose; restrict Allowed Origins in Zora)`. | Unchanged; Zora dashboard must restrict Allowed Origins. |
| `VITE_CDP_PAYMASTER_URL` | This is a path to the local API route `/api/paymaster` by default (`frontend/.env.example:108`), not a full external URL with embedded credentials. | Unchanged; production overrides MUST NOT include credentials in path/query. |

## Required operator action

1. **Zora dashboard**: confirm `Allowed Origins` is restricted to
   `https://4626.fun` + known preview domains. Without the origin
   restriction, `VITE_ZORA_PUBLIC_API_KEY` can be extracted and used
   from any origin.
2. **`VITE_CDP_PAYMASTER_URL`**: if any environment sets this to a
   full URL that includes an API key in the path or query string,
   remove it. The correct pattern is to keep `VITE_CDP_PAYMASTER_URL`
   pointing at `/api/paymaster` and let the server-side handler
   inject any vendor credentials from non-`VITE_` env vars.

## Regression control

`.github/workflows/env-example-address-check.yml` (added in Sprint 6)
scans `.env.example` files for live addresses. A companion rule for
URL-credential patterns (`VITE_*_URL=.*apiKey=|.*token=|.*secret=`)
is listed as a Sprint 9 follow-up to catch the
`VITE_CDP_PAYMASTER_URL` misconfiguration class at CI time.

## Residual risk

- A compromised developer workstation that exports a `.env` file
  containing a non-public value under a `VITE_` key will leak that
  value into the next build. Pre-commit secret scanning (L-22
  remediation, also Sprint 8) partially mitigates this.

Fixes: 4626-360 (L-12), 4626-361 (L-13), 4626-365 (L-17)
