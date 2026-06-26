Status of this prompt
This skeleton has TWO sections that are intentionally placeholdered:

§3 (Vercel env updates) — the exact vercel env rm / vercel env add
commands come from docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md,
which is produced by the cleanup prompt's CHECKPOINT 3. Until that doc
exists, this section is a stub.

§4 (Supabase updates) — same story. Commands come from
docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md
(cleanup prompt CHECKPOINT 4).

When the cleanup prompt has run, **stop here, re-paste the contents of
both planning docs into §3 and §4 below**, then proceed. The agent
should refuse to run §3 or §4 until those substitutions are in place.

Everything else (renounce-decision matrix, balance sweep, Basescan
labels, registry fill-in, v1.8.3 guard retirement, follow-up PR) is
fully specified.

Context
The v1.10.1 broadcast has completed. As of this prompt's run:

Fresh CreatorLotteryManager, LotteryAmoeRouter, AmoePlonkVerifier,
and 17 infra contracts are live on Base mainnet. Addresses recorded
in docs/operations/deployment/releases/v1.10.1-mainnet.md.

The new manager passed the AMOE selector-surface guard (positive test)
and both legacy managers (0xd593…1357 and 0x3F7AfD…b0C3) failed
it (baseline negative test) — see CHECKPOINT 8 evidence in the
v1.10.1 broadcast log.

manager.authorizedAmoeRelayer == address(0) — the §3.0.5 trust
handoff is intentionally deferred and is **out of scope for this
prompt**.

The release/v1.10.1-broadcast-evidence PR is merged to main.

What this prompt does:

Run the queued Vercel env updates (from cleanup prompt's plan doc).

Run the queued Supabase config updates (from cleanup prompt's plan
doc).

Sweep on-chain balances on the 6 orphans.

Apply Basescan deprecation name tags to the 6 orphans.

Fill in the cleanup columns of orphan-registry.md.

Retire test/v183-release-target-guard.sh.

Open a single post-broadcast cleanup PR with all of the above.

What this prompt does not do:

Renounce ownership on any orphan. The renounce-decision matrix in §5
defaults to "do not renounce" for every entry. If you want to revisit
that, make it a separate later PR.

Touch manager.setAuthorizedAmoeRelayer(<router>). That is §3.0.5 of
amoe-flag-rollout-plan.md and runs after the 48h safe-mode soak.

Flip any AMOE_*_ENABLED flag.

The full 6-orphan list (from cursor-deploy-prompt-v1.10.1-cleanup.md §0):

Address	Kind	Owner
0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357	v1.8.3 canonical manager	EOA 0xB05C…0FdD (Safe signer)
0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3	replacement-router target manager	(verify on chain)
0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759	replacement router	Safe 0x7d42…f2d3
0xA39A71a388816d657300EFffF1857F938AEF65D1	replacement verifier	(no owner — verifier)
0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F	v1.9.0 abandoned router	Privy CSW 0x6C0E…f9b3
0xd9bDFf55A886bADb011A12c447D72D174fD15964	v1.9.0 abandoned verifier	(no owner — verifier)
Hard rules (do not violate)
Workspace root: wherever this repo is on your disk.

Foundry: export PATH="$HOME/.foundry/bin:$PATH" for any cast calls.

Stage exclusion on every commit:
git add -A -- frontend/ supabase/ docs/ tools/ test/ ':!lib/liquidity-launcher'

Git identity: wenakita / info@akita.llc. File-based commit messages.

This prompt runs against a fresh branch chore/v1.10.1-orphan-finalization,
branched from current main (which now contains the v1.10.1 broadcast
evidence merge).

Do NOT modify docs/operations/deployment/releases/v1.10.1-mainnet.md
or the broadcast evidence doc. They are immutable record.

Do NOT make any on-chain transaction other than the read-only `cast
balance / cast call` queries in §5. No ownership transfers, no
renouncements, no balance sweeps via tx in this session.

The Basescan name-tag submissions in §6 happen via the public
Basescan web form — the prompt prints the form payloads, the user
submits each manually. Cursor does not have Basescan API access.

§1. Pre-flight
git rev-parse --abbrev-ref HEAD → must be main. Pull cleanly.

git log --oneline -5 → top entry is the merged
release/v1.10.1-broadcast-evidence PR.

cat docs/operations/deployment/releases/v1.10.1-mainnet.md | head -60
confirms address table is filled in (no <TBD> placeholders).

amoe/tools/ci/check_no_orphan_addresses.sh exits 0 (the sweep guard
from cleanup prompt §6 must already be passing on main).

amoe/tools/ci/check_manager_amoe_surface.sh <NEW_V1.10.1_MANAGER> https://mainnet.base.org
exits 0 with all 3 selectors found. Capture the new manager
address from v1.10.1-mainnet.md — call it $NEW_MANAGER for
the rest of this prompt.

Required artifacts from cleanup prompt exist:

docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md

docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md

docs/operations/deployment/orphan-registry.md
If any is missing, stop. The cleanup prompt didn't run.

vercel whoami succeeds; user is in the akita-llc org.

Create the working branch:
git checkout -b chore/v1.10.1-orphan-finalization

CHECKPOINT 0 — pre-flight signoff
Print the result of all 8 checks. Wait for "go".

§2. On-chain balance sweep
Read-only. For each of the 6 orphan addresses + the new v1.10.1 manager
(as a sanity baseline), run:

bash
for addr in \
  0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357 \
  0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3 \
  0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759 \
  0xA39A71a388816d657300EFffF1857F938AEF65D1 \
  0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F \
  0xd9bDFf55A886bADb011A12c447D72D174fD15964 \
  $NEW_MANAGER
do
  bal=$(cast balance "$addr" --rpc-url https://mainnet.base.org)
  printf '%-44s %s wei\n' "$addr" "$bal"
done | tee /tmp/v1.10.1-orphan-balances.txt
Expected: every orphan returns 0. The new manager may have a tiny
gas-rebate balance from the deploy script; that's fine.

If any orphan has non-zero balance, halt. That requires a
recovery decision (Safe sweep tx, Privy CSW path investigation,
or write-off) which is out of scope for this prompt and needs its
own dedicated session.

Save /tmp/v1.10.1-orphan-balances.txt for inclusion in the
follow-up PR body.

CHECKPOINT 1 — balance sweep result
§3. Vercel production env updates
**⚠️ This section is a STUB. Before running, paste the per-var command
blocks from docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md
into the marked region below.**

The cleanup prompt's plan doc enumerates, per ORPHAN_REF env var:

the var name

the current value (orphan address)

the v1.10.1 target value

the exact vercel env rm and vercel env add commands

The expected vars are some subset of:

LOTTERY_AMOE_ROUTER (currently 0xC618…3759, target = new v1.10.1 router)

any *_MANAGER, *_VERIFIER vars

Note: BASE_RPC_URL and the publisher key/wallet vars are
CARRY_FORWARD per the cleanup prompt — do NOT touch them.

Procedure (per env var)
For each var X with current value V_old and target V_new:

bash
# read-back: confirm current value is what the plan says
vercel env pull /tmp/.env.production --environment production --cwd <project-root>
grep "^${X}=" /tmp/.env.production
# value MUST match V_old. If not, halt — env state has drifted from plan.

# rotate
echo "${V_new}" | vercel env add "${X}" production --cwd <project-root> --force
# (--force overrides the existing value; if the CLI prompts, type 'y')

# verify
vercel env pull /tmp/.env.production --environment production --cwd <project-root>
grep "^${X}=" /tmp/.env.production
# value MUST now equal V_new.

# cleanup
shred -u /tmp/.env.production 2>/dev/null || rm -f /tmp/.env.production
After all vars are rotated:

bash
# Re-deploy production so the new env values are in the running pod.
vercel deploy --prod --cwd <project-root> 2>&1 | tee /tmp/v1.10.1-postsweep-deploy.log
Capture the deployment id and the production alias (should remain
https://4626.fun).

Then re-run the AMOE smoke check from
amoe-deploy-evidence-2026-05-01.md — all 5 endpoints must still
return 503 with the disabled errors. The whole point of v1.10.1 is
that production stays at the same disabled-AMOE phase 0 baseline,
just with correct addresses underneath.

bash
for path in submit-zk burn-credits publish-cron burn-refund-cron retry-cron; do
  printf '%-22s ' "$path"
  curl -s -o /tmp/resp.json -w 'HTTP %{http_code}  ' "https://4626.fun/api/lottery/amoe/${path}"
  cat /tmp/resp.json
  echo
done | tee /tmp/v1.10.1-postsweep-smoke.txt
(Adjust the URL paths to match what the evidence doc actually used —
the path schema may differ.)

Save /tmp/v1.10.1-postsweep-smoke.txt for the PR body.

text
<<< INSERT v1.10.1-vercel-env-plan.md COMMAND BLOCKS HERE >>>
CHECKPOINT 2 — Vercel rotation result
Show me the per-var rotation log, the deploy id, and the smoke-check
output. Wait for "go".

§4. Supabase production config updates
**⚠️ This section is a STUB. Before running, paste the SQL UPDATE
blocks from docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md
into the marked region below.**

The cleanup prompt's plan doc enumerates, per ORPHAN_REF row:

the table + column

the current value (orphan address)

the v1.10.1 target value

the exact UPDATE statement, with a WHERE clause that uniquely
identifies the row

Procedure (per row)
For each UPDATE U:

Run the SELECT version of U first (replace UPDATE with
SELECT *) — confirm exactly one row matches and its current
value is what the plan says.

Run U inside a transaction:

sql
BEGIN;
UPDATE …;
-- verify row count == 1
-- if 0 or >1, ROLLBACK; halt.
COMMIT;
Re-run the SELECT — confirm new value is in place.

Save the per-row before/after as a single text block:
/tmp/v1.10.1-supabase-rotation.txt.

If any row's WHERE clause matches more than one row, halt — the
plan doc was wrong, that's a stop condition.

text
<<< INSERT v1.10.1-supabase-update-plan.md SQL BLOCKS HERE >>>
CHECKPOINT 3 — Supabase rotation result
§5. Renounce-decision matrix
This is documentation only. No on-chain action.

For each of the 6 orphans, record the renounce decision in the
follow-up PR body and in orphan-registry.md. Default decisions
(do not change without explicit user override):

Address	Renounce?	Reason
0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357 (v1.8.3 manager)	NO	Owned by Safe signer EOA. Renouncing locks the door against any future forensic recovery. The owner is already trustworthy.
0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3 (replacement-router target manager)	NO	Same reasoning. (Verify the owner on chain — should be similarly trustworthy.)
0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759 (replacement router)	NO	Owned by Safe 0x7d42…f2d3. Keeping Safe ownership preserves the option to sweep stuck ETH/tokens or pause-then-decommission cleanly. The Safe is the same one that owns the v1.10.1 router.
0xA39A71a388816d657300EFffF1857F938AEF65D1 (replacement verifier)	N/A	Verifier contracts have no owner. Nothing to renounce.
0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F (v1.9.0 abandoned router)	N/A	Owner is the Privy CSW EOA 0x6C0E…f9b3, whose execution path was unavailable per the original evidence doc. We cannot renounce because we cannot transact from that owner.
0xd9bDFf55A886bADb011A12c447D72D174fD15964 (v1.9.0 abandoned verifier)	N/A	No owner.
Step
For each of the 4 ownership-bearing entries, run
cast call <addr> "owner()(address)" --rpc-url https://mainnet.base.org
and record the actual on-chain owner. Save to
/tmp/v1.10.1-orphan-owners.txt.

If any actual owner differs from what the table above expects,
halt and ask. The matrix's reasoning depends on these owner
identities.

Otherwise, no further action — the matrix is recorded as-is in
the follow-up PR.

CHECKPOINT 4 — owner verification
§6. Basescan deprecation name tags
This is a manual step. Cursor prints the form payloads; the user
submits each via https://basescan.org/contactus?id=5
(the public name-tag update form), one address at a time.

Print this block as a single message:

text
=== BASESCAN NAME TAG SUBMISSIONS — submit each separately ===

Address:  0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357
Tag:      Akita 4626 — Deprecated v1.8.3 Manager
Note:     Pre-PR #395 build, missing AMOE selectors. Replaced by v1.10.1
          manager <NEW_MANAGER>. Do not interact. See:
          https://github.com/wenakita/4626/blob/main/docs/operations/deployment/releases/v1.10.1-mainnet.md

Address:  0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3
Tag:      Akita 4626 — Deprecated v1.9.x Manager
Note:     Pre-PR #395 build, missing AMOE selectors. Was target of
          replacement router 0xC618…3759. Replaced by v1.10.1 manager
          <NEW_MANAGER>. Do not interact. See: <link>

Address:  0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759
Tag:      Akita 4626 — Deprecated v1.9.x AMOE Router
Note:     Correctly Safe-owned but its target manager has no AMOE
          handler. Replaced by v1.10.1 router <NEW_ROUTER>. Do not
          interact. See: <link>

Address:  0xA39A71a388816d657300EFffF1857F938AEF65D1
Tag:      Akita 4626 — Deprecated v1.9.x AMOE PLONK Verifier
Note:     Companion to deprecated router 0xC618…3759. Replaced by
          v1.10.1 verifier <NEW_VERIFIER>. See: <link>

Address:  0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F
Tag:      Akita 4626 — Abandoned v1.9.0 AMOE Router (CSW-owned)
Note:     Owned by Privy custodial smart wallet whose execution path
          is unavailable. Never received production wiring. Replaced
          by v1.10.1 router <NEW_ROUTER>. See: <link>

Address:  0xd9bDFf55A886bADb011A12c447D72D174fD15964
Tag:      Akita 4626 — Abandoned v1.9.0 AMOE PLONK Verifier
Note:     Companion to abandoned router 0xd588…b22f. Replaced by
          v1.10.1 verifier <NEW_VERIFIER>. See: <link>

=== END ===
Substitute <NEW_MANAGER>, <NEW_ROUTER>, <NEW_VERIFIER>, and
<link> with the actual values from v1.10.1-mainnet.md.

The user submits each, captures the Basescan ticket number from the
confirmation, and pastes the 6 ticket numbers back into Cursor.

CHECKPOINT 5 — Basescan ticket numbers
Wait for the 6 ticket numbers. Record them in the orphan registry.

§7. Fill in the orphan registry
Open docs/operations/deployment/orphan-registry.md. The 6 entries
created by the cleanup prompt have placeholder values in three columns:

Cleanup actions taken

Cleanup date

Evidence (partial — has the v1.10.1 release notes link, may be
missing this PR link until §9)

For each entry, fill in:

Cleanup date: today's date (YYYY-MM-DD).

Cleanup actions taken: comma-separated list, e.g.
`Basescan tag (ticket #ABC123); Vercel LOTTERY_AMOE_ROUTER rotated;
Supabase config row updated; ownership: kept (Safe-owned)`.

Evidence: add a link to this prompt's follow-up PR (placeholder
<post-broadcast-cleanup-pr-url> — substitute after PR open in §9).

Commit to chore/v1.10.1-orphan-finalization:

text
chore(v1.10.1): orphan registry — fill in cleanup actions for 6 v1.8.3/v1.9.x orphans
CHECKPOINT 6 — registry diff review
§8. Retire test/v183-release-target-guard.sh
This script asserts the v1.8.3 epoch is canonical. Post-v1.10.1,
that assertion is wrong:

It rg's for 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb and
0xcDbEeB764df9878ebAFbf101cc818370f703bC4F in addresses.md
and exits 1 if absent. After v1.10.1, those v1.8.3 addresses
should NOT be in the "Current Live Infrastructure" section.

It greps Current Live Infrastructure (\v1.8.3`)` as a
required heading. After v1.10.1, that heading reads
Current Live Infrastructure (\v1.10.1`)`.

Steps
Confirm no other test or workflow references this guard:
git grep -l "v183-release-target-guard" → expected hits are
only the script itself plus possibly a CI workflow file.

If a CI workflow runs it, remove the workflow step.

git rm test/v183-release-target-guard.sh.

(Optional but recommended) drop a successor stub
test/v1100-release-target-guard.sh that does the same kind of
pinning for v1.10.1 — same hardcoded-list-with-whitelist pattern,
pointing at the v1.10.1 manager / router / verifier / 17 infra
addresses. This is the safety counterpart to the orphan-address
guard from cleanup prompt §6: that one says "no orphan addresses
leaking in"; this one says "the canonical v1.10.1 addresses
are still where we expect."

Commit to chore/v1.10.1-orphan-finalization:

text
chore(v1.10.1): retire v1.8.3 release-target guard, add v1.10.1 successor
CHECKPOINT 7 — guard retirement diff review
§9. Open the follow-up PR
Push chore/v1.10.1-orphan-finalization and open a PR to main.

PR title:
chore(v1.10.1): orphan finalization — Vercel/Supabase rotation, Basescan labels, registry fill-in, retire v1.8.3 guard

PR body must contain, in this order:

Summary — one paragraph: "Closes the v1.10.1 redeploy by
rotating production references off the 6 orphaned addresses,
labeling each on Basescan as deprecated, and retiring the v1.8.3
epoch guard."

Vercel rotation — paste contents of /tmp/v1.10.1-postsweep-deploy.log
summary line + the full smoke-check output from §3.

Supabase rotation — paste contents of
/tmp/v1.10.1-supabase-rotation.txt.

Balance sweep — paste /tmp/v1.10.1-orphan-balances.txt.

Owner verification — paste /tmp/v1.10.1-orphan-owners.txt,
plus the renounce-decision matrix from §5 (verbatim).

Basescan ticket numbers — the 6 from §6.

Registry diff — link to the
docs/operations/deployment/orphan-registry.md change.

v1.8.3 guard retirement — note the retirement and the
successor (if added).

After the PR opens, go back into the orphan registry entries and
substitute the actual PR URL for <post-broadcast-cleanup-pr-url>,
then amend the registry commit.

CHECKPOINT 8 — final PR
Stop. I review and merge.

§10. After this Cursor session
The v1.10.1 redeploy is complete. The next active work is:

48h safe-mode soak on the v1.10.1 stack with all AMOE_*_ENABLED
flags still off. Smoke-check daily.

§3.0.5 of amoe-flag-rollout-plan.md — the
manager.setAuthorizedAmoeRelayer(<v1.10.1 router>) one-way trust
handoff. Counsel-gated. Single Safe tx.

Phases 0.5 → 4 of amoe-flag-rollout-plan.md — the gradual
flag flip sequence in Vercel.

cursor-deploy-prompt-amoe.md rev 5 (updated by the main v1.10.1
prompt's §8) governs all three. This prompt's hand-off is to that
prompt.

Stop conditions (any one → halt and ask)
§1 finds the cleanup-prompt artifacts missing.

§2 finds non-zero balance on any orphan.

§3 finds a current Vercel env value differing from what the plan
doc says (means env state drifted between the cleanup prompt run
and now).

§3 smoke check fails on any of the 5 endpoints (must all stay 503
disabled — anything else means a flag flipped accidentally).

§4 finds an UPDATE row count of 0 or >1.

§5 finds an actual on-chain owner differing from what the
renounce-decision matrix expects.

§6 receives anything other than 6 successful Basescan ticket
confirmations.

§8 finds a third-party test or workflow depending on
v183-release-target-guard.sh that we didn't already account for.

The post-PR amoe/tools/ci/check_no_orphan_addresses.sh run on this
branch surfaces a NEW orphan reference — meaning §3 or §4
introduced one rather than removing.

When in doubt, stop and ask. This is the close-out PR; getting
it wrong leaves orphan refs lingering for months.