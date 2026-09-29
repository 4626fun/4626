# IMD request: CreatorOVault, wrapper and ShareOFT

**Review the current creator-vault system as one accounting stack.** This request replaces physical shorts as the next review priority; no physical-short IMD job was submitted by this session.

- Source: `wenakita/4626` @ `2a9e1334d5b9a13a555c6672e0ec0e735da24bf4`.
- Archive: [IMD_CREATOR_VAULTS_ARCHIVE.b64](IMD_CREATOR_VAULTS_ARCHIVE.b64), a base64-encoded ZIP.
- Decoded ZIP SHA-256: `5fe22f0051ea176b88f0d36147efd60890e39b211ed9aab83783cdf476d8fa2e`.
- 109 source/support files verified against upstream Git blob hashes and SHA-256.
- Baseline: **538 successful test executions, 0 failures, 0 skipped**, including rebalance and accounting invariants. This includes three tests repeated under an additional optimizer profile (535 distinct tests).

## IMD import limit and validated request

The full organization repository exceeds IMD's 200 MB code-import limit (API returned 422: repository 460 MB). **Leave the repository-import field empty.** Instead, use [IMD_CREATOR_JOB.json](IMD_CREATOR_JOB.json) as the `input` for `job.open`: it starts empty and fetches only four immutable package files from public commit `1d539958d0029596398f370d70d90abfa5f08c68`.

The four-step request was validated with `POST /requests/quote`: HTTP 201, status `quoted`, price 0.5 IMD on Ethereum. No payment or `/submit` call was made. Quotes expire after ten minutes; create a fresh quote with a new requestKey when ready. The JSON contains no wallet credential or bearer token. A wallet must complete the required payment signatures before any job can start.

## Ready-to-paste IMD request

Start in an empty workspace. Do not clone/import the complete repository. Download only `IMD_CREATOR_VAULTS_ARCHIVE.b64`, `IMD_CREATOR_VAULTS_REVIEW.md`, `IMD_CREATOR_BOOTSTRAP.sh` and `foundry.toml` from `https://raw.githubusercontent.com/4626fun/4626/1d539958d0029596398f370d70d90abfa5f08c68/`.

Audit CreatorOVault, CreatorOVaultWrapper and CreatorShareOFT together using only the snapshot in IMD_CREATOR_VAULTS_ARCHIVE.b64 from this branch of https://github.com/4626fun/4626. Pin the public commit before starting. Decode the ZIP and verify SHA-256 `5fe22f0051ea176b88f0d36147efd60890e39b211ed9aab83783cdf476d8fa2e`. Run `bash IMD_CREATOR_BOOTSTRAP.sh`, then follow imd-creator-vaults/BRIEF.md. The older root contracts tree is outside this review. The root foundry.toml is a verifier harness pointing at the extracted package.

Use separate steps to materialize the exact snapshot, write adversarial Foundry tests, independently review the code and new tests with a different seat, and deliver artifacts/report.md plus artifacts/imd-tests.zip. Preserve production source, existing tests and configuration. Check backing and dust across wrapping and cross-chain supply; withdrawals, cooldowns and asynchronous claims; loss recognition and recovery entitlements; strategy valuation/rebalance failures; mint/burn authorization; LayerZero peers, replay/retry and fee routing; delegatecall storage and admin boundaries. Retain every supplied rebalance suite. Include stateful tests, concrete reproduction inputs, commands/exit codes, actual fuzz/invariant settings and a named independent-review record. If the second reviewer or live integration evidence is unavailable, explicitly disclose it. No deployment, production fixes or transactions. Ajna-core remediation and physical shorts are outside scope.

## Run locally

```sh
bash IMD_CREATOR_BOOTSTRAP.sh
cd imd-creator-vaults
node_modules/@foundry-rs/forge-linux-amd64/bin/forge test --summary
python3 verify_manifest.py
```

The archive includes README.md, BRIEF.md, SOURCE_MANIFEST.json, pinned npm tooling, and validation logs. Review-scope publication does not update deployed contracts. A paid IMD job has not yet been submitted.

---

# IMD review: CreatorOVault → wrapper → CreatorShareOFT

Prepared 2026-09-29. Target the exact source in this package. Do not substitute the older public-main contracts tree or the physical-shorts review package.

## Objective

Independently review the creator vault, wrapper and ShareOFT as one asset-accounting system. Determine whether depositors can lose principal, redeem another user's backing, bypass authorization, strand recoverable assets, or create unbacked claims through interactions between the three contracts. Deliver executable evidence, not just a source summary.

Upstream source: `wenakita/4626` at `2a9e1334d5b9a13a555c6672e0ec0e735da24bf4`. SOURCE_MANIFEST.json pins each supplied upstream file by Git blob hash, SHA-256 and size. The selected files are supplied publicly; private-repository access is not required.

## Scope and architecture

Primary targets:
- contracts/creator/vault/CreatorOVault.sol
- contracts/creator/vault/CreatorOVaultWrapper.sol
- contracts/creator/vault/CreatorShareOFT.sol

The facade delegates important behavior. Read CreatorOVaultCoreModule plus the shared OVaultAdminModule, OVaultStrategiesModule, OVaultModuleBase/Storage/Constants and linked vault libraries as part of the primary scope. Include OVaultAsyncRequestModule, OVaultImpairmentClaims, OVaultRecoveryEscrow and OVaultHubComposer for their interactions with the targets. Trace ShareOFTRemoteLotteryLib/Queue and ShareOFTSpokeModule for token accounting, message authentication, fee forwarding and liveness.

Base is the hub. Remote ShareOFT supplies must be considered when reasoning about backing: a local totalSupply check alone is not proof of global backing. Preserve the existing architecture. The wrapper normalizes 1,000 vault-share units into one ShareOFT unit and tracks dust; verify actual units and decimals in all paths.

Agent-lane contracts, strategy implementations, deployment helpers, interfaces and test support included by import closure provide compilation/integration context. Do not expand this request into a complete audit of those independent systems. Ajna/Charm dependencies appear in existing vault tests; their presence does not authorize deployment or establish upstream protocol safety. The physical-short system and any remediation of the reported Ajna incident are outside this request.

## Review priorities and properties

1. **Vault accounting and exits:** ERC-4626 rounding, initial/depleted vaults, donations, live versus recognized NAV, profit unlocking, management/performance fees, debt caps, deposits around reports, malicious/illiquid/reverting strategies, withdrawals and maxLoss. Check share/asset conservation across multiple users and strategy rebalance sequences.
2. **Wrapper backing and dust:** wrap/unwrap, fee accounting, totalMinted, totalUserDustShares, normalization, direct transfers/donations, minter/burn allowance, recovery/sweep permissions, preview/execution differences. Derive a complete backing invariant including reserved claims and cross-chain supply; do not assume a simple local-supply equality is sufficient.
3. **Cooldown and async lifecycle:** deposit→transfer→wrap→bridge→unwrap→withdraw interactions; griefing by dust transfers; request/fulfill/claim/cancel/transfer authorization; receiver/controller/operator separation; double claims, stale approvals, partial fills and rounding at boundaries.
4. **Impairment and recovery:** loss recognition, epoch snapshots, wrapper versus direct holders, share transfers before/after impairment, ERC-1155 claim transfers, recovery distribution and escrow conservation. Ensure unclaimed recoveries cannot be swept or claimed twice and new holders cannot capture historical entitlements incorrectly.
5. **ShareOFT hub/spoke:** authorized mint/burn, OFT debit/credit and dust, remote supply and in-flight messages, endpoint/peer/source authentication, replay and payload-type collisions, failed delivery/retry behavior, pending fees and lottery interactions. Distinguish transport trust assumptions from application bugs. Check that fee/lottery callback failures do not unexpectedly brick transfers or exits.
6. **Module and admin boundaries:** delegatecall storage layout/identity, self-call helpers, reentrancy across facade/modules/wrapper/hooks, role and timelock changes, emergency operations, rescue paths and configuration consistency. Clearly separate intended trusted-owner powers from unprivileged exploits.

## Required method

- Verify archive and all source hashes before testing and again after. Stop and report a mismatch. Do not review public-main's older tree instead.
- Run the baseline exactly as documented. Keep all included rebalance suites; do not exclude them as historical known failures. Record actual exit codes and distinguish compile failures from test failures.
- Add tests only under test/imd/. Keep original source, existing tests and harness configuration unchanged. Put any proposed fix in the report, not in production source.
- Add cross-contract stateful handlers with several users, time/block advances, deposits, wrap/unwrap, transfers, withdrawals/async exits, strategy losses and impairment/recovery. Cover bridge accounting using a labeled endpoint model when real endpoint/fork evidence is unavailable. Avoid vacuous invariants and report handler call/revert coverage.
- Each confirmed finding needs a minimal reproducible test against real scoped contracts, prerequisites, exact file/line references, impact, severity rationale, and suggested remediation. Label passing tests that assert vulnerable behavior. Explicitly refute false leads.
- Use a genuinely different reviewer/seat to review the new tests and findings. Record reviewer identities and work. If unavailable, disclose that independence was not achieved; self-review does not satisfy this requirement.
- Report compiler/dependency pins, commands, exit codes, fuzz seeds, fuzz runs and invariant runs/depth actually used. Separate verified facts, model assumptions, deployment-dependent inferences, and untested areas.

## Outputs

1. artifacts/report.md — evidence-backed findings, negative results, complete scope, test results, independent review record, remediation priorities and coverage gaps.
2. artifacts/imd-tests.zip — actual added tests/support under test/imd, a copy/run README, and a SHA-256 manifest. No node_modules, secrets or build caches.

Use a test-writing step followed by an independent adversarial-review step, then a final report step when supported. A single report agent must disclose if that multi-reviewer process was not provided.

This review concerns a source snapshot. No verified current deployment inventory, bytecode equivalence, real LayerZero delivery, or real strategy solvency is supplied. Do not claim production safety, deploy contracts, modify production, or initiate transactions. Report missing wider context explicitly rather than inventing it.
