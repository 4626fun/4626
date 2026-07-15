# Agent Prompt Templates

Copy-paste into Cursor chat. Replace `{placeholders}`. Prepend the **meta-block** for any task.

## Meta-block (prepend to any task)

```
Constraint: smallest safe diff. Do not edit attached plan.
Validation honesty: report every command with exit code; never claim pass on failure.
When done: commit + push (unless I said otherwise).
```

---

## Template A — Deploy cutover

```
Mode: Agent | Model: thinking

Goal: Complete {RELEASE} post-broadcast cutover end-to-end — not doc-only.

Attached plan: {path or paste} — execute without editing the plan.

Invariants:
- Deploy status/preflight routes stay read-only
- msg.sender / sender track must match execution lane
- Use epoch scripts: run-greenfield-cutover / validate-greenfield-handoff / sync-greenfield-env-from-handoff

Key files:
@frontend/scripts/ops/prepare-v1191-aux-batcher-cutover.ts
@frontend/src/config/contracts.defaults.ts
@deployments/base/{RELEASE}-bytecode-manifest.json

Validate (in order):
1. bash test/current-release-target-guard.sh
2. pnpm -C frontend guard:registry4626-naming
3. pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
4. Scoped forge if contracts touched

Load archive: docs/agent-context/archives/deploy-cutovers-core.md (vault sub-archive if DeployVault-only)

MCP: Railway/Vercel env — scoped keys only, redact secrets.

Done: commit + push when gates pass. Report every command with exit code.
```

---

## Template B — Waitlist auth bug

```
Mode: Agent (Ask first if root-cause unclear) | Model: thinking

Symptom: {e.g. 429 on /api/auth/me, orphan cookie, oauth/link 401, wallet sign-in hang}

Invariants (checkpoint before edit):
- Email OTP is canonical identity; Telegram is linked channel only
- HttpOnly cv_auth_session ≠ Privy session — both required for joined waitlist
- executionTrack from /api/onboarding/bootstrap + /api/accounts/me — do not recompute client-side
- Do not remount Privy into waitlist-email-only after wallet sign-in

Inspect first:
@frontend/src/features/waitlist/WaitlistFlow.tsx
@frontend/src/lib/privy/providerLink.ts
@frontend/src/lib/auth/sessionRepair.ts
@frontend/server/_lib/onboarding/

Validate:
pnpm -C frontend exec vitest run {waitlist|privy|auth test file}

Load archive: docs/agent-context/archives/waitlist-auth-core.md (or ui/ops sub-archive if UX-only)

Done: smallest safe diff. commit + push.
```

---

## Template C — Swap bug

```
Mode: Agent | Model: thinking for canonical4337; fast OK for UI-only

Symptom: {e.g. AA25, TRANSFER_FROM_FAILED, embedded-wallet-cannot-sign, wrong balance}

Invariants:
- executionMode: canonical | eoa — check deriveSwapConnectGate / txRouter send mode
- User canonical sender = profiles.csw_address; signer = embedded EOA owner
- Protocol agent CSW (PROTOCOL_CSW_ADDRESS) is separate from user custody — do not conflate
- No idle re-quote loops on /swap
- Paymaster: batched wrap+approve+swap; no approve-only UserOps

Inspect:
@frontend/src/lib/tx/txRouter.ts
@frontend/src/lib/uniswap/useSwapExecution.ts
@frontend/src/pages/Swap.tsx
@frontend/src/lib/swap/connectGate.ts

Validate:
pnpm -C frontend exec vitest run {swap|txRouter|coinbaseErc4337 test}

Load archive: docs/agent-context/archives/swap-execution.md

Assert: sendCoinbaseSmartWalletUserOperation called/not-called boundary in tests.

Done: commit + push.
```

---

## Template D — AlfaClub ops

```
Mode: Agent | MCP: Railway (Hermit), TierZero if prod symptom

Task: {e.g. /h pos n/a, counter-trade not firing, daily brief wrong bot, room 1659 reaction}

Invariants:
- ALFACLUB_API_KEY only — no shadow bot tokens
- Command replies: Privy JWT WebSocket lane; ingress via authenticated API
- /h is sole public entrypoint
- Room 1659 inverse: FriendKey stake gate, no bot-self-trade

Inspect:
@frontend/server/_lib/alfaclub/
@frontend/server/agents/eliza/

Env (Railway Hermit, scoped): ARENA_*, ALFACLUB_COUNTER_TRADE_*, ALFACLUB_API_KEY

Validate:
pnpm -C frontend exec vitest run {alfaclub|hermit test glob}

Load archive: docs/agent-context/archives/alfaclub-ops.md

MCP: tierzero_ask "{service} last 2h {symptom}"

Done: commit + push. Redact secrets in report.
```

---

## Template E — Wallet / CSW identity

```
Mode: Agent | Model: thinking

Task: {e.g. wrong XMTP inbox, agent rail identity, AMOE publisher mismatch}

Invariants:
- PROTOCOL_CSW_ADDRESS = protocol agent (XMTP inbox, Keepr sender, ERC-8004)
- CANONICAL_CSW_ADDRESS = operator personal custody — not the public agent
- User profiles.csw_address = that user's custody CSW

Inspect:
@frontend/src/wallet/canonicalWalletPolicy.ts
@frontend/server/_lib/wallet/canonicalCswEnv.ts
@frontend/src/components/chat/agentIdentity.ts

Validate:
pnpm -C frontend guard:canonical-csw
pnpm -C frontend exec vitest run frontend/src/components/chat/agentIdentity.test.ts

Load archive: docs/agent-context/archives/wallet-identity.md

Verify: pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-protocol-csw-cutover.ts

Done: commit + push.
```

---

## Quick reference — mode selection

| Task | Mode | Model |
|------|------|-------|
| How does X work? | Ask | Any |
| 1–3 file bugfix | Agent + @files | Fast often OK |
| Wallet/auth/deploy/swap canonical | Agent + checkpoint | Thinking |
| Prod incident | Agent + TierZero | Thinking |
| Broad folder sweep | Agent + subagents | Thinking plan, fast execute |
