---
title: Contracts analysis lane
sidebar_label: 071ad150…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Contracts analysis lane
| Field | Value |
| --- | --- |
| Session ID | `071ad150-5d45-4752-a7e4-bb06af78f8b8` |
| Lead session | `0a513245-3ae2-4076-a9b0-bc1de524c38f` |
| Record type | Parallel workstream export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 11:44 AM (UTC-7)</timestamp>
You are doing the API security pass of a full-codebase review of the 4626 monorepo at /home/akitav2/projects/4626. READ-ONLY: do not modify files. This is a Vercel serverless API under frontend/api/ with handlers in frontend/api/_handlers/ and shared libs in frontend/server/_lib/.

Audit the API trust boundaries and report CONCRETE findings with file paths and line numbers. Trace actual runtime paths — do not speculate. For each finding give: severity (Critical/High/Medium/Low), location (file:line), why it matters, evidence (code snippet), and suggested fix.

Checklist (verify each in code):
1. Mutating routes without auth: scan frontend/api/_handlers/_routes.ts (and sibling _routes.*.ts files) and sample mutating handlers (POST-style) for missing auth checks. Especially: deploy session routes, keeper routes, admin routes, waitlist routes, telegram routes, creator strategy activation routes, relay routes, solana registration routes.
2. Machine-auth invariant: internal Solana mutation paths (e.g. /api/deploy/registerSolanaBridgeToken, keeper solana reconcile) must require machine auth (CRON_SECRET / KPR_API_KEY style), never ambient user sessions. Verify.
3. Webhook verification: frontend/api/_handlers/creator/strategy/stripe/_webhook.ts (Stripe signature verification, idempotency, raw-body handling), Telegram webhook handler (secret token check?), any other webhook ingestion (Privy, Railway). Check for replay protection.
4. x402 payment path (frontend/api/_handlers/creator/strategy/_x402-activate.ts or similar): EIP-3009 authorization verification, nonce replay protection, amount validation.
5. USDC payment verification (_activate.ts): does verifyUsdcPayment bind tx to the authenticated session, prevent reuse of the same payment tx for multiple activations (UNIQUE payment_tx_hash), and validate value/recipient?
6. Session cookie handling: where cv_auth_session is set — check HttpOnly/Secure/SameSite/Domain flags; session verification helper; CSRF posture for cookie-authenticated mutating routes.
7. Admin routes: how /api/auth/admin and /api/admin/* authenticate; profile merge endpoint dual auth (admin session + CRON_SECRET).
8. Paymaster handler frontend/api/_handlers/paymaster/_paymaster.ts: who can request sponsorship, what gates exist (canonical CSW enforcement, strategy weight gate, call allowlists), can an attacker get arbitrary calls sponsored?
9. Rate limiting / abuse protection on public endpoints (waitlist join, AMOE submission, telegram link, hermit draft).
10. SSRF: any handler that fetches a user-supplied URL.
11. Token/secret leakage in logs or error responses.
12. Open redirects in any redirect-building code.

Return findings sorted by severity, plus a short list of things you verified as SOUND (so the parent doesn't re-check). Be rigorous: only report things you traced in code.

## Analysis

Starting a comprehensive API security audit as the read-only subagent. I'll work through the routes files and authentication helpers first, then systematically check each security requirement, parallelizing reads where I can to move efficiently through this large task.

*Tools invoked:* UpdateCurrentStep

## Analysis

*Tools invoked:* Read

## Analysis

Looking at the Telegram webhook implementation, the secret token validation uses a non-constant-time comparison, but a timing attack over the network isn't practical here, so it's a low-risk issue. The fail-closed behavior is solid—returning 503 in relay mode or ignoring otherwise when the secret isn't configured. Now I need to dig into the paymaster logic, which sounds like the critical piece.

*Tools invoked:* Read

## Analysis

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Read

## Analysis

Looking at the Paymaster's validation flow—it requires an authenticated principal or signed deploy-session token, then validates the entryPoint, chainId, sender, and per-sender sponsorship limits before running the deep validation logic through `validateSponsoredSmartWalletCalls`. This validation function is extensive, checking call shapes against different modes like swap and deploy phases, so I need to verify that it properly binds the sender to the session to ensure the sponsorship is legitimate.

*Tools invoked:* Grep

## Analysis

Paymaster's security looks good—it requires authenticated principals, validates sender-to-session ownership through on-chain checks, enforces allowlists for deployments, applies strategy weight gates per workspace, and implements per-sender sponsorship limits. I need to trace through the sponsored smart wallet call validation logic to confirm the swap mode allowlists are properly gated.

*Tools invoked:* Grep

## Analysis

The paymaster validation checks out. When `deploySessionOwner` is set, the `assertSessionOwnsSender` function runs with the deploy session's address, ensuring the sender is owned by that session. The deploy session path validates this ownership check at line 1465 using the creator's contract session wallet address.

There's an edge case at line 2046 where if the session address equals the sender itself (self-authentication), it returns early — this handles the case where someone with a verified SIWE session can sponsor their own smart wallet since they've proven control of it.

Now I need to work through the remaining security checklist items: admin routes, rate limiting on public endpoints, SSRF prevention, secret leakage, and open redirects. Let me start with the admin routes.

*Tools invoked:* UpdateCurrentStep, Glob, Grep

## Analysis

*Tools invoked:* Read

## Analysis

I'm noticing the profile merge endpoint uses multiple auth layers—admin session, CRON_SECRET, confirmation string, rate limiting, and audit logging—but there's a timing attack vulnerability where the CRON_SECRET comparison uses strict equality instead of constant-time comparison, whereas the dedicated cronAuth module handles it correctly. I should check how the admin address validation and session auth work, then compare against other admin handlers like the waitlist approval endpoint to see if this pattern is consistent.

*Tools invoked:* Grep

## Analysis

I'm verifying the admin authentication pattern where the SIWE session address must be in the `CREATOR_ACCESS_ADMIN_ADDRESSES` environment variable, then I'll check a few other admin endpoints like the waitlist approval and control-plane provisioning handlers to confirm they follow the same auth pattern. After that, I need to review rate limiting on public endpoints, potential SSRF vulnerabilities, secret leakage risks, and open redirect issues.

*Tools invoked:* Shell, Grep

## Analysis

I'm noticing that the admin handlers all use the same gating pattern with `getSessionAddress` and `isAdminAddress`, but I should verify whether `_recoverStrandedCswResolveOwner.ts` is actually missing from the output.

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Read

## Analysis

Now I'm checking the security posture of the public endpoints—rate limiting on the waitlist join, bootstrap, AMOE submit, and telegram link flows, plus looking for SSRF vulnerabilities, secret leakage, and open redirect issues across those same routes.

*Tools invoked:* UpdateCurrentStep, Grep, Grep

## Analysis

*Tools invoked:* Read

## Analysis

The Hermit implementation looks solid with bearer token gating, constant-time comparison, rate limiting, and fail-closed behavior. Now I'm shifting focus to potential SSRF vulnerabilities—there are several handlers that fetch user-supplied URLs: image proxies, token icon sources, Zora coin metadata, relay notifications, OG image fetches, and webhook URLs. I need to search the codebase for fetch calls that accept user-controlled input.

*Tools invoked:* Grep, Grep

## Analysis

*Tools invoked:* Read

## Analysis

The image proxy is well-hardened against SSRF. Let me check the hermit-meme-save URL handler and waitlist/AMOE rate limiting.

 The image proxy has solid SSRF protections in place—allowlisting protocols, blocking private IPs across both IPv4 and IPv6 ranges, validating DNS resolution at each redirect step, and enforcing MIME type and size limits. There's one lingering vulnerability though: DNS rebinding attacks could exploit the time-of-check-time-of-use gap between the initial DNS lookup validation and the actual fetch request, where a malicious DNS server could return a public IP during validation but switch to a private IP when the fetch happens. The image proxy looks solid with its SSRF protections in place — DNS resolution checks, private IP blocking, redirect validation, and magic byte verification all working together. Now I need to examine the hermit-meme-save URL handler and see how other fetch-with-URL handlers are implemented.

*Tools invoked:* Read

## Analysis

The URL persistence is a database operation, not a server fetch, so no SSRF vulnerability there. Authentication checks out with sessionAddress and room ownership validation. Now I need to verify rate limiting across the waitlist join and bootstrap flows — I can see `checkRateLimit` being used in both `_bootstrap.ts` and `_lead.ts`. For the AMOE submission handlers in the lottery endpoints, I should check if rate limiting is properly applied there too. I also need to scan for open redirect vulnerabilities by looking for `res.redirect` calls or Location headers in the handlers, and verify that secrets aren't being exposed.

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Grep

## Analysis

No open redirects found in the API surface, which is good. Now I'm checking for secret leakage in logs and error responses — the codebase generally returns generic error messages, though there's one case where profile merge operations expose the raw error message to dual-authenticated admin callers, which seems acceptable. I need to search for any token logging patterns in the code. I need to verify there are no redirects in the API handlers, check the x402 settlement logic, and make sure the session start fetch URL isn't vulnerable to SSRF attacks—particularly that the `url` variable isn't user-controlled and that the Solana token machine auth was properly confirmed.

*Tools invoked:* Read

