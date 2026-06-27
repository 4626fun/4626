# Security Audit: 4626 Frontend — Auth, Wallet & Deploy Flows

**Audit Date:** 2025-07-14  
**Scope:** `frontend/` — authentication, wallet integration, deploy flows, API routes, middleware, config  
**Auditor:** Automated static analysis via code review  
**Repository:** `wenakita/4626`

---

## Executive Summary

The 4626 frontend implements a multi-phase vault deployment system backed by Coinbase Smart Wallets (CSW), Privy for embedded EOA management, and a session-token-based API gateway. The codebase demonstrates generally solid defensive programming — timing-safe comparisons, nonce consumption, parametrized SQL, CORS origin allowlisting, and HMAC-signed session tokens. However, several significant security gaps exist, including a critical CSRF bypass window, a high-severity secret fallback that produces ephemeral in-process keys on misconfiguration, a Privy JWT returned in cleartext to clients, and a paymaster proxy with no per-user gas spending limits. These are detailed below in order of severity.

---

## Findings

---

### FINDING-01 — CRITICAL: Ephemeral In-Process Secret for Session Tokens on `AUTH_SESSION_SECRET` Misconfiguration

**File:** `frontend/server/auth/_shared.ts`, ~line 375  
**Severity:** CRITICAL  
**Category:** Credential Handling / Session Security

**Code:**
```typescript
function getSessionSecret(): string {
  const env = process.env.AUTH_SESSION_SECRET
  if (typeof env === 'string' && env.trim().length >= 16) return env.trim()

  const g: any = globalThis as any
  if (!g.__4626_auth_secret) g.__4626_auth_secret = randomBytes(32).toString('hex')
  return String(g.__4626_auth_secret)
}
```

**Observation:**  
If `AUTH_SESSION_SECRET` is absent or shorter than 16 characters, the code silently falls through to generate a random key stored in `globalThis`. On serverless (Vercel) deployments each function invocation typically starts in a fresh isolate, meaning the in-process key is discarded after every cold start. This produces a situation where:

1. Every cold start invalidates all existing sessions — a silent availability break.
2. More critically, if two concurrent invocations race, they each produce a different key. Any session token signed by invocation A is rejected by invocation B. In a multi-region deployment this is a persistent "split brain" where sessions are intermittently valid.
3. In a worst case (e.g., a staging/preview deployment where `AUTH_SESSION_SECRET` was never set), an operator could believe sessions are working (they do on warm paths) while cold-start requests produce forged-looking 401 errors, masking the misconfiguration.
4. The same secret is shared between session tokens and nonce tokens (`makeNonceToken`). A nonce token is returned to the client. If an attacker can extract the nonce token they cannot directly recover the secret (HMAC is one-way), but the shared-secret design adds attack surface.

**Attack Scenario:**  
Operator deploys to a new environment, forgets `AUTH_SESSION_SECRET`. All sessions work "most of the time" because warm lambdas share a key within the same process lifetime. An attacker who can force cold starts (e.g., by triggering a deployment, or waiting for timeout) causes intermittent auth failures that obscure the underlying misconfiguration. In a multi-region Vercel deployment the ephemeral key is **per-region per-cold-start**, causing active sessions to become invalid cross-region, potentially forcing re-authentication flows that can be phished.

**Fix:**  
Remove the silent fallback entirely. If `AUTH_SESSION_SECRET` is absent or < 32 bytes, throw at startup with a clear error message. Add a startup check (e.g., in a Vercel `_middleware.ts` or a dedicated health-check endpoint) that validates required secrets exist before accepting requests.

**Same pattern exists for the handoff HMAC:**  
`frontend/server/auth/_handoff.ts`, `getHandoffHashSecret()` uses the same globalThis fallback with a lower-bound of only 16 characters (env var name `AUTH_SESSION_SECRET`).

---

### FINDING-02 — HIGH: Privy JWT Token Returned in Cleartext API Response

**File:** `frontend/api/_handlers/auth/_handoff-redeem.ts`, ~line 70  
**File:** `frontend/api/_handlers/auth/_privy.ts`, ~line 185  
**Severity:** HIGH  
**Category:** Credential Handling / Token Leakage

**Code (`_handoff-redeem.ts`):**
```typescript
return res.status(200).json({
  success: true,
  data: {
    address: consumed.address,
    sessionToken,
    privyToken: consumed.privyToken,  // <-- Privy JWT returned verbatim
  } satisfies HandoffRedeemResponse,
})
```

**Code (`_privy.ts`):**
```typescript
return res.status(200).json({
  success: true,
  data: { address: sessionAddress, sessionToken, privyUserId: claims.userId } satisfies PrivyVerifyResponse,
})
```

**Observation:**  
The handoff-redeem endpoint returns the raw Privy JWT (`privyToken`) to the client in the JSON body. This token was originally stored in the `auth_handoffs` table (in the `privy_token` column) and is consumed/nulled on read (`SET consumed_at = NOW(), privy_token = NULL`). The single-use store-and-delete is correct.

However, the token still travels over the wire in the response body. If the TLS connection is terminated by a misconfigured proxy, a CDN that logs bodies, or if the client-side JS stores it insecurely (localStorage, unprotected memory), the Privy JWT is exposed. Privy JWTs carry user identity and can be used to interact with the Privy API if the app secret is also compromised. Additionally, `privyUserId` is exposed in the `/api/auth/privy` response — low-value on its own but should not be needed client-side.

Additionally, the `sessionToken` is returned in the JSON response body **in addition to** being set as an HttpOnly cookie. Returning it in the body defeats the purpose of HttpOnly cookies (which protect against XSS). Any XSS vulnerability anywhere on the page can now read the session token from the API response JSON and exfiltrate it.

**Attack Scenario:**  
XSS vulnerability in the application's token-rendering code (vault names, creator names, etc.) allows an attacker to hook the `/api/auth/privy` or handoff-redeem AJAX response and read `sessionToken` from `data.sessionToken`. The attacker now has a fully valid 7-day session token they can use in Authorization headers from any origin.

**Fix:**  
1. Do not return `sessionToken` in the response body. The client can rely on the HttpOnly cookie alone. If embedded contexts need a bearer token, issue a short-lived (≤1h) separate "bearer-only" token that cannot be used for privileged deploy operations.
2. Do not return `privyToken` in the handoff-redeem response. If the client needs to re-establish a Privy session, have it re-authenticate with Privy directly rather than passing through a stored JWT.
3. Do not return `privyUserId` in the `/api/auth/privy` response — it is unnecessary for client operation.

---

### FINDING-03 — HIGH: CSRF Protection Bypass via Explicit Bearer Token Header

**File:** `frontend/server/auth/_shared.ts`, `enforceCookieSessionTrustedOrigin()`, ~line 300  
**Severity:** HIGH  
**Category:** CSRF / Cross-Site Request Forgery

**Code:**
```typescript
// Only enforce trusted-origin checks for ambient cookie-authenticated writes.
// Explicit header-based auth is an intentional request and should not be
// downgraded into cookie-only CSRF handling.
if (!hasValidCookieSession || hasValidBearerSession || hasExplicitPrivyAuth || hasExplicitSiwaReceipt) return false
```

**Observation:**  
The CSRF guard (`enforceCookieSessionTrustedOrigin`) is intentionally bypassed whenever the request carries an `Authorization: Bearer ...` header containing a valid session token. This creates a meaningful attack window:

1. An attacker tricks a victim into visiting a malicious page.
2. The malicious page issues a cross-origin `fetch` with `Authorization: Bearer <stolen_token>` — it can obtain the token via FINDING-02 (session token in response body), or from localStorage if the app stores it there.
3. `enforceCookieSessionTrustedOrigin` returns `false` (no CSRF check needed), and the request proceeds.
4. Any state-mutating endpoint (deploy session creation, wallet operations, etc.) is now callable cross-origin with the victim's identity.

Even without FINDING-02, the design is fragile: once a session token leaks via any vector (XSS, logging, referrer header, etc.), there is no additional CSRF layer to contain the damage.

**Fix:**  
Maintain the CSRF check even for bearer-authenticated requests for the highest-privilege operations (deploy session creation, wallet owner management). The trusted-origin check is cheap and does not meaningfully burden legitimate clients. Alternatively, add `SameSite=Strict` to the session cookie (currently `SameSite=Lax`) so the cookie itself provides CSRF protection, eliminating the need for origin-checking on cookie-authenticated requests.

---

### FINDING-04 — HIGH: Handoff Code Brute-Force Window — Rate Limit Only on Redeem IP, Not Code

**File:** `frontend/api/_handlers/auth/_handoff-redeem.ts`, ~line 35  
**Severity:** HIGH  
**Category:** Authentication / Brute Force

**Code:**
```typescript
const limit = checkRateLimit(rateLimitKey('auth_handoff_redeem', ip), {
  windowMs: 60_000,
  maxRequests: 30,
})
```

**Observation:**  
Handoff codes are 256-bit random values (32 bytes = 64 hex chars), which makes exhaustive search computationally infeasible. However, the rate limit is keyed only on the client IP address. An attacker with access to a large number of IP addresses (botnet, residential proxy network) can attempt 30 guesses per IP per minute across an arbitrary number of IPs. The handoff code TTL is 2 minutes (120 seconds), creating a window of 30 × (N IPs) attempts per IP per 60-second window.

In addition, the code format validation (`/^[a-f0-9]{64}$/i`) is correct but does not prevent timing side-channels in the `hashHandoffCode` path — though this is mitigated by the fact that the hash comparison is done at the database level (string equality on `code_hash`), not in application code.

More practically: the handoff code stores a `privyToken` in the database. If a code is intercepted in transit (e.g., logged by a misconfigured reverse proxy), it can be redeemed once to get a full session token + the Privy JWT. The DB correctly nulls the `privy_token` on consumption, but the session token issued is a valid 7-day credential.

**Fix:**  
1. Rate-limit on both IP **and** a sliding global counter of failed redeem attempts to resist distributed brute-force.
2. Reduce handoff TTL to 60 seconds (from 120) and bind the code to the requesting IP at creation time (reject redemption from a different IP).
3. Log failed redemption attempts for anomaly detection.

---

### FINDING-05 — HIGH: Paymaster Proxy Has No Per-User or Per-Session Gas Spending Limit

**File:** `frontend/api/_handlers/_paymaster.ts`  
**Severity:** HIGH  
**Category:** Wallet Security / Paymaster Abuse / Economic Attack

**Observation:**  
The paymaster proxy validates that:
- The UserOperation `sender` is a genuine Coinbase Smart Wallet (checks `entryPoint` and `implementation` against a known set).
- The `sessionAddress` owns the `sender` CSW (via `assertSessionOwnsSender`).
- Call selectors are in an allowlist (`ALLOWED_BATCHER_SELECTORS`, `ALLOWED_TOKEN_SELECTORS`, etc.).
- The creator token is on the allowlist.

However, there is **no per-user, per-session, or per-time-window cap on total gas sponsored**. An allowlisted user (or a user who has been granted deploy permissions) can submit an unlimited number of UserOperations that will be sponsored by the paymaster. If a bug in the call-validation logic allows a valid-looking but expensive operation (e.g., an extremely large `auctionSteps` bytes blob, or a swap-router call that exhausts the CSW's allowance), the paymaster's CDP wallet will bear the full gas cost without bound.

Additionally, no maximum body size is enforced on the calls array beyond the existing `PAYMASTER_MAX_BODY_BYTES = 512_000` limit. A 512KB UserOperation body could cause significant gas consumption if inadvertently sponsored.

**Attack Scenario:**  
A malicious-but-allowlisted creator repeatedly submits UserOperations with large `auctionSteps` or `solanaIxs` payloads. Each operation is valid structurally but consumes gas. Over time, this depletes the sponsorship budget.

**Fix:**  
1. Implement per-session and per-user daily gas spending limits (e.g., track total gas units sponsored in a DB table, reject requests above a threshold).
2. Add an absolute maximum on the number of sponsored UserOperations per deploy session.
3. Validate maximum byte lengths on `auctionSteps` and `solanaIxs` fields before sponsoring.
4. Set up alerting in the CDP dashboard for unusual gas spend patterns.

---

### FINDING-06 — HIGH: `requireOptionalHeaderEnvAuth` — Absent Secret Defaults to Open Access

**File:** `frontend/packages/server-core/src/machine-auth.ts`, ~line 75  
**Severity:** HIGH  
**Category:** Authentication / Authorization Bypass

**Code:**
```typescript
export function requireOptionalHeaderEnvAuth(
  req: VercelRequest,
  res: VercelResponse,
  options: OptionalHeaderAuthOptions,
): boolean {
  const configuredSecret = String(process.env[options.envKey] ?? '').trim()
  if (!configuredSecret) return true  // <-- OPEN ACCESS when env var is absent
  ...
}
```

**Observation:**  
`requireOptionalHeaderEnvAuth` is designed as "optional" authentication — if the environment variable is not configured, the endpoint is unauthenticated. This is documented as intentional, but the semantics are dangerous: a misconfigured deployment (e.g., a staging deployment where the secret was not propagated) will accept all requests as authorized rather than failing closed.

This pattern is used for internal machine-to-machine auth in several places (e.g., Solana registration internal secret). If the relevant env var is absent from any deployment environment, those endpoints become publicly accessible.

**Fix:**  
Remove the "optional" pattern entirely. If an endpoint requires machine auth, that auth must be required unconditionally. For development environments, use a well-known dev secret that is explicitly configured rather than silently allowing all traffic. The `requireBearerEnvAuth` function (which fails closed when the secret is absent) is the safer pattern and should be used instead.

---

### FINDING-07 — MEDIUM: Session Token Returned as Bearer in API Response Enables Non-HttpOnly Use

**File:** `frontend/api/_handlers/auth/_verify.ts`, ~line 140  
**File:** `frontend/api/_handlers/auth/_privy.ts`, ~line 185  
**Severity:** MEDIUM  
**Category:** Session Security

**Observation:**  
The `sessionToken` is returned in both the cookie (HttpOnly, secure) and the JSON response body. The design intent is to support embedded contexts where cookies may be blocked. However, the combination means:

1. The client-side JavaScript stores or uses `sessionToken` from the response body.
2. This is not HttpOnly — any XSS can access it.
3. The token is a valid 7-day bearer credential usable against all API endpoints, including `deploy/session/create`.

The SIWE verify endpoint (`_verify.ts`) also sets `SameSite=Lax` on the session cookie (not `Strict`), meaning cross-site GET navigations (links, redirects) carry the cookie. While this is the Lax-safe default, for a high-value session like a deploy session, `Strict` would be preferable.

**Fix:**  
For high-privilege operations (deploy session management), require re-validation with `SameSite=Strict` cookies or a separate short-lived deploy-scoped token rather than the general 7-day session token.

---

### FINDING-08 — MEDIUM: Deploy Session `_continue.ts` Reads All Phase Calls from DB Payload — Client-Controlled at Creation Time

**File:** `frontend/api/_handlers/deploy/session/_continue.ts`, ~line 290  
**Severity:** MEDIUM  
**Category:** Deploy Flow Safety / State Manipulation

**Observation:**  
The `_continue.ts` handler reconstructs all UserOperation calls (`phase1Calls`, `phase2CoreCalls`, `phase2FinalizeCalls`, `phase3Calls`, `phase4Calls`) entirely from the `payload` column stored in the database at session creation time. The payload was supplied by the client at `/api/deploy/session/create` time and validated there (selector allowlist, invariant checks, etc.). The `_continue.ts` handler re-validates calls against an ERC-7712 grant (permission grant signed at creation), which is an important additional guard.

However, `_continue.ts` does not re-run the full allowlist/selector validation from `_create.ts`. It relies on the grant validation (`validateCallsAgainstGrant`) as the sole call-content check. If the grant validation has a gap (e.g., it approves a broader call set than intended), calls stored in the payload could be submitted that were not fully validated at creation.

Additionally, the `solanaOvault` config stored in the payload is read back and used by the server — the code explicitly notes: "Never trust session-persisted hints from client payloads. Compatibility hints used for OVault gating must come from trusted server config." This comment is in `ensureOvaultPreflight`, and the code does correctly source mint compatibility hints from env: `readSolanaOvaultMintCompatibilityHintsFromEnv()`. However, `assetMintOrigin` is still read from the stored payload (client-controlled at session creation).

**Attack Scenario:**  
A creator manipulates `assetMintOrigin` in the session creation request to force a specific code path in the Solana OVault preflight that may bypass a compatibility check. The value is stored in the DB and replayed at continue time.

**Fix:**  
1. Re-run selector validation on calls read back from the DB payload in `_continue.ts`.
2. Do not re-use client-supplied `assetMintOrigin` from the DB payload; derive it server-side from the token registration state.
3. Consider signing the payload at creation time with an HMAC so the server can detect any post-creation tampering (even though DB access is implicitly trusted, defense-in-depth is appropriate for fund-handling operations).

---

### FINDING-09 — MEDIUM: Deploy Session Ownership Check Uses Address Equality, Not Re-Verified Signature

**File:** `frontend/api/_handlers/deploy/session/_sessionAccess.ts`, ~line 50  
**Severity:** MEDIUM  
**Category:** Deploy Flow / Authorization

**Code:**
```typescript
const sessionAddress = getAddress(auth.address)
if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
  throw new DeploySessionAccessError(403, 'Forbidden')
}
```

**Observation:**  
The deploy session ownership check compares the session address (from the session cookie/bearer token) against the `session_address` stored in the DB at creation time. This is correct and necessary. However, the session cookie itself is validated only by HMAC signature (see `readSessionToken`). There is no additional step that confirms the authenticated user still owns the CSW or the session signer is still installed on-chain.

This means if a session cookie is stolen (e.g., via FINDING-02 or FINDING-07), the attacker can fully control the deploy session for its remaining 7-day lifetime, including submitting UserOperations, checking status, and triggering cleanup. The 45-minute deploy session TTL (`DEPLOY_SESSION_TTL_MINUTES`) provides some mitigation, but the auth session itself lasts 7 days.

**Fix:**  
For deploy-critical operations (`continue`, `status` when in-flight), require a fresh proof of wallet ownership (e.g., a signed message from the owner EOA, or a re-validated Privy JWT) rather than relying solely on the 7-day session cookie.

---

### FINDING-10 — MEDIUM: CORS `DEPLOY_SESSION_TOKEN_HMAC_SECRET` Missing Only Checked for Vercel Origins

**File:** `frontend/api/_handlers/deploy/session/_create.ts`, `checkDeploySessionSecretsReady()`, ~line 340  
**Severity:** MEDIUM  
**Category:** Credential Handling / Configuration

**Code:**
```typescript
function checkDeploySessionSecretsReady(origin: string): { ok: boolean; error?: string } {
  const isVercelEnv = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)
  if (!isVercelEnv || !isVercelDeploymentOrigin(origin)) return { ok: true }
  // ... checks DEPLOY_SESSION_TOKEN_HMAC_SECRET only for Vercel deployment origins
}
```

**Observation:**  
The check for `DEPLOY_SESSION_TOKEN_HMAC_SECRET` only runs when the request origin is a `*.vercel.app` domain AND the `VERCEL` env var is set. For production deployments on custom domains (e.g., `app.4626.fun`), this check is skipped. If `DEPLOY_SESSION_TOKEN_HMAC_SECRET` is absent in production, `signDeployToken()` throws at runtime (because `DEPLOY_SESSION_TOKEN_HMAC_SECRET` is required in `signDeployToken`), but the error happens during the deploy continue flow, not at session creation, which may produce confusing error messages. There is no startup validation.

**Fix:**  
Check `DEPLOY_SESSION_TOKEN_HMAC_SECRET` existence unconditionally at startup (or at session creation time regardless of environment), with a clear error message, rather than only on Vercel preview deployments.

---

### FINDING-11 — MEDIUM: In-Memory Rate Limiter Does Not Persist Across Serverless Invocations

**File:** Rate limiting throughout `frontend/packages/server-core/src/index.js` (referenced via `checkRateLimit`)  
**Severity:** MEDIUM  
**Category:** Rate Limiting / DoS

**Observation:**  
The rate limiter (`checkRateLimit`) uses in-memory storage (implied by the `checkRateLimit`/`rateLimitKey` API — no Redis/database backing is referenced). On serverless platforms like Vercel, each function invocation may run in a separate process/isolate. This means rate limit counters reset on each cold start, and concurrent warm invocations each maintain their own counter.

A distributed attack using concurrent requests (each hitting a different warm lambda) can exceed the declared rate limits by a factor equal to the number of concurrent lambda instances. For sensitive endpoints like `auth-verify` (SIWE signature submission) and `auth-privy` (Privy JWT verification), this means the effective rate limit is much higher than configured.

**Attack Scenario:**  
Attacker sends 50 concurrent requests to `/api/auth/verify` simultaneously. Each hits a different lambda instance, each with a fresh in-memory counter. All 50 pass. For SIWE signature submission, this enables faster nonce consumption, potential brute-force of nonce tokens.

**Fix:**  
Use a shared rate-limit store (Redis, Upstash, or a Vercel KV store) keyed by IP+endpoint. This is especially important for `auth-verify`, `auth-privy`, and `deploy-session-create`. Alternatively, delegate to a WAF/CDN layer (Cloudflare rate limiting) for coarse-grained IP-level protection.

---

### FINDING-12 — MEDIUM: SIWE Nonce Fallback to Signed Nonce Token When Cookie Blocked

**File:** `frontend/api/_handlers/auth/_verify.ts`, ~line 90  
**Severity:** MEDIUM  
**Category:** Authentication / Nonce Security

**Code:**
```typescript
const cookieMatches = cookieNonce && cookieNonce === parsed.nonce
if (!cookieMatches) {
  // Fallback for embedded contexts where cookies may be blocked: validate the signed nonce token.
  const nonceToken = nonceTokenRaw ? readNonceToken(nonceTokenRaw) : null
  if (!nonceToken || nonceToken.nonce !== parsed.nonce) {
    return res.status(400).json({ success: false, error: 'Nonce mismatch' } satisfies ApiEnvelope<never>)
  }
}
```

**Observation:**  
When the cookie-bound nonce is not present (embedded/cross-origin context), the server accepts a signed nonce token returned to the client by the `/api/auth/nonce` endpoint. This token is signed with `AUTH_SESSION_SECRET` (the same HMAC key used for sessions). The nonce token has a 15-minute TTL.

The security model relies on the client submitting the nonce token it received. If an attacker can intercept the nonce token (e.g., the nonce endpoint response is logged or passed through a proxy), they can forge a SIWE message with that nonce and submit a valid authentication request for an arbitrary address. The nonce is consumed from the DB on first use, providing replay protection. However:

1. The nonce token proves possession of a nonce, not possession of the address. A nonce token intercepted from User A's request could be used by an attacker to authenticate as any address (the attacker provides the SIWE message and signature for their own address, using the intercepted nonce).
2. The 15-minute window is long enough for a determined attacker who controls a timing side-channel to exploit.

**Fix:**  
Bind the nonce token to the requesting IP at creation time and validate the IP at verify time. This does not prevent all attacks but significantly raises the bar for nonce token theft-and-replay.

---

### FINDING-13 — MEDIUM: Unverified `cswAddress` in SIWE Verify Response — Ownership Returned but Not Enforced

**File:** `frontend/api/_handlers/auth/_verify.ts`, ~line 150  
**Severity:** MEDIUM  
**Category:** Wallet Security / CSW Ownership

**Code:**
```typescript
let cswOwnership: VerifyResponse['cswOwnership'] = null
if (cswAddressRaw) {
  const ownerVerified = await verifyCswOwnerOnBase({
    smartWallet: cswAddressRaw,
    ownerAddress: verified.address,
  })
  cswOwnership = {
    cswAddress: cswAddressRaw,
    ownerAddress: verified.address,
    verified: ownerVerified,  // boolean — may be false
  }
}
```

**Observation:**  
The SIWE verify endpoint accepts an optional `cswAddress` from the client, checks ownership on-chain, and returns the result with a `verified: true/false` boolean. The session is created regardless of whether CSW ownership is verified. The `upsertProfileByWallet` call that follows only sets `cswAddress` if `cswOwnership.verified === true`, which is correct.

However, the API response returns `cswOwnership` with `verified: false` when the check fails, and the session is still created. Client-side code that trusts `verified: false` in the response and gates features based on it may behave correctly, but any client code that simply checks for the presence of `cswOwnership.cswAddress` (without checking `verified`) would be bypassed.

This is primarily a client-side risk rather than a direct server-side vulnerability, but it represents a confusing API contract that invites implementation bugs.

**Fix:**  
If `cswAddress` is provided and ownership verification fails, return a 403 or omit `cswOwnership` from the response rather than including it with `verified: false`. Alternatively, rename the field to make the semantics unambiguous (e.g., `cswOwnershipUnverified`).

---

### FINDING-14 — MEDIUM: Deploy Token Signed with HMAC but Transported in Clear HTTP Headers to Bundler

**File:** `frontend/api/_handlers/deploy/session/_continue.ts`, ~line 430  
**Severity:** MEDIUM  
**Category:** Deploy Flow Safety / Token Exposure

**Code:**
```typescript
const deployToken = rec.deployToken
const deploySig = signDeployToken(deployToken)
const transport = http(bundlerEndpoint.url, bundlerEndpoint.viaProxy
  ? {
      fetchOptions: {
        headers: {
          'X-CV-Deploy-Session': deployToken,
          'X-CV-Deploy-Session-Signature': deploySig,
        },
      },
    }
  : undefined)
```

**Observation:**  
When routing through the self-proxy (`/api/paymaster`), the deploy token and its HMAC signature are transmitted as plain HTTP headers to the same origin. The token is a 32-byte base64url random value (256-bit entropy), and the signature is an HMAC-SHA256. This is a reasonable design.

However, the deploy token is also stored unencrypted in the `deploys.deploy_token` DB column. If the database is compromised, an attacker can retrieve valid deploy tokens for any active session and use them to call the paymaster proxy directly, bypassing the `_continue.ts` session ownership check (because the paymaster uses the token to look up the session, not the session cookie).

**Fix:**  
Store only the hash of the deploy token in the DB (`token_hash` column already exists). The `deploy_token` column itself should not store the plaintext token — use the hash for lookup and require the plaintext only from the caller. This is consistent with how nonce tokens and handoff codes are handled.

*(Note: `token_hash` does exist and is indexed. However, `deploy_token` is also stored in plaintext as a separate column. Removing the plaintext column would close this attack surface.)*

---

### FINDING-15 — LOW: Handoff Code TTL Is Short (2 min) but Secret Reuse Across Session and Handoff

**File:** `frontend/server/auth/_handoff.ts`, `getHandoffHashSecret()`  
**Severity:** LOW  
**Category:** Credential Handling

**Observation:**  
`getHandoffHashSecret()` reads `AUTH_SESSION_SECRET`, which is the same env var used for HMAC-signing session tokens and nonce tokens. Using a single secret for three distinct HMAC purposes (session tokens, nonce tokens, handoff codes) violates key separation. If a vulnerability allows an attacker to forge one token type (e.g., by recovering a partial secret), they can potentially forge the others.

**Fix:**  
Use distinct environment variables for each HMAC key: `AUTH_SESSION_SECRET`, `AUTH_NONCE_SECRET`, `AUTH_HANDOFF_SECRET`. This also makes key rotation easier (rotating one does not invalidate all others).

---

### FINDING-16 — LOW: `SameSite=Lax` on Session Cookie — Cross-Site Navigation Carries Cookie

**File:** `frontend/server/auth/_shared.ts`, `setCookie()`, ~line 440  
**Severity:** LOW  
**Category:** CSRF / Session Security

**Observation:**  
Session cookies are set with `SameSite=Lax`. Under Lax, cookies are sent on top-level cross-site navigations (e.g., a link click from an external page to `app.4626.fun/api/...`). For a high-value financial application, `SameSite=Strict` would be more appropriate, especially given that the CSRF protection in `enforceCookieSessionTrustedOrigin` has the bypass conditions documented in FINDING-03.

**Fix:**  
Use `SameSite=Strict` for the session cookie on production domains. `Lax` can be retained for the nonce cookie (15-minute TTL) where strict would break common flows.

---

### FINDING-17 — LOW: `privyWalletApi.ts` TEE Attestation Gate — Attestation Is Best-Effort

**File:** `frontend/server/_lib/privyWalletApi.ts`, `walletRpc()`, ~line 150  
**Severity:** LOW  
**Category:** Wallet Security / Infrastructure Trust

**Code:**
```typescript
await assertTeeAttestationOrThrow({
  action: params.teeContext?.action ?? `privy_wallet_rpc:${params.method}`,
  ...
})
```

**Observation:**  
All Privy wallet RPC calls (including `secp256k1_sign` for signing UserOperations) are gated behind a TEE attestation check (`assertTeeAttestationOrThrow`). This is a good security control. However, the function is invoked before every signing operation without caching the attestation result. In a high-throughput scenario (many phases of a deploy), this adds latency and the attestation service becomes a dependency in the critical path.

More importantly, if the TEE attestation service is unavailable, `assertTeeAttestationOrThrow` throws, which means all signing operations fail. This is the correct fail-closed behavior, but it should be monitored — a persistent attestation service outage would block all vault deployments.

**Fix:**  
Add monitoring/alerting on TEE attestation failures. Consider caching successful attestations with a short TTL (e.g., 30 seconds) to reduce per-operation overhead while maintaining security guarantees.

---

### FINDING-18 — LOW: `DEPLOY_DRY_RUN_DEV_BYPASS=1` Bypass in Example Config

**File:** `frontend/.env.deploy-dry-run.example`, last line  
**Severity:** LOW  
**Category:** Configuration / Developer Bypass

**Code:**
```
# Dev-only: allow unauthenticated dry-run against local fork for smoke tests.
# Requires X-Deploy-Dry-Run-Dev: <ownerAddress> header. Only works when BASE_RPC_URL is localhost.
# DEPLOY_DRY_RUN_DEV_BYPASS=1
```

**Observation:**  
A developer bypass (`DEPLOY_DRY_RUN_DEV_BYPASS=1`) is documented in the example config. While the comment says "only works when BASE_RPC_URL is localhost", this conditional check is enforced in `_dryRun.ts` (`isLocalForkRpcUrl`). If a developer accidentally sets `BASE_RPC_URL` to a non-localhost URL while `DEPLOY_DRY_RUN_DEV_BYPASS=1` is active, the guard would not trigger.

More concerning: the example file is committed to the repository. A developer who copies this file without reading all comments might enable the bypass in a staging environment.

**Fix:**  
Remove `DEPLOY_DRY_RUN_DEV_BYPASS` from the committed example file entirely. Document it only in internal runbooks. Alternatively, ensure the bypass check also validates `NODE_ENV !== 'production'` and `VERCEL_ENV` is absent.

---

### FINDING-19 — LOW: `lastPrivyAuthDbSyncAtMs` — Process-Global Throttle Creates Race Condition

**File:** `frontend/api/_handlers/auth/_privy.ts`, ~line 175  
**Severity:** LOW  
**Category:** State Management / Race Condition

**Code:**
```typescript
let lastPrivyAuthDbSyncAtMs = 0
// ...
const now = Date.now()
const minInterval = getPrivyAuthDbSyncMinIntervalMs()
const shouldSyncNow = now - lastPrivyAuthDbSyncAtMs >= minInterval || ...
if (shouldSyncNow) {
  const syncResult = await syncUserWallets(db as any, user as any)
  ...
  lastPrivyAuthDbSyncAtMs = now
}
```

**Observation:**  
`lastPrivyAuthDbSyncAtMs` is a module-level variable. In a serverless environment, each warm invocation shares this variable within the same process, but concurrent invocations in different processes each start with `0`. This means the throttle does not prevent concurrent duplicate syncs across invocations — if two `/api/auth/privy` requests arrive simultaneously in different lambda instances, both will sync. The sync itself should be idempotent (`syncUserWallets` uses upsert), so this is a correctness concern (duplicate work) rather than a security one. However, if `syncUserWallets` has any non-idempotent side effects, this could cause bugs.

**Fix:**  
Move the sync throttle to the database (e.g., a `last_synced_at` column on the profile, updated atomically). This is more robust across serverless instances.

---

### FINDING-20 — INFO: Deploy Session Calls Stored as Arbitrary JSON in JSONB Column

**File:** `frontend/server/_lib/deploySessions.ts`, `insertDeploySession()`  
**Severity:** INFO  
**Category:** Data Integrity

**Observation:**  
The full `phase1Calls`, `phase2CoreCalls`, `phase2FinalizeCalls`, `phase3Calls`, and `phase4Calls` arrays are stored verbatim in the `payload` JSONB column. These were validated at creation, but the DB schema does not enforce the shape of this JSON. If a DB migration accidentally corrupts payload data, or if a buggy client submits data that passes validation but encodes malformed ABIs, the `_continue.ts` handler's `normalizeCalls` function will skip malformed entries silently (caught by `try/catch`). This could cause a deploy to silently skip required calls.

**Fix:**  
Add a database-level constraint or a startup-time schema validator that verifies the payload shape before beginning the continue flow. The `required-stage checks` comment in `_continue.ts` suggests the code relies on these checks to detect missing calls, but they operate on reconstructed call arrays (after silent drops), not the original validated arrays.

---

## Summary Table

| ID | Severity | Title | File |
|----|----------|-------|------|
| 01 | CRITICAL | Ephemeral in-process session secret on `AUTH_SESSION_SECRET` misconfiguration | `server/auth/_shared.ts` |
| 02 | HIGH | Privy JWT + session token returned in cleartext API response body | `_handoff-redeem.ts`, `_privy.ts` |
| 03 | HIGH | CSRF protection bypassed via bearer token header | `server/auth/_shared.ts` |
| 04 | HIGH | Handoff redeem rate-limited by IP only — distributed brute-force possible | `_handoff-redeem.ts` |
| 05 | HIGH | Paymaster has no per-user gas spending limits | `_paymaster.ts` |
| 06 | HIGH | `requireOptionalHeaderEnvAuth` defaults to open access when env var absent | `server-core/machine-auth.ts` |
| 07 | MEDIUM | Session token in response body enables non-HttpOnly use | `_verify.ts`, `_privy.ts` |
| 08 | MEDIUM | Deploy continue reads client-controlled payload without full re-validation | `deploy/session/_continue.ts` |
| 09 | MEDIUM | Deploy session ownership check does not require fresh wallet ownership proof | `deploy/session/_sessionAccess.ts` |
| 10 | MEDIUM | `DEPLOY_SESSION_TOKEN_HMAC_SECRET` absence only checked for Vercel origins | `deploy/session/_create.ts` |
| 11 | MEDIUM | In-memory rate limiter does not persist across serverless invocations | Rate limiting infrastructure |
| 12 | MEDIUM | SIWE nonce token fallback not bound to requesting IP | `auth/_verify.ts` |
| 13 | MEDIUM | CSW ownership `verified: false` returned in session response — confusing contract | `auth/_verify.ts` |
| 14 | MEDIUM | Deploy token stored in plaintext in DB alongside hash | `server/_lib/deploySessions.ts` |
| 15 | LOW | Single `AUTH_SESSION_SECRET` used for session, nonce, and handoff HMAC | `server/auth/_handoff.ts` |
| 16 | LOW | `SameSite=Lax` on high-value session cookie | `server/auth/_shared.ts` |
| 17 | LOW | TEE attestation invoked on every signing operation — no caching, single point of failure | `server/_lib/privyWalletApi.ts` |
| 18 | LOW | `DEPLOY_DRY_RUN_DEV_BYPASS` documented in committed example env file | `.env.deploy-dry-run.example` |
| 19 | LOW | Process-global sync throttle races across concurrent serverless invocations | `auth/_privy.ts` |
| 20 | INFO | Deploy session calls stored as arbitrary JSON — silent drop on malformed entries | `server/_lib/deploySessions.ts` |

---

## Positive Security Controls Observed

The following controls are well-implemented and should be preserved:

1. **HMAC-signed session tokens with timing-safe comparison** (`timingSafeEqual` in `readSessionToken`).
2. **DB-backed nonce consumption** — nonces are consumed atomically with `UPDATE ... WHERE consumed_at IS NULL`, preventing replay.
3. **Parametrized SQL throughout** — no string interpolation in DB queries; all values use template literal parameters.
4. **Deploy token HMAC signature** (`signDeployToken`) verified by the paymaster proxy before accepting UserOperation routing.
5. **Onchain CSW ownership verification** — `assertSessionOwnsSender` and `isOnchainSmartWalletOwner` verify ownership via live RPC before sponsoring.
6. **Selector allowlist in paymaster** — strict per-selector validation prevents arbitrary calls from being sponsored.
7. **Creator allowlist gate** — deploy session creation and paymaster sponsorship both check the creator allowlist.
8. **ERC-7712 permission grants** — deploy sessions use capability-bounded grants that limit what the session signer can do, providing defense-in-depth against session signer compromise.
9. **Deploy session TTL** — 45-minute default TTL limits the window for exploiting a captured deploy session.
10. **Phase2 invariant verification** (`verifyDeployPhase2Invariants`) — server-side cross-checks of deployed contract addresses against expected values.
11. **Vercel-only secret readiness checks** — the infra probe in `_create.ts` detects Vercel-protected paymaster URLs before creating sessions.
12. **Handoff code hashed in DB** (`hashHandoffCode`) — raw codes never stored, only SHA-256 hashes.
