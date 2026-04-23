# C-03 (4626-361, 4626-362, 4626-365, 4626-370): Image handler SSRF + size/pixel caps

**Status:** Closed — already enforced in code (across multiple
handlers sharing the `fetchBytes` helper)
**Linear:** 4626-361, 4626-362, 4626-365, 4626-370
**Sprint:** 7 (verification-only closure; companion to 4626-360
magic-byte validation added this sprint)

## Findings covered

From `docs/audits/4626/reconciliation/C-03-second-pass-P1-reconciliation.md`:

- Row 2 (4626-361): "Token image endpoint prefers untrusted
  `originalUri`, enabling SSRF — introduce `fetchBytes` scheme+IP
  denylist."
- Row 3 (4626-362): "Unbounded raw image processing DoS — enforce
  `MAX_IMAGE_BYTES` pre-decode and a pixel ceiling."
- Row 7 (4626-365): "SSRF via Zora image fetch in image auto-assets
  handler — `AUTO_ASSET_MAX_BYTES` + destination allowlisting +
  response-size cap."
- Row 12 (4626-370): "SSRF via token image caching to Vercel Blob —
  apply SSRF destination controls; do not persist untrusted fetch
  results."

## Shared helper — `fetchBytes`

`frontend/server/_lib/infra/blob.ts::fetchBytes` (lines 176–241)
is the single fetch primitive used by every image handler in this
audit. It enforces:

- `parseFetchUrl` (lines 104–115): rejects non-`http:` / non-`https:`
  protocols with `fetch_invalid_protocol`.
- `isHostnameResolutionSafe` (lines 87–101): refuses localhost,
  `0.0.0.0`, any IPv4/IPv6 address matched by `isForbiddenIpAddress`
  (covers `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`,
  `100.64/10`, `198.18/15`, multicast, loopback IPv6, ULA, link-local).
- `redirect: 'manual'` (line 207) + `readRedirectUrl` (line 118):
  every hop re-runs the forbidden-host / IP-resolution check; max
  3 redirects.
- `maxBytes` cap (default 10 MiB) — checked first via
  `content-length` header (throws `fetch_too_large` at line 230
  of `blob.ts`; no HTTP status is set by this helper) and then via
  streaming `readResponseBytesWithLimit` (lines 130–161) which
  aborts reads over the cap. Covers both honest and deceitful
  Content-Length.
- `timeoutMs` via `AbortController` (default 8s).
- `requireImageContentType` optional flag that rejects non-image
  MIME in a single check (the token image handler also re-validates
  the actual bytes — see `isLikelyImagePayload`).

## Per-handler verification

### 4626-361, 4626-370 — token image handler

`frontend/api/_handlers/token/_image.ts`:

- Line 1444–1463 `fetchSourceArtworkBytes`: calls `fetchBytes(url, { maxBytes: MAX_SOURCE_IMAGE_BYTES, timeoutMs: SOURCE_FETCH_TIMEOUT_MS })`,
  then checks `isLikelyImagePayload(fetched.bytes, fetched.contentType)`
  and returns `null` on failure. `null` short-circuits the render
  path to the deterministic fallback icon, so no untrusted bytes
  reach `blobPutBytes`.
- Line 2561–2585 cache write path only writes **post-render PNGs
  that the server itself generated via `sharp`** under `tokenKey`.
  The raw untrusted input is never persisted.
- `normalizeSourceArtworkUrl` rejects non-`http`/non-`https` URIs
  and strips any `originalUri` prefix that is not the canonical
  image host, so an attacker cannot coerce the proxy into talking
  to an arbitrary scheme (`file:`, `gopher:`, etc.) even through
  metadata manipulation.

### 4626-362 — pre-decode size + pixel caps

`frontend/api/_handlers/image/_auto-assets.ts`:

- Line 14: `const AUTO_ASSET_MAX_BYTES = 10 * 1024 * 1024`.
- Line 157: byte-length pre-check before `sharp`.
- Line 160: `sharp(..., { limitInputPixels: AUTO_ASSET_MAX_PIXELS })`.
- Lines 162–166: explicit metadata read + dimension + pixel-count
  check; rejects oversized inputs before any composition work.

Together these enforce the pixel ceiling against both declared
dimensions (via `sharp.metadata()`) and actual dimensions (via
`limitInputPixels`, which causes `sharp` to throw during decode
if the image exceeds the limit).

### 4626-365 — Zora image auto-assets

`frontend/api/_handlers/image/_auto-assets.ts` line 311–312:
`fetchBytes(subjectUrl, { maxBytes: AUTO_ASSET_MAX_BYTES, ... })`.
The `subjectUrl` passes through `normalizeSubjectUrl` which rejects
anything outside the `zora.co` / `ipfs.io` / whitelisted CDN set,
and `fetchBytes` enforces the SSRF IP denylist on the resolved
host regardless. Destination allowlist + response-size cap are
therefore layered.

Regression coverage:
`frontend/api/__tests__/imageAutoAssetsSecurity.test.ts` asserts:

- `file://` URL rejected before network
- RFC1918 hostname rejected after DNS resolution
- oversized body aborted mid-stream

### Companion — 4626-360 (MIME magic)

`frontend/api/_handlers/image/_external-proxy.ts` magic-byte
validation was added in the previous commit (`fix(image-proxy):
validate image magic bytes + strict MIME allowlist`). The combined
defence-in-depth pattern for the four findings above is:

1. Scheme + IP denylist (fetchBytes / parseFetchUrl)
2. Destination allowlist (per-handler `normalize*` helper)
3. Response size cap, pre- and during-stream (fetchBytes)
4. Pixel-count ceiling before decode (sharp `limitInputPixels`)
5. Content-Type MIME allowlist + magic-byte sniff (external-proxy)
6. No-persist for untrusted bytes; cache writes only for
   server-rendered PNGs (token/_image)

## Residual risk

- `fetchBytes` does not implement per-redirect cumulative budget.
  3 redirects × 8s timeout × MAX_BYTES stream could still tie up
  a serverless function for ~24s of wall time in a pathological
  case. Acceptable under the 10s Vercel default, but worth tracking
  if limits change.
- The forbidden-IP list is static. DNS rebinding after a successful
  first lookup (TOCTOU between `lookup` in `isHostnameResolutionSafe`
  and the actual `fetch` that re-resolves the hostname) is still
  theoretically possible against hostile CDNs. Mitigation would
  require passing the resolved IP address directly to `fetch` with
  a host header — deferred, not in scope for Sprint 7.

Fixes: 4626-361 (C-03 P1 #2), 4626-362 (C-03 P1 #3), 4626-365 (C-03 P1 #7), 4626-370 (C-03 P1 #12)
