# v1.10.1 Base mainnet redeploy — full stack with AMOE wiring

## 0. Context (read before doing anything)

You are running the **v1.10.1 restart** of the wenakita/4626 Base mainnet
redeploy. The earlier v1.10.0 packet was abandoned before a completed
broadcast, so v1.10.1 is the new release target for this run. The on-chain
situation today is:

- **Two managers exist on Base mainnet, both predate PR #395.** The
  v1.8.3 canonical manager `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357`
  and the manager wired to the replacement router
  `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` are both missing all
  three AMOE selectors (`setAuthorizedAmoeRelayer`,
  `authorizedAmoeRelayer`, `processAmoeEntry`). Confirmed locally
  with `tools/ci/check_manager_amoe_surface.sh` — both fail with all
  3 selectors absent. The evidence doc
  `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md`
  also notes that `authorizedAmoeRelayer()` reverts on the
  `0x3F7AfD…b0C3` manager — that is the same defect, observed from
  the other side.
- **The replacement router `0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759`
  IS correctly wired** — Safe-owned (`0x7d42…f2d3`), both publishers
  set, `setManager(0x3F7AfD…b0C3)` and `setVerifier(0xA39A…65D1)`
  executed via Safe tx `0x8e250fd1…`. Receipt status `success`.
  The router is in good shape; what it points at is not.
- **The deferred trust handoff is currently un-executable.** The
  rollout plan §3.0.5 step
  `manager.setAuthorizedAmoeRelayer(0xC618…3759)` cannot succeed
  against `0x3F7AfD…b0C3` because that selector does not exist in
  the deployed bytecode — the call would revert with no data.
  Flipping any `AMOE_*_ENABLED` flag against this stack would
  silently deadlock on the first submission for the same reason.
- **The v1.9.0 abandoned router `0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F`
  and its companion verifier `0xd9bDFf55…d15964` were owned by the
  Privy CSW EOA `0x6C0E…f9b3`** and never received production
  wiring. They remain abandoned.

What we are doing in v1.10.1 (decisions already locked in):

- **Strict semver restart.** v1.10.0 was the intended first `.0` of the line,
  but this clean restart advances the observable redeploy packet to v1.10.1
  instead of reusing the abandoned tag. Note this in `releases/index.md` so
  the convention and restart are documented.
- **Full stack redeploy** — all 17 production contracts +
  `AmoePlonkVerifier` + `LotteryAmoeRouter` + a fresh
  `CreatorLotteryManager` built from current `main` HEAD (which
  carries PR #395). No state migration, no users to move (decision
  D1b). The reason is **not** stale state — the replacement router
  is in fine shape — but the manager beneath it physically lacks
  the AMOE handler, and rewiring `setManager` on the existing
  router to a fresh manager is itself a Safe-tx event that is no
  cheaper than a clean redeploy.
- **Generic CREATE2, no vanity** — skip the salt grinder. We accept
  generic addresses to compress the broadcast window (decision D2b).
- **Manifest pinning is kept** — bytecode-hash manifest is generated
  pre-broadcast and committed in the release packet PR.
- **Foundry toolchain pinned to v1.7.0** — already merged via PR #485
  (the safety-net PR). Do not touch the workflow files.
- **The existing replacement router / verifier / both pre-#395
  managers / abandoned router are all orphaned.** We do NOT migrate
  or reconfigure any of them. Cold storage only. The full orphan
  list (5 addresses) goes into the v1.10.1 release notes with a
  `# DO NOT WIRE` stamp on each.
- **Sole approver model.** You (the user) accept risk on the unaudited
  PR #395–#400 deltas; no separate sign-off required.

What we are **not** doing in v1.10.1:

- Flipping any `AMOE_*_ENABLED` Vercel flag.
- Calling `manager.setAuthorizedAmoeRelayer(<router>)`. That is the
  one-way trust handoff and follows the 48h safe-mode soak in §3.0.5
  of `amoe-flag-rollout-plan.md`. It is intentionally deferred.

If anything below contradicts your understanding, **stop and ask**. Do
not improvise.

---

## 1. Hard rules (do not violate, ever)

- Workspace root: wherever this repo is on your disk
  (e.g. `/Users/<me>/code/4626`).
- Foundry: `export PATH="$HOME/.foundry/bin:$PATH"` before any
  `forge`/`cast`. **Do not use `foundryup` to change versions during
  this session** — CI is pinned to v1.7.0 and your local must match
  for bytecode-hash reproducibility.
- Git identity: `wenakita` / `info@akita.llc`. Use file-based commit
  messages (`-F /tmp/msg.txt`) for em-dashes / unicode. Always
  `--reset-author` on amend.
- **Stage exclusion** — every `git add` in this session must use:
  `git add -A -- frontend/ supabase/ docs/ script/ contracts/ tools/ ':!lib/liquidity-launcher'`
  (the submodule has dirty drift unrelated to v1.10.1).
- **Never modify `contracts/utilities/lottery/CreatorLotteryManager.sol`.**
  If the size warn-guard fires above 24,500 B, stop and escalate — do
  not delete code to fit.
- ESLint forbids throw-literal — use typed errors.
- `pnpm typecheck` (run from `frontend/`) is canonical for TS.
- Push proxy: `https://git-agent-proxy.perplexity.ai/wenakita/4626.git`.
- **Secret-handling stance:** the agent does NOT hold deploy secrets.
  When a step requires `PRIVATE_KEY` / `BASE_RPC_URL` /
  `BASESCAN_API_KEY`, you (the user) paste them into your local shell
  and run the broadcast yourself. The agent's job is to print the
  exact command, then read back the resulting transaction hash.

---

## 2. Pre-flight (before any forge run)

Stop and confirm each of these. Print the result of every check.

1. `git rev-parse --abbrev-ref HEAD` → must be `main`, clean working tree
   except the known `lib/liquidity-launcher` drift.
2. `git pull --ff-only origin main` is clean.
3. PR #485 (`ci/foundry-v1.7.0-pin-and-amoe-guards`) is **merged** to
   main. Check on GitHub. If not merged, stop — the safety-net guards
   must be on main first.
4. Foundry version: `forge --version` reports v1.7.0 (or close — the
   exact `forge -V` string is what CI runs against).
5. `forge --version` on your machine matches the CI pin in
   `.github/workflows/test.yml` line 41 (`version: v1.7.0`).
6. **Manager size warn-guard passes locally:**
   `tools/ci/check_manager_size_warn.sh` — must report `[ok]` or
   `[WARN]` and exit 0. If it exits 1 the manager is over the EIP-170
   cap and v1.10.1 cannot deploy.
7. **AmoePlonkVerifier patch guard passes locally:**
   `tools/ci/check_amoe_plonk_patch.sh` — must exit 0.
8. **Build clean:** `forge clean && forge build --skip test --sizes`.
   No contract may exceed 24,576 bytes. Save the runtime size for
   `CreatorLotteryManager` — record it in the release packet.
9. **Full test suite:** `forge test -vvv` runs to completion. The
   single allowlisted failure
   (`test/zk/LotteryAmoeRouter.t.sol::test_submitAmoeEntry_acceptsDeadlineAtBufferBoundary`)
   is acceptable. Anything else failing is a stop.

### CHECKPOINT 0 — pre-flight signoff
Print all 9 results in a single block. Wait for "go".

---

## 3. Bytecode-hash manifest (release-packet item 1)

Generate the canonical manifest BEFORE broadcast. This is what we will
later diff against deployed bytecode to prove no last-minute swap.

1. From repo root, run `forge build --skip test`.
2. For each of the 17 production contracts + `AmoePlonkVerifier` +
   `LotteryAmoeRouter`, capture:
   - contract path
   - deployedBytecode hash (`forge inspect <path>:<name> deployedBytecodeHash`)
   - runtime size in bytes
3. Write the result to
   `docs/operations/deployment/releases/v1.10.1-bytecode-manifest.json`.
4. Commit on a fresh branch `release/v1.10.1-prep` (do not push yet).

### CHECKPOINT 1 — manifest review
Show me the JSON. Wait for "go".

---

## 4. Pre-broadcast checklist doc (release-packet item 2)

Create `docs/operations/deployment/releases/v1.10.1-pre-broadcast-checklist.md`
modelled on `v1.8.1-pre-broadcast-checklist.md`. It must enumerate, in
order, every step in this prompt that mutates on-chain or production
state, with a check box per item, plus:

- explicit "skip vanity" note (link to D2b decision).
- explicit orphan note covering all five legacy addresses with a
  `# DO NOT WIRE` comment on each:
  - v1.8.3 canonical manager `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357`
    — pre-PR #395, missing all 3 AMOE selectors
  - replacement-router target manager
    `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` — pre-PR #395,
    missing all 3 AMOE selectors (this is the manager the otherwise-
    well-wired replacement router currently points at)
  - replacement router `0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759`
    — correctly wired, but its target manager has no AMOE handler
  - replacement verifier `0xA39A71a388816d657300EFffF1857F938AEF65D1`
  - v1.9.0 abandoned router `0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F`
    — Privy-CSW-owned, never wired
- the manager-AMOE-surface guard invocation
  (`tools/ci/check_manager_amoe_surface.sh <new-manager> https://mainnet.base.org`)
  as a mandatory check between **manager deploy** and **router
  `setManager`**.
- a documented **baseline negative test** entry: the same script
  must be run against BOTH `0xd593…1357` and `0x3F7AfD…b0C3` and
  exit 1 with all 3 selectors reported missing. This goes into the
  release notes as proof that the v1.10.1 manager is the only Base-
  mainnet manager carrying the AMOE surface.

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 2 — checklist review
Show me the rendered markdown. Wait for "go".

---

## 5. Skip-vanity flag in `deploy-base-full-release.sh` (release-packet item 3)

The script currently defaults `DEPLOYMENT_EPOCH_TAG=v1.9.2` and there is
no skip-vanity branch.

1. Add a `BASE_FULL_RELEASE_SKIP_VANITY` env var, default `0`.
2. When `=1`, the deterministic-phased step (`deploy-infra-v2.sh`) is
   instructed to use generic CREATE2 salts (zero-byte salt or
   sequential `0x01..0x11`, whichever the existing salt-resolver
   already supports — read the script first; do NOT add new salt
   logic).
3. Bump default `DEPLOYMENT_EPOCH_TAG` to `v1.10.1`.
4. Document the flag in a fresh top-of-file comment block; do not
   change semantics of the existing 2-step `infra-then-phased` flow.

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 3 — script diff review
Show me `git diff script/deploy-base-full-release.sh`. Wait for "go".

---

## 6. Release-notes skeleton (release-packet item 4)

Create `docs/operations/deployment/releases/v1.10.1-mainnet.md`. Sections
(content to be filled in post-broadcast — leave placeholders):

- Why a `.0` first-of-line (link to convention note in
  `releases/index.md`).
- Scope (full 17 + AMOE router + verifier; orphan list).
- Toolchain (`forge v1.7.0`, solc `0.8.30`, optimizer 200, via_ir).
- Deployer EOA + funding source (NOT a CEX hot wallet — known
  internal treasury).
- Safe / multisig (router owner = Safe `0x7d42…f2d3`, threshold 1,
  owners listed).
- Pre-broadcast manifest pointer.
- Address table (manager / router / verifier / 17 infra) — empty for
  now, filled after broadcast.
- AMOE selector-surface check result (will be filled after step 9).
- Orphan list — five addresses with "do not reuse" stamps:
  - v1.8.3 canonical manager `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357`
    (pre-PR #395; AMOE selectors absent)
  - replacement-router target manager `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3`
    (pre-PR #395; AMOE selectors absent — root cause that v1.10.1 fixes)
  - replacement router `0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759`
    (Safe-wired correctly, but its target manager has no AMOE handler)
  - replacement verifier `0xA39A71a388816d657300EFffF1857F938AEF65D1`
  - v1.9.0 abandoned router `0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F`
    (Privy-CSW-owned, never wired)
- Reference back to `amoe-deploy-evidence-2026-05-01.md` — the
  evidence doc that documented the replacement-router wiring and
  noted the reverting `authorizedAmoeRelayer()` call (that revert
  is the same pre-#395 defect, observed from the call side).
- Post-broadcast checklist link (created in step 13).

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 4 — release notes skeleton review
Show me the rendered markdown. Wait for "go".

---

## 7. Convention note on `releases/index.md` (release-packet item 5)

Add a one-paragraph note explaining: v1.10.1 is a clean restart of the
abandoned v1.10.0 redeploy packet, while future new minor lines should still
ship as `vX.Y.0` (not `vX.Y.1`). Reference this prompt and the v1.10.1 entry.

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 5 — index.md diff review

---

## 8. Cursor prompt + rollout-plan rev (release-packet items 6 & 7)

1. Update `cursor-deploy-prompt-amoe.md` to **rev 5** with a header
   note: "v1.10.1 supersedes the v1.9.x rollout in this doc; for the
   redeploy itself follow `cursor-deploy-prompt-v1.10.1.md`. This doc
   continues to govern the §0 → §3.0.5 AMOE rollout AFTER v1.10.1
   broadcasts."
2. Update `docs/operations/deployment/amoe-flag-rollout-plan.md` to
   **rev 5** with a §0.0 inserted: "Pre-condition: v1.10.1 broadcast
   complete, addresses recorded in
   `releases/v1.10.1-mainnet.md`, AMOE selector-surface guard green
   on the new manager."

Commit to `release/v1.10.1-prep`.

### CHECKPOINT 6 — both diffs review

---

## 9. Release-prep PR (release-packet item 8)

Push `release/v1.10.1-prep` and open a PR to `main` with all six
commits from steps 3–8.

PR title: `release(v1.10.1): pre-broadcast packet — manifest, checklist,
skip-vanity, release notes, prompt + rollout rev`

PR body: enumerate each commit, link to checkpoint approvals,
confirm `lib/liquidity-launcher` was excluded, confirm size-warn
guard exit code locally.

### CHECKPOINT 7 — PR review
**Stop here.** I will review the PR end-to-end, request any tweaks,
and merge it before broadcast. Do not move to step 10 until I confirm
the PR is merged into main.

---

## 10. Broadcast — phase 1 of 2 (manager + 17 infra)

**You (the user) run this in your local shell with secrets exported.**
The agent prints the command, you paste it.

Pre-conditions:

- Release-prep PR is merged to main.
- You are on a fresh checkout of main (`git fetch && git reset --hard origin/main`).
- `.env` has `PRIVATE_KEY` (deployer EOA), `BASE_RPC_URL`,
  `BASESCAN_API_KEY` set.
- The deployer EOA has at least 0.05 ETH on Base for the full
  broadcast window (size depends on the 17-contract set; reference
  v1.8.3 broadcast cost in `releases/v1.8.3-mainnet.md`).
- The deployer EOA was funded from a **known internal treasury**, NOT
  a CEX hot wallet. (Public attribution risk.)

Run, exactly:

```bash
DEPLOYMENT_EPOCH_TAG=v1.10.1 \
BASE_FULL_RELEASE_SKIP_VANITY=1 \
bash script/deploy-base-full-release.sh 2>&1 | tee /tmp/v1.10.1-broadcast.log
```

Watch for:

- The handoff env file path (printed at the top).
- Each contract's deployed address.
- Any non-zero exit from forge.

When the script completes, copy:

- the path of the handoff env file (under `/tmp/4626-base-full-release-…`),
- the path of the shared/global artifact JSON,
- the address of the freshly deployed `CreatorLotteryManager`.

Paste all three back into Cursor.

### CHECKPOINT 8 — phase-1 broadcast result
Agent verifies on chain:

1. `cast code <new-manager> --rpc-url $BASE_RPC_URL` returns non-`0x`.
2. `cast call <new-manager> "owner()(address)" --rpc-url $BASE_RPC_URL`
   returns the expected owner (deployer EOA, will be transferred to
   Safe in step 12 — confirm this matches expectation).
3. **Manager AMOE selector-surface — positive test (new manager):**
   `tools/ci/check_manager_amoe_surface.sh <new-manager> $BASE_RPC_URL`
   → exit 0 with all three selectors found. Capture the script
   output verbatim.
4. **Manager AMOE selector-surface — baseline negative tests (legacy
   managers):** run the same script against both legacy managers
   that are being orphaned. Both MUST exit 1 with all 3 selectors
   reported missing. Capture both outputs verbatim — they go into
   the post-broadcast evidence doc as proof that v1.10.1 is the
   first Base-mainnet manager carrying the AMOE surface.
   - `tools/ci/check_manager_amoe_surface.sh 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357 $BASE_RPC_URL`
   - `tools/ci/check_manager_amoe_surface.sh 0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3 $BASE_RPC_URL`
5. The 17 infra contracts each have non-`0x` code.

If any of (1)–(5) fails — *including* an unexpected pass on either
baseline negative test — **stop**. Do not proceed to phase 2.

---

## 11. Broadcast — phase 2 of 2 (AMOE verifier + router)

You run, exactly:

```bash
forge script script/DeployLotteryAmoeRouter.s.sol:DeployLotteryAmoeRouter \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  -vvvv 2>&1 | tee /tmp/v1.10.1-amoe-broadcast.log
```

The script deploys `AmoePlonkVerifier` and `LotteryAmoeRouter`,
then wires:

- router owner = Safe `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3`
  (NOT the deployer EOA, NOT the Privy CSW)
- router `setVerifier(<new-verifier>)`
- router `setManager(<new-manager-from-step-10>)`
- router `setAllowlistPublisher(0xAb6d5C10b03300326CD7fAb7267Ae192842967b5)`
- router `setPointsLedgerPublisher(0xdE4858778BB09534A9097C074200d903C81aBB33)`

It does **NOT** call `manager.setAuthorizedAmoeRelayer(...)`. That is
deferred to §3.0.5 of the rollout plan, after the 48h safe-mode soak.

Paste back the router and verifier addresses.

### CHECKPOINT 9 — phase-2 broadcast result
Agent verifies on chain:

1. `cast call <router> "owner()(address)"` ==
   `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3`.
2. `cast call <router> "verifier()(address)"` == new verifier.
3. `cast call <router> "manager()(address)"` == new manager.
4. `cast call <router> "consumer()(address)"` ==
   `0x0000000000000000000000000000000000000000` (production rule:
   leave consumer at zero).
5. `cast call <router> "allowlistPublisher()(address)"` ==
   `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5`.
6. `cast call <router> "pointsLedgerPublisher()(address)"` ==
   `0xdE4858778BB09534A9097C074200d903C81aBB33`.
7. `cast call <new-manager> "authorizedAmoeRelayer()(address)"` ==
   `0x0000000000000000000000000000000000000000` (handoff NOT yet done,
   correct).

Any deviation → stop, do not transfer manager ownership in step 12.

---

## 12. Manager ownership handoff to Safe

You run, with deployer EOA key:

```bash
cast send <new-manager> \
  "transferOwnership(address)" \
  0xB05Cf01231cF2fF99499682E64D3780d57c80FdD \
  --rpc-url $BASE_RPC_URL \
  --private-key $PRIVATE_KEY
```

(Address `0xB05C…0FdD` matches the v1.8.3 manager owner — same Safe
signer set.)

Then:

```bash
cast call <new-manager> "owner()(address)" --rpc-url $BASE_RPC_URL
```

Must return `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`.

### CHECKPOINT 10 — ownership transfer

---

## 13. Bytecode-manifest verification (release-packet item 9 part 1)

Compare the deployed runtime bytecode hash for each of the 19
contracts (17 + verifier + router) against the manifest from step 3.
Use `cast code <addr>` → `keccak256` and diff against the manifest's
`deployedBytecodeHash`.

Write the result to
`docs/operations/deployment/releases/v1.10.1-bytecode-manifest-verified.md`
with one row per contract: address, expected hash, on-chain hash,
match (yes/no).

If any row says no, **stop**. The deployed bytecode does not match
what we built.

### CHECKPOINT 11 — manifest verification

---

## 14. Evidence doc + addresses.md update (release-packet item 9 part 2)

1. Update `docs/reference/addresses.md` and
   `apps/docs-site/docs/reference/addresses.md` with the v1.10.1
   addresses. Mark v1.8.3 manager and v1.9.x replacement router as
   `# orphaned, do not use` with link to v1.10.1 release notes.
2. Append a "v1.10.1 broadcast 2026-05-XX" section to
   `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md`
   with the broadcast log path, the manifest verification result,
   and the post-broadcast `cast call` outputs from steps 11–12.
3. Fill in the placeholder sections of
   `releases/v1.10.1-mainnet.md` (created in step 6).
4. Run the manager AMOE selector-surface guard one more time as a
   sanity check (you can also dispatch the
   `Manager AMOE selector-surface guard` workflow in
   `zk-pipeline-guards.yml` with the new manager address — that
   provides a CI-side audit trail).

Commit on `release/v1.10.1-broadcast-evidence`.

### CHECKPOINT 12 — evidence + addresses review

---

## 15. Follow-up PR (release-packet item 9 part 3)

Push `release/v1.10.1-broadcast-evidence` and open a PR to main.

PR title:
`release(v1.10.1): broadcast evidence — addresses, manifest verification, evidence doc`

PR body must include:
- Broadcast tx hashes (manager creation, 17 infra, verifier, router,
  ownership transfer).
- Manifest verification table summary (X/X matched).
- Manager AMOE-surface guard CI run URL.
- Confirmation that `manager.authorizedAmoeRelayer == address(0)` —
  i.e. the one-way trust handoff is intentionally still pending.

### CHECKPOINT 13 — final PR
**Stop.** I review and merge.

---

## 16. After this Cursor session

Out of scope for this prompt — covered separately:

- 48h safe-mode soak.
- §3.0.5 of `amoe-flag-rollout-plan.md` — the
  `manager.setAuthorizedAmoeRelayer(<router>)` one-way trust handoff.
- Phase 0.5 → Phase 4 AMOE flag flips in Vercel.
- Sweepstakes counsel sign-off on legal text.

`cursor-deploy-prompt-amoe.md` rev 5 (updated in step 8) governs
those steps, with `cursor-deploy-prompt-v1.10.1.md` (this file) as
the upstream pre-condition.

---

## Stop conditions (any one of these → halt and ask)

- Any `forge build` step prints a contract over 24,576 bytes.
- `tools/ci/check_manager_size_warn.sh` exits non-zero (size hard-cap
  reached) — note: the warn-only path (`[WARN]` line, exit 0) is
  acceptable but the user should be told.
- `tools/ci/check_manager_amoe_surface.sh` against the freshly
  deployed manager exits non-zero — that means PR #395 didn't make
  it into the build, and the router would deadlock.
- A deployed bytecode hash does not match the pre-broadcast manifest.
- Any `cast call` shows the router owned by anything other than the
  Safe `0x7d42…f2d3`.
- Any `cast call` shows the manager `authorizedAmoeRelayer` set to
  non-zero before §3.0.5 has been explicitly approved.
- The deployer EOA was funded from a CEX hot wallet.
- `lib/liquidity-launcher` ends up staged in any commit.

When in doubt, **stop and ask**. Re-deploys are cheap; a wrong wiring
on a `.0` release is not.
