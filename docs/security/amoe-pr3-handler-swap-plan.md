# AMOE PR 3 — `/submit-amoe-zk` handler swap plan

**Status:** scoped, not yet implemented
**Branches off:** `main` (after PR #426 lands)
**Target branch name:** `feat/amoe-zk-submit-handler`
**Estimated diff size:** ~+650 / −100 LoC (1 new endpoint, helpers, 25–35 new tests)

---

## 1. Goal

Wire the witness module shipped in PR #426 (`assembleAmoeWitness`) and the
prover from PR #421 (`proveAmoeEntryPlonk`) into a live HTTP endpoint. After
this PR ships, an authorised AMOE caller can submit an entry that is
verified by the on-chain PLONK verifier instead of the legacy
ECDSA-attestation path.

This is the first PR in §2 that the user actually hits at runtime, so it
must preserve every guard-rail the existing `_amoeSubmit.ts` enforces:
auth, rate limits, nonce uniqueness, balance pre-flight, atomic credit
debit, error mapping.

## 2. Scope

### In scope

- New endpoint: `POST /api/v1/lottery/amoe/submit-zk` (handler at
  `api/_handlers/v1/lottery/_amoeSubmitZk.ts`).
- Replaces the off-chain ECDSA signature with a PLONK proof + 8 public
  inputs as the eligibility artifact. The wallet's signature is still
  required for off-chain auth + replay (signs the proof commitments).
- Server-side witness assembly using `assembleAmoeWitness()` — clients
  never see private signals.
- Server-side proof generation via `proveAmoeEntryPlonk()` — runs in the
  Vercel Node runtime, not the edge. (Confirm runtime caps; the prover
  is ~1.5–3s per call once warm.)
- Calldata build via `buildAmoeEntryZKCall()`, relay via the existing
  smart-wallet relay path.
- Stub for ledger root reads (PR 5 wires the real publisher).

### Out of scope

- The ledger publisher cron (PR 5).
- Replay store + ManagerDeclinedEntry retry (PR 4).
- Production zkey hosting / S3 signing (PR 6) — this PR loads zkey from
  disk via the existing fixture path.
- Removing the legacy `/submit-amoe` endpoint — they coexist behind a
  feature flag until full rollout.

## 3. Endpoint contract

### Request

```
POST /api/v1/lottery/amoe/submit-zk
Content-Type: application/json

{
  "creatorCoin":    "0x…40",
  "message":        "AMOE entry…",        // canonical EIP-191 string
  "signature":      "0x…",                  // wallet sig over `message`
  "pointsBurned":   500_000,
  "nonce":          "0x…64hex",             // bytes32 from /nonce endpoint
  "twitterHandle":  "wenakita",             // server resolves to creditNullifier
  "spendRefId":     "spend-ref-uuid"        // server resolves to spendRefIdHash
}
```

`nonce` is the value previously issued by `/api/v1/lottery/amoe/nonce`
(stored in `lottery_amoe_nonces`). `signupIdHash` and `spendRefIdHash`
are server-derived from the auth context + spendRefId; clients never
construct them.

### Response (200)

```
{
  "success": true,
  "data": {
    "txHash":           "0x…",
    "relayMode":        "server",
    "pointsBurned":     500000,
    "pointsBurnedAsUSD":"5000000000",
    "estimatedWinChancePPM": 20000,
    "creditsConsumed":  500000,
    "creditsRemaining": 1234567,
    "creditsPerEntry":  …,
    "entriesAvailable": …,
    "proofMode":        "plonk"               // distinguishes from ECDSA path
  }
}
```

### Error codes

| Status | `error` | Meaning |
|---|---|---|
| 400 | `Missing or invalid …` | request shape |
| 401 | `unauthorized` | guard / wallet authority |
| 402 | `insufficient_amoe_credits` | pre-flight balance |
| 409 | `nonce_already_used` | replay (handled by PR 4 fully) |
| 422 | `plonk_witness_input_invalid` | bad witness (post-canonicalize) |
| 422 | `plonk_proof_generation_failed` | prover crash |
| 429 | rate limit |
| 503 | `Lottery manager not configured` | env |

All `Amoe*Error` instances flow through `classifyAmoeError` for HTTP
status mapping (already exists, no changes needed).

## 4. Internal flow (single-handler view)

```
1.  CORS / OPTIONS / method-guard (unchanged)
2.  guardAgentApiRequest                  — auth context
3.  rate limiters (in-memory + durable)   — unchanged
4.  parse + validate body                 — adds nonce / twitterHandle / spendRefId
5.  resolveAmoeWallet(authority)          — unchanged
6.  verify wallet signature over message  — extracted from verifyAmoeEntryProof
7.  consume nonce row (lottery_amoe_nonces)
       — SELECT … FOR UPDATE; reject if used; mark consumed
8.  pre-flight balance gate (snapshot)    — unchanged
9.  resolve identifiers:
       twitterCreditNullifier := H(twitterHandle, salt)
       signupIdHash             := H(authIdentity, salt)
       spendRefIdHash           := H(spendRefId, salt)
10. read ledger snapshot (STUB in this PR — fixture-backed)
       — returns { allowlistSnapshot, allowlistLeafIndex,
                    pointsLedgerSnapshot, pointsLedgerLeafIndex }
11. assembleAmoeWitness(...)              — PR 2
12. proveAmoeEntryPlonk(witness)          — PR 1
13. buildAmoeEntryZKCall(proof, pubInputs)
14. relay via existing smart-wallet path  — unchanged
15. consumeAmoeCreditsForEntry            — unchanged (refId now uses pubInput hash)
16. respond 200
```

## 5. New / changed files

| File | Change |
|---|---|
| `api/_handlers/v1/lottery/_amoeSubmitZk.ts` | NEW — handler |
| `api/v1/lottery/amoe/submit-zk.ts` | NEW — Vercel route |
| `server/_lib/lottery/amoeSubmitZk.ts` | NEW — orchestration helpers (steps 9–13) |
| `server/_lib/lottery/amoeIdentifiers.ts` | NEW — nullifier / id-hash derivation + stable hashing salt |
| `server/_lib/lottery/amoeLedgerSnapshotStub.ts` | NEW — fixture-backed snapshot loader, replaced in PR 5 |
| `server/_lib/lottery/amoeNonceStore.ts` | NEW — `consumeNonce()` w/ row-lock. Future PR 4 adds replay table. |
| `server/_lib/lottery/lotteryAmoe.ts` | extract `verifyAmoeWalletSignature()` from existing `verifyAmoeEntryProof` so both paths share it |
| `server/_lib/__tests__/amoeSubmitZk.test.ts` | NEW — unit tests for orchestration |
| `server/_lib/__tests__/amoeNonceStore.test.ts` | NEW — concurrency tests |
| `api/_tests/_amoeSubmitZk.handler.test.ts` | NEW — handler integration tests w/ mocked Supabase |

## 6. Feature flag

Add `AMOE_ZK_SUBMIT_ENABLED` (env, default `false`). When `false`, the
new route returns 503 `zk_path_disabled` so we can ship + deploy without
exposing it. Flip to `true` per-environment as we validate.

## 7. Test plan

### Unit (orchestration)

- Builds correct witness for valid request (golden-vector check).
- Rejects when nonce is missing / consumed / not bytes32 / not in DB.
- Rejects when wallet signature does not recover to claimed wallet.
- Rejects when wallet authority resolves to a different identity.
- Rejects when balance < pointsBurned.
- Maps `AmoeProofGenerationError('plonk_witness_input_invalid')` → 422.
- Maps `AmoeProofGenerationError('plonk_proof_generation_failed')` → 422.

### Concurrency (nonce store)

- Two concurrent submits with same nonce: exactly one wins, other 409.
- Nonce already consumed → 409.
- Nonce expired (TTL from `lotteryAmoe.ts`) → 409.

### Handler integration

- Happy path: full request → mocked snapshot → real `assembleAmoeWitness`
  → mocked prover (returns fixture proof) → mocked relay → 200.
- Rate limit: 7th submit in 60s → 429.
- Auth missing → 401.
- Method != POST → 405.

### Negative

- `pointsBurned` outside `[100, 1_000_000]` → 400 (existing helper).
- `creatorCoin` not address-like → 400.
- Body > 16 KiB → 413.

Target: 25–35 new tests. Total suite goes from 147 → ~180.

## 8. Resolved decisions

### 8.1 `signupIdHash` binding (LOCKED)

```
signupIdHash := canonicalizeAmoeBytes32ToField(
  'signupIdHash',
  keccak256(
    bigintToBe32Bytes(profiles.id) ‖ AMOE_SIGNUP_SALT
  )
)
```

Where `profiles.id` is the live Supabase **bigint** PK (the same column
the `points` ledger references via `points.signup_id`), resolved via:

1. Privy session → `privy_user_id` (`did:privy:…`).
2. Walk `privy_user_aliases` + `profiles.merged_into_profile_id`
   tombstone chain. The existing
   `resolveOrCreateProfileForWallet` helper
   (`server/_lib/lottery/lotteryAmoe.ts:352–419`) already does this.
3. `bigintToBe32Bytes(profiles.id)` is big-endian, zero-padded to 32
   bytes; concat with the server-side `AMOE_SIGNUP_SALT` env var,
   keccak256, canonicalize mod Q.

> An earlier version of this plan called `profiles.id` a UUID. That
> was wrong — it is a Postgres bigint. The full bigint-aware design
> (including how the points-burn ledger materializes this hash at
> projection time) lives in
> [`amoe-points-burn-ledger-sot.md`](./amoe-points-burn-ledger-sot.md)
> §2.

**Why this layer (and not Privy did, not wallet):**

| Layer | Stable across | Verdict |
|---|---|---|
| Wallet address | ❌ rotation | already in proof via `walletAddrCommit` — redundant |
| `privy_user_id` | ❌ account recovery (merged → alias) | a recovered human would fork their sybil identity |
| `profiles.id` | ✅ wallet rotation, ✅ account merges (tombstone chain) | the canonical durable identity |

The salt prevents read-access on the published ledger from rainbow-tabling
`signupIdHash → profiles.id`. Salt rotation is **not supported** — changing
it invalidates every prior nullifier and would let one human submit twice.

**Edge case (accepted):** entries submitted under two now-merged accounts
will have two different `signupIdHash` values for the same human. That is
the correct semantics — at submission time they were legitimately
distinct identities.

### 8.2 zkey hosting (LOCKED)

Ship from disk in PR 3. Bundle the zkey alongside the deployment so the
endpoint is end-to-end runnable in staging immediately. PR 6 swaps to
S3-signed URLs without changing the prover interface (`proveAmoeEntryPlonk`
already accepts a `zkeyUrl` option).

## 9. Open questions (deferred, not blocking PR 3)

1. **Prover runtime caps** — Vercel Node 18 serverless has 60s timeout,
   1 GB default mem. PLONK proves in ~2s warm but needs the zkey loaded.
   PR 3 ships from disk and measures cold-start cost; if it exceeds
   p95 SLO we either bump mem or pre-warm.
2. **Snapshot staleness SLO** — the stub returns whatever fixture is on
   disk. Real impl (PR 5) needs to define max staleness — leaning toward
   `current_epoch - 1` allowed, anything older rejected with
   `ledger_snapshot_stale`. Decided in PR 5.
3. **Salt provisioning** — `AMOE_SIGNUP_SALT` needs a one-time generation
   ceremony (32-byte cryptographically-random) and storage in Vercel env
   + the AMOE-scoped 1Password vault. **Done:** see
   [`docs/operations/deployment/amoe-signup-salt-provisioning.md`](../operations/deployment/amoe-signup-salt-provisioning.md)
   for the full runbook (generation, custody, non-rotation policy,
   verification, deploy-ticket checklist). Must be completed in each
   target environment before PR 3 cuts over.

## 10. Not to be touched

- `CreatorLotteryManager.sol` (per project rules — never without approval).
- The legacy `/submit-amoe` handler (`_amoeSubmit.ts`). Removed in a later PR.
- Submodule `lib/liquidity-launcher` (unrelated drift).

## 11. Rollout

1. Ship behind `AMOE_ZK_SUBMIT_ENABLED=false`.
2. Enable in staging once PR 5 (publisher) lands and verifier address is set.
3. Shadow-mode one week: clients still call legacy path; we mirror traffic
   and compare proof outputs against the ECDSA outcome offline.
4. Cut over by feature-flag flip; keep legacy path warm for one release.
5. Remove legacy path in a follow-up PR after one clean week.
