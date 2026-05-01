# Cursor / GPT-5.5 hygiene-sweep prompt — v1.10.1 pre-broadcast cleanup

**How to use this:** paste the body below as a single message in Cursor with
GPT-5.5. The agent has shell + repo access. This prompt runs **before**
`cursor-deploy-prompt-v1.10.1.md` step 9 (the prep-PR open) — its outputs
go into the same `release/v1.10.1-prep` branch.

This prompt does **not** touch on-chain state. It produces three things:

1. A clean codebase / docs / deployments tree with no stray references
   to addresses that v1.10.1 will orphan.
2. A reusable CI guard `tools/ci/check_no_orphan_addresses.sh` that
   keeps it that way.
3. A new doc `docs/operations/deployment/orphan-registry.md` that
   becomes the canonical record of every orphaned mainnet address
   from this rollout (and the template for future rollouts).

If anything below contradicts your understanding, **stop and ask**.

---

## Context

Five Base-mainnet addresses are about to be orphaned by v1.10.1:

| Address | What it is | Why orphaned |
|---|---|---|
| `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357` | v1.8.3 canonical `CreatorLotteryManager` | Pre-PR #395, missing all 3 AMOE selectors |
| `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` | Replacement-router target manager | Pre-PR #395, missing all 3 AMOE selectors |
| `0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759` | Replacement `LotteryAmoeRouter` | Wired correctly but its target manager has no AMOE handler |
| `0xA39A71a388816d657300EFffF1857F938AEF65D1` | Replacement `AmoePlonkVerifier` | Companion to the orphaned router |
| `0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F` | v1.9.0 abandoned router | Privy-CSW-owned, never wired |
| `0xd9bDFf55A886bADb011A12c447D72D174fD15964` | v1.9.0 abandoned verifier | Companion to the abandoned router |

Note: the last entry is also part of this sweep even though it didn't
appear on the v1.10.1 redeploy decision sheet. It's referenced from
`amoe-deploy-evidence-2026-05-01.md` and qualifies as orphaned.

Goal of this session: when v1.10.1 broadcasts, no doc, no config, no
deployments JSON, no Vercel env, no Supabase row, and no CI workflow
should be silently pointing at one of the six addresses above. The
*only* places they should appear in the repo after this sweep:

- `docs/operations/deployment/releases/v1.10.1-mainnet.md` — release
  notes orphan list
- `docs/operations/deployment/releases/v1.8.3-mainnet.md` — historical
  packet, references its own contemporaneous addresses
- `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` —
  the original evidence doc
- `docs/operations/deployment/orphan-registry.md` — created by this prompt
- `tools/ci/check_manager_amoe_surface.sh` — the AMOE-surface guard
  references `0xd593…1357` in a comment as the canonical
  baseline-negative-test address (intentional, do not remove)
- `tools/ci/check_no_orphan_addresses.sh` — the new guard, contains
  the orphan list itself
- this prompt and `cursor-deploy-prompt-v1.10.1.md`

Anything else that grep finds is stale and must be either removed,
replaced with a v1.10.1 placeholder, or annotated with an `# orphaned`
comment + link to the orphan registry.

---

## Hard rules (do not violate)

- Workspace root: wherever this repo is on your disk.
- Stage exclusion on every commit:
  `git add -A -- frontend/ supabase/ docs/ tools/ deployments/ test/ ':!lib/liquidity-launcher'`
- Git identity: `wenakita` / `info@akita.llc`. File-based commit
  messages (`-F /tmp/msg.txt`).
- Do NOT modify the historical v1.7.1, v1.8.1, v1.8.2, v1.8.3 release
  packets or their contemporaneous `addresses.md` snapshots. Those
  are historical record; we only update the *current* address tables
  and any *active* config.
- Do NOT modify `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md`
  itself. It is the broadcast evidence and must remain immutable.
  Instead, the v1.10.1 release notes will reference it.
- This sweep runs against `release/v1.10.1-prep` (the branch created
  by the main v1.10.1 prompt's step 3). Do not create a separate
  branch.

---

## 1. Pre-flight

1. `git rev-parse --abbrev-ref HEAD` → must be `release/v1.10.1-prep`
   (the branch created by `cursor-deploy-prompt-v1.10.1.md` step 3).
   If the prep branch does not exist yet, **stop** — run that prompt
   first up to and including its CHECKPOINT 1 (manifest), then come
   back here.
2. `git status --short` → only the expected drift on
   `lib/liquidity-launcher` (` m lib/liquidity-launcher`).
3. `vercel --version` and `vercel whoami` succeed. The user must
   already be logged in to the Vercel CLI as `akita-llc` org member.
4. `supabase --version` (or `psql --version`) is available, AND the
   user has the project ref `qajpnuvqlcfseghnldkl` configured. If
   not available, mark the Supabase step as "skipped, needs manual
   review" and continue.

### CHECKPOINT 0 — pre-flight signoff
Print the result of all 4 checks. Wait for "go".

---

## 2. Repo-wide grep sweep (codebase + docs + deployments)

### 2a. Run the inventory grep

From repo root:

```bash
ORPHAN_ADDRS=(
  0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357
  0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3
  0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759
  0xA39A71a388816d657300EFffF1857F938AEF65D1
  0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F
  0xd9bDFf55A886bADb011A12c447D72D174fD15964
)
PATTERN="$(IFS='|'; echo "${ORPHAN_ADDRS[*]}")"

# Case-insensitive — Solidity / docs / JSON all use mixed casing.
git grep -i -n -E "$PATTERN" -- ':!lib/liquidity-launcher' | tee /tmp/orphan-grep-raw.txt
```

Expected hit count: roughly 23 files based on the most recent main
sweep. Drop the result into `/tmp/orphan-grep-raw.txt`.

### 2b. Categorize every hit

For each file in the grep output, classify it into exactly one of:

- **HISTORICAL_FROZEN** — historical release packet, contemporaneous
  addresses doc, or evidence doc. Do not modify. Acceptable references:
  - `docs/operations/deployment/releases/v1.7.1-mainnet.md`
  - `docs/operations/deployment/releases/v1.8.1-mainnet.md`
  - `docs/operations/deployment/releases/v1.8.1-pre-broadcast-checklist.md`
  - `docs/operations/deployment/releases/v1.8.3-mainnet.md`
  - `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md`
    (if it shows up — it shouldn't in the grep above unless someone
    edited it)
  - `apps/docs-site/docs/operations/deployment/releases/...` (mirrors)
  - `apps/docs-site/docs/guides/deploy-vault.md` if the reference is
    in a "previous deployments" historical section

- **ACTIVE_NEEDS_UPDATE** — currently pointed at an orphan address as
  if it were live. Must be replaced with a v1.10.1 placeholder
  (`<v1.10.1 manager TBD post-broadcast>` or similar) OR deleted if
  the entry is no longer needed. Likely candidates:
  - `docs/reference/addresses.md` (if `0xd593…1357` is listed under
    "Current Live")
  - `apps/docs-site/docs/reference/addresses.md` (mirror)
  - `docs/reference/current-contract-inventory.md` and its mirror
  - `deployments/base/contracts/services/lottery/CreatorLotteryManager.json`
    (this file's `address` field is checked by client code that
    auto-imports the JSON — handle with care; see 2c below)
  - `deployments/base/shared-global-vanity-targets.json`
  - `deployments/base/v1.8.1-vanity-manifest.json` (likely
    HISTORICAL_FROZEN — verify)
  - `docs/guides/deploy-vault.md` and `apps/docs-site/docs/guides/deploy-vault.md`
    (if the example wiring uses an orphan address as the canonical
    target)
  - `docs/operations/contract-size-gate.md` — the v1.10.1 safety-net
    PR added a reference to `0xd593…1357` in the AMOE-surface guard
    section. Verify it's correctly contextualised as a baseline
    negative-test reference (acceptable) rather than as the
    operative manager (must-update).

- **CI_INTENTIONAL** — the address is intentionally referenced as a
  known-bad fixture. The only acceptable file:
  - `tools/ci/check_manager_amoe_surface.sh` — references
    `0xd593…1357` in a comment

- **TEST_TARGET** — guard scripts that pin the v1.8.3 epoch:
  - `test/v183-release-target-guard.sh` — this asserts v1.8.3
    addresses are present and pre-v1.8.2 ones are absent. After
    v1.10.1, this script becomes HISTORICAL — do NOT update it as
    part of this sweep. Mark it for deletion / rename in the
    post-broadcast follow-up PR (item B from the v1.10.1 plan).

For each ACTIVE_NEEDS_UPDATE file, propose the diff. Print all
proposed diffs as a single block.

### 2c. Special handling — `deployments/base/contracts/.../*.json`

These JSON files are typically auto-imported by the frontend or by
the deploy harness. Touching them blindly will break TS imports and
runtime config. For each `deployments/base/contracts/...` JSON file
that grep flagged:

1. `git log --oneline -- "$file" | head -10` — see when it was last
   touched and by which release.
2. `git grep -l "$(basename "$file" .json)"` — find all importers.
3. If any importer is in `frontend/` or `server/` or `script/`,
   classify as **NEEDS_RUNTIME_UPDATE** and stop touching it from
   this sweep. The fresh v1.10.1 deploy will overwrite the JSON
   anyway during step 14 of the main prompt, and the importers will
   pick up the new address automatically. Add to the "deferred to
   broadcast step" list.
4. If no importers exist (pure historical artifact), classify as
   HISTORICAL_FROZEN and leave it alone.

### CHECKPOINT 1 — categorization review
Show me the categorized list with file paths, classifications, and
proposed diffs (where applicable). Wait for "go" before applying any
edits.

### 2d. Apply the edits

After approval:

1. Apply each ACTIVE_NEEDS_UPDATE diff.
2. Re-run the grep. Confirm every remaining hit is in the
   HISTORICAL_FROZEN, CI_INTENTIONAL, TEST_TARGET, or
   NEEDS_RUNTIME_UPDATE category — no surprises.
3. Save the post-edit grep output as
   `/tmp/orphan-grep-postsweep.txt`.

### CHECKPOINT 2 — post-edit grep review
Show me the diff between `/tmp/orphan-grep-raw.txt` and
`/tmp/orphan-grep-postsweep.txt`, plus the list of ACTIVE_NEEDS_UPDATE
files actually changed. Wait for "go".

---

## 3. Vercel production env inventory

The evidence doc shows v1.9.x left these production env vars set
pointing at orphan addresses:

- `LOTTERY_AMOE_ROUTER` → likely `0xC618…3759`
- `BASE_RPC_URL` → not address-specific, leave alone
- `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY` → key, not address; leave alone
- `AMOE_LEDGER_PUBLISHER_SMART_WALLET` → likely an off-chain CSW
  address; verify it's still the operative one for v1.10.1 (it
  probably is — the publishers don't change in v1.10.1)

### 3a. List

```bash
vercel env list production --cwd frontend 2>&1 | tee /tmp/vercel-env-prebroadcast.txt
```

Or whichever path holds the Vercel-linked project (check `vercel.json`
or `.vercel/project.json` for the project root).

### 3b. Identify drift

For each env var matching `^LOTTERY_|^AMOE_|.*_ROUTER$|.*_VERIFIER$|.*_MANAGER$`,
classify as:

- **ORPHAN_REF** — currently points at one of the 6 orphan addresses.
  Will be overwritten in step 14 of the main prompt. Add to a list
  printed at the end of CHECKPOINT 3.
- **CARRY_FORWARD** — points at an off-chain identity (publisher
  EOAs, smart wallets) that v1.10.1 keeps. No action.
- **UNRELATED** — not touched by AMOE / lottery wiring. No action.

Note: `vercel env list` does not print values for sensitive vars by
default. If you need to verify a specific value, use
`vercel env pull /tmp/.env.production --environment production`,
read locally, and **delete `/tmp/.env.production` before the session
ends.** Treat that file as a secret.

### 3c. Do NOT modify Vercel env in this session

Updating `LOTTERY_AMOE_ROUTER` etc. happens in step 14 of the main
prompt, AFTER broadcast. This sweep just produces the inventory and
the diff plan. Save the plan as a doc:

`docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md` —
contains, for each ORPHAN_REF var, the current value, the v1.10.1
target placeholder (`<TBD post-broadcast>`), and the `vercel env rm`
+ `vercel env add` commands to run during step 14.

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 3 — Vercel env inventory + plan review

---

## 4. Supabase config inventory

The AMOE rollout shipped Supabase migrations to project
`qajpnuvqlcfseghnldkl`. Some of those tables almost certainly carry
the orphan router/manager address as a default or as seed data.

### 4a. List candidate tables

If the `supabase` CLI is available and configured for the project,
run:

```bash
supabase db dump --schema public --data-only 2>&1 | grep -iE "0xc618|0xd593|0x3f7afd|0xa39a|0xd588|0xd9bd" | tee /tmp/supabase-orphan-rows.txt
```

If the CLI is not configured, the user must run the equivalent SQL
in the Supabase dashboard SQL editor:

```sql
-- run this against project qajpnuvqlcfseghnldkl
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE '%address%'
   OR column_name ILIKE '%router%'
   OR column_name ILIKE '%manager%'
   OR column_name ILIKE '%verifier%'
ORDER BY table_schema, table_name;
```

Then for each candidate column, the user runs targeted SELECT queries
checking for the 6 orphan addresses (case-insensitive — Postgres
stores the original casing).

### 4b. Categorize

Same scheme as Vercel:

- **ORPHAN_REF** — row(s) point at an orphan address. Plan an UPDATE.
- **CARRY_FORWARD** — points at off-chain identity that v1.10.1 keeps.
- **UNRELATED**.

### 4c. Do NOT modify Supabase in this session

Same rule as Vercel — the actual updates happen during step 14 of
the main prompt. This sweep produces the plan:

`docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md`
— contains, per ORPHAN_REF row, the current value, the v1.10.1 target
placeholder, and the SQL to run during step 14.

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 4 — Supabase inventory + plan review

---

## 5. CI / GitHub Actions / cron sweep

Beyond the code grep in section 2, there are runtime systems that
might hardcode an orphan address:

1. **GitHub Actions workflows** — `.github/workflows/*.yml`. The grep
   in 2a should have caught them, but double-check by running the
   same grep restricted to `.github/`.
2. **Vercel cron jobs / scheduled functions** — defined in
   `vercel.json`. Inspect for any AMOE / lottery cron configuration
   that hardcodes an address (almost certainly none — they typically
   read from env, but verify).
3. **Repo-internal cron / scheduled scripts** — `find . -name "*cron*"`
   and check each match.
4. **README / top-level dotfiles** — `git grep` against the orphan
   address list, restricted to `^README\|^\.env\.example\|^\.env\.\*`.

For each hit, follow the same categorization scheme as section 2.

### CHECKPOINT 5 — CI / cron sweep review

---

## 6. Create `tools/ci/check_no_orphan_addresses.sh`

Model on the existing `test/v183-release-target-guard.sh` precedent.

Specification:

- Bash script, `set -euo pipefail`, lives at
  `tools/ci/check_no_orphan_addresses.sh`, mode 755.
- Hardcodes the 6 orphan addresses as a `readonly` array at the top.
- Hardcodes a `WHITELIST` array of file paths where the orphan
  addresses are intentionally allowed (release notes, evidence doc,
  the AMOE-surface guard, the orphan registry, this prompt's mate
  in `docs/`, etc. — see the "Anything else that grep finds is stale"
  list at the top of this prompt).
- Runs `git grep -i -E "<orphan-pattern>"` and exits 1 if any hit
  is outside the whitelist.
- Prints a diff-friendly error message: which address, which file,
  which line, plus a hint pointing at
  `docs/operations/deployment/orphan-registry.md`.
- Emits a `[WHITELISTED]` info line for each whitelisted hit so the
  CI log shows the script saw them and accepted them — defends
  against a "whitelist accidentally swallowed all hits" failure mode.

Wire into a workflow:

- Add a small `Orphan-address sweep` job to
  `.github/workflows/test.yml` (or a fresh
  `.github/workflows/orphan-guard.yml` — your call; the test.yml
  approach minimises new files but the standalone workflow makes
  the failure surface obvious in PR checks. Recommend the latter.)
- Triggers: `pull_request` to main + `workflow_dispatch`. Not on
  push (no need to fail a merged PR).
- Foundry pin v1.7.0 NOT required (this guard is pure bash).

### CHECKPOINT 6 — guard script + workflow review

---

## 7. Create the orphan registry doc

Path: `docs/operations/deployment/orphan-registry.md`

Structure:

```markdown
# Orphan address registry (Base mainnet)

Canonical record of every Base-mainnet contract deployed by this
protocol that is no longer wired into the live system. New entries
go at the top; never edit existing entries.

## Schema

| Field | Description |
|---|---|
| Address | 0x… 20-byte checksummed |
| Kind | router / verifier / manager / infra |
| Deployed by release | e.g. v1.8.3, v1.9.0 |
| Orphaned by release | e.g. v1.10.1 |
| Reason | One-sentence why |
| Owner at orphan time | EOA / Safe / contract |
| Cleanup actions taken | basescan label / ownership renounced / balance swept / none |
| Cleanup date | YYYY-MM-DD |
| Evidence | link to release notes / evidence doc |

## Entries

### Orphaned by v1.10.1 (2026-05-XX)

(one row per address from the 6 in section 0 of this prompt)
```

Fill in the 6 entries from the table at the top of this prompt.
Cleanup-actions and cleanup-date columns: leave as `pending — see
post-broadcast follow-up PR` for now. Those get filled in by the
post-v1.10.1 prompt B.

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 7 — orphan registry review

---

## 8. Hand-off

After CHECKPOINT 7, this sweep is done. The `release/v1.10.1-prep`
branch now contains, in addition to whatever the main prompt put on
it:

- Active doc / config / deployments edits removing orphan refs
  (section 2)
- `docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md`
  (section 3)
- `docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md`
  (section 4)
- `tools/ci/check_no_orphan_addresses.sh` + workflow (section 6)
- `docs/operations/deployment/orphan-registry.md` (section 7)

The main prompt resumes at its step 9 (open the prep PR), which
should now include all of the above on top of the manifest /
checklist / release-notes / skip-vanity work.

The post-broadcast prompt (B) will fill in the cleanup-actions and
cleanup-date columns of the orphan registry, run the Vercel /
Supabase update plans, submit Basescan name-tag updates, and decide
the renounce-ownership question per address.

---

## Stop conditions

- Section 2 grep finds an orphan address in `frontend/src/`,
  `server/`, `api/`, `scripts/`, or any `.ts` / `.sol` / `.py`
  source file — treat as ACTIVE_NEEDS_UPDATE and review carefully,
  do not auto-edit production source without explicit approval.
- Section 3 finds a Vercel env var named exactly `LOTTERY_AMOE_ROUTER`
  pointing at `0xd588…b22f` (the abandoned router with the Privy CSW
  owner). That would mean the v1.9.x replacement deploy didn't
  actually update production env, contradicting the evidence doc.
  Halt and ask.
- Section 4 finds a Supabase row with an orphan router as a
  foreign-key target in any non-config table (events, entries,
  ledger). Halt — that's an active data-integrity issue, not a
  config-cleanup issue.
- Any whitelist in section 6's guard script ends up containing more
  than ~10 entries — the goal is for orphan addresses to live in a
  small, audited set of files. A long whitelist suggests the sweep
  in section 2 wasn't aggressive enough.

When in doubt, **stop and ask.**
