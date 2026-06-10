---
title: AMOE Signup Salt Provisioning
sidebar_position: 12
---

# AMOE Signup Salt Provisioning Runbook

This runbook covers the one-time generation, provisioning, custody, and
rotation policy for `AMOE_SIGNUP_SALT` — the server-side secret that
binds Supabase `profiles.id` to the on-chain `signupIdHash` nullifier in
the AMOE PLONK circuit.

**Owner:** AMOE / lottery on-call
**Required before:** `feat/amoe-zk-submit-handler` (PR 3 of the AMOE ZK
migration) ships to any environment with a real verifier wired in.
**Related:**
- [`docs/security/amoe-pr3-handler-swap-plan.md`](../../security/amoe-pr3-handler-swap-plan.md) — design + decision context
- [`docs/security/amoe-pr2-handoff.md`](../../security/amoe-pr2-handoff.md) — sibling AMOE secret-scope notes
- [`docs/security/amoe-plonk-migration.md`](../../security/amoe-plonk-migration.md) — full §2 migration arc

---

## 1. What this salt is

```
signupIdHash := canonicalizeAmoeBytes32ToField(
  'signupIdHash',
  keccak256(
    bigintToBe32Bytes(profiles.id) ‖ AMOE_SIGNUP_SALT
  )
)
```

Where:

- `profiles.id` is the live (non-merged) Supabase profile **bigint**
  (the `profiles` PK; same column the `points` ledger references via
  `points.signup_id`), resolved through the `privy_user_aliases` +
  `merged_into_profile_id` tombstone chain. The existing
  `resolveOrCreateProfileForWallet` helper in
  `server/_lib/lottery/lotteryAmoe.ts` (lines 352–419) already
  performs this resolution and is the helper to reuse.
- `bigintToBe32Bytes` is big-endian, zero-padded to 32 bytes so e.g.
  `profiles.id = 5` and `profiles.id = 5_000_000` produce different
  hashes with no leading-zero ambiguity.
- An earlier draft of this runbook called `profiles.id` a UUID. That
  was incorrect — it is a Postgres bigint. The hashing inputs above
  are the corrected, schema-accurate version.
- `AMOE_SIGNUP_SALT` is a 32-byte cryptographically-random value held
  only by the AMOE submit-handler runtime.
- `canonicalizeAmoeBytes32ToField` reduces mod the BN254 field modulus
  (see `server/_lib/lottery/amoeWitness.ts`).

The resulting `signupIdHash` becomes a private witness signal in the
PLONK proof and contributes to the public `pointsBurnNullifier`. It is
the **lifetime sybil-prevention key** for AMOE — one human, one
`profiles.id`, one `signupIdHash`, regardless of wallet rotation or
Privy account recovery.

## 2. Why a server-side salt

The published points-ledger root commits to ledger leaves of the form
`Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch,
walletAddrCommit)`. Without a salt, anyone with read access to the
ledger snapshot could:

1. Enumerate every Supabase `profiles.id` (or guess a small space if
   they have any partial user list).
2. Compute `keccak256(profiles.id)`.
3. Match against the published `signupIdHash` values to deanonymize
   which user submitted which ledger entry.

The salt collapses this attack from "rainbow-table the user table" to
"breach the AMOE submit handler's runtime secrets." The relay key
scope (see [`amoe-pr2-handoff.md`](../../security/amoe-pr2-handoff.md))
already documents that posture.

## 3. Generation ceremony

**Do this once per environment.** Each of `staging` and `production`
gets its own independently-generated salt. They MUST NOT share a value.

### 3.1 Pre-flight

- [ ] You are running on a clean local machine (not a shared VM, not
      CI, not the agent sandbox).
- [ ] Terminal history is disabled or will be wiped after this session
      (`unset HISTFILE` or equivalent).
- [ ] You have Vercel CLI authenticated to the target project
      (`vercel whoami`).
- [ ] You have access to the AMOE relayer KMS / 1Password vault for
      backup custody.

### 3.2 Generate

```bash
# 32 bytes of OS randomness, hex-encoded, with a leading 0x.
SALT="0x$(openssl rand -hex 32)"

# Sanity: must be exactly 66 chars (0x + 64 hex).
[ "${#SALT}" -eq 66 ] || { echo "BAD LENGTH: ${#SALT}"; unset SALT; }
```

Do NOT echo `$SALT` to the terminal. Do NOT paste it into a chat
client. Do NOT commit it. The next two steps are the only places it
should ever appear.

### 3.3 Provision to Vercel (target environment)

```bash
# Replace <env> with: production | preview | development
echo -n "$SALT" | vercel env add AMOE_SIGNUP_SALT <env>
```

Vercel encrypts at rest. Verify the variable now exists without
revealing its value:

```bash
vercel env ls | grep AMOE_SIGNUP_SALT
```

### 3.4 Backup custody

Store a copy in the AMOE-scoped 1Password vault under the item name:

```
AMOE_SIGNUP_SALT — <env> — generated YYYY-MM-DD
```

Tag with `secret`, `amoe`, `non-rotatable`. Add a note containing the
generation date, the operator's GitHub handle, and the SHA-256 of the
salt (NOT the salt itself; the SHA lets us verify recovered backups
without ever printing the secret).

```bash
echo -n "$SALT" | sha256sum
```

### 3.5 Cleanup

```bash
unset SALT
history -c   # if your shell records anything
```

## 4. Custody policy

| Where | Allowed | Why |
|---|---|---|
| Vercel env (encrypted at rest) | ✅ | runtime read by submit handler |
| 1Password AMOE vault | ✅ | break-glass recovery |
| Terminal history | ❌ | `unset HISTFILE` before generation |
| Source control | ❌ | never |
| `.env` files on developer machines | ❌ | local dev uses a fixed test salt — see §6 |
| Logs, error messages, stack traces | ❌ | the handler must not log it |
| CI pipelines | ❌ | proof generation in CI uses fixtures |
| Slack, email, tickets, design docs | ❌ | reference by SHA-256 only |
| Agent sandbox / Computer environments | ❌ | sandbox-issued envs are not permitted to read this var |

The AMOE submit handler reads `AMOE_SIGNUP_SALT` once at module init
and never logs the value. Any error path that mentions the salt by
name must reference it generically (e.g. `"AMOE_SIGNUP_SALT not
configured"`); never include the value or a prefix of it.

## 5. Rotation policy

**Salt rotation is not supported.**

Rotating the salt would change `signupIdHash` for every existing user,
which means:

- Every prior AMOE entry's nullifier would no longer match the user's
  new identity hash.
- A single human could legitimately submit twice — once under the old
  salt, once under the new — defeating the lifetime sybil bound that
  is the salt's reason for existing.
- The published ledger roots would still commit to old-salt nullifiers,
  so the on-chain history would be permanently desynced from the
  off-chain identity.

If the salt is **confirmed compromised**, the response is not rotation;
it is:

1. Pause AMOE submissions via the existing kill switch
   (`AMOE_ZK_SUBMIT_ENABLED=false` + relayer disable).
2. File an incident under the standard security-incident process.
3. Decide whether to take the AMOE program offline pending counsel
   review, since the sybil model is broken and any continued submissions
   would have to be treated as untrusted.

Do NOT rotate the salt as a routine hygiene measure. Treat it like a
chain-of-custody artifact, not a credential.

## 6. Local development

Local dev and CI use a deterministic test salt:

```
AMOE_SIGNUP_SALT_TEST_FIXTURE = 0x000…01 (defined in the test setup)
```

This is a **fixture**, not a secret. It is checked into the test
harness so witness round-trips and fixture regeneration are
reproducible. The submit handler will refuse to start in
`NODE_ENV=production` if the salt equals the fixture value (guard added
in the same PR that introduces this runbook entry).

## 7. Verification

After provisioning, verify the handler is configured correctly:

### 7.1 Server-side

```bash
# Vercel logs after the next deploy should contain (and only this):
#   amoe.submit-zk: salt configured ok (sha256=<8-char-prefix>)
# It must NOT contain the salt itself or a longer SHA prefix.
vercel logs --since 5m | grep "amoe.submit-zk: salt"
```

### 7.2 SHA cross-check

The 8-char SHA-256 prefix logged at boot must match the one stored in
1Password from §3.4. If it does not, the salt in Vercel env is not
the salt of record — stop, rotate the runbook entry by re-running §3,
and investigate which path was tampered with.

### 7.3 First end-to-end submission

In staging, submit one real entry through the new handler and confirm:

- The proof verifies on-chain.
- The `pointsBurnNullifier` published in the resulting ledger leaf
  matches the value computed locally from the same `(profiles.id,
  AMOE_SIGNUP_SALT)` pair.

## 8. Decommissioning

If the AMOE program is wound down, the salt is destroyed by:

1. `vercel env rm AMOE_SIGNUP_SALT <env>` for each environment.
2. Archive the 1Password item (do not delete — historical
   `pointsBurnNullifier` values committed to chain reference it, and
   a future audit may need to reconstruct them).
3. Mark the 1Password item with `decommissioned YYYY-MM-DD` and the
   final ledger root that referenced this salt.

## 9. Checklist (copy into deploy ticket)

- [ ] Generated 32-byte salt on a clean machine (§3.2)
- [ ] Provisioned to Vercel env via `vercel env add` (§3.3)
- [ ] SHA-256 prefix recorded in 1Password (§3.4)
- [ ] Local terminal cleaned, `$SALT` unset (§3.5)
- [ ] Verified handler boot log shows matching SHA prefix (§7.1, §7.2)
- [ ] First staging submission round-trips end-to-end (§7.3)
- [ ] Linked this checklist back into the AMOE PR 3 deploy ticket

---

**Last updated:** 2026-04-28
**Next review:** at PR 3 cutover, then never (per §5 — salt is
non-rotatable).
