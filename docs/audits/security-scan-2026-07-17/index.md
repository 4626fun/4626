# Contract security scan — 2026-07-17

Cross-tool pass over the Solidity tree (~90 first-party contracts / 126 files in Aderyn scope, ~27k nSLOC). Complements the sealed July re-audit board ([OPEN_FINDINGS_BOARD.md](../OPEN_FINDINGS_BOARD.md)); this is **not** a full professional audit.

## Tools used

| Tool | Role | Result |
|------|------|--------|
| **[One Dollar Audit](https://www.onedollaraudit.com/)** (`POST https://leftclaw.services/api/audit`) | AI multi-agent review, **$1 USDC / job** via x402 on Base | **v2 jobs 426–433 commissioned** with public source bundles (418–425 wrong-scope; private repo 404) — see [one-dollar-audit-jobs.md](./one-dollar-audit-jobs.md). Runner: [`frontend/scripts/security/one-dollar-audit.mjs`](../../../frontend/scripts/security/one-dollar-audit.mjs) (root shim at `scripts/security/one-dollar-audit.mjs`; deps on `frontend/package.json`) |
| **Aderyn 0.6.8** (Cyfrin) | Fast AST static analysis | Exit **0**. 12 High detector classes / 27 Low. Condensed: [aderyn-highs-condensed.md](./aderyn-highs-condensed.md) |
| **Slither 0.11.5** (focused hot contracts) | Deep static / dataflow | Exit **0** per file (`--fail-none`). Summary: [slither-focused-summary.md](./slither-focused-summary.md) |
| **Manual + agent pass** (lottery + vault/deploy) | Semantic review against open board | New mediums below; no new critical/high confirmed |
| **SolidSecs** ([carni-ships/SolidSecs](https://github.com/carni-ships/SolidSecs)) | Prior suite used 2026-04 (Slither/Aderyn/Mythril/…) | Reference only this pass — orchestrates the same free tools |
| **Pashov skills** (`skills/solidity-auditor`, `skills/x-ray`) | In-repo AI audit prompts / attack vectors | Available for deeper follow-up runs |

### Recommended analyzer stack (keep using)

1. **CI / every PR:** Aderyn (fast) + existing Slither gate (`.github/workflows/security-scanning.yml`, pinned `0.11.5`).
2. **Pre-release / hot deltas:** One Dollar Audit — one tight system per $1 job (addresses or pasted source).
3. **Deep / economic:** Mythril or Halmos on jackpot + pricing paths; Foundry invariants / Medusa already in tree.
4. **Formal math:** Aristotle / Lean targets under `docs/audits/aristotle/` (already proven for base odds + Curve boost).
5. **Human audit:** Code4rena / Spearbit still the right bar before large TVL (noted in `docs/_internal/security/index.md`).

## One Dollar Audit — paid pass

**Commissioned 2026-07-18** from `0xB05Cf0…0FdD` — jobs **418–425**. Tracking: [one-dollar-audit-jobs.md](./one-dollar-audit-jobs.md).

```bash
# Extra systems (after pnpm -C frontend install):
PRIVATE_KEY=… pnpm -C frontend security:one-dollar-audit -- --description "…"
# Root shim: node scripts/security/one-dollar-audit.mjs --description "…"
# Poll: curl -s https://www.onedollaraudit.com/api/jobs/<jobId>
```

## New findings (board cross-check)

Board Critical open: **0**. Prior H/M wave largely **Fixed** (2026-07-09).

### Medium — patched on this branch

| ID | Surface | Status | Fix |
|----|---------|--------|-----|
| **SCAN-M1** | `ChainlinkVRFIntegratorV2_5` | **Fixed** | `callbackSucceeded` + permissionless `retryCallback` (hub M-11 parity) |
| **SCAN-M2** | `LotteryAmoeRouter` | **Fixed** | `ManagerNotSet` before nullifier burns; ZK path always fans out |
| **SCAN-M3** | `Registry4626` | **Fixed** | `agentIntegrationMetaSet` one-shot; rebind = owner + `liveRebindEnabled` |

### Low — patched on this branch

| ID | Surface | Status | Fix |
|----|---------|--------|-----|
| **SCAN-L1** | `LotteryManager4626.processAmoeEntry` | **Fixed** | `MAX_POINTS_AS_USD` ceiling mirror of router |
| **SCAN-L2** | `LotteryAmoeRouter` | **Fixed** | `nonReentrant` on `submitAmoeEntryZK` (verify already before effects) |
| **SCAN-L3** | Impairment challenge window | **Fixed** | `MIN/MAX_IMPAIRMENT_CHALLENGE_WINDOW` (1h–30d) |

### Static-tool noise (triaged, not opened)

- Slither **`uninitialized-state` High** on LM/proxy-style slots — known FP class (`docs/_internal/security/ci-red-baseline-audit.md`); values set in `initialize` / owner setters.
- Aderyn **H-5 reentrancy** flood (146 hits) — mostly CEI false positives / guarded paths; treat as backlog for targeted review, not 146 bugs.
- Aderyn **H-1 encodePacked**, **H-6 name reuse**, **H-11 weak RNG** on burn-stream — review case-by-case; deployment salts use fixed separators; lottery RNG is Chainlink/drand not `block.prevrandao`.

## Prior board residual (ops, not new code bugs)

- **AR-GOV** — multisig + timelock policy across TCB still open (ops checklist).
- Solana lottery relay: B2 `relay_entries` stays off until LZ-era gates close.
- Rebalance forge suite still excluded (~65 known fails) — unrelated to this scan.

## Commands run (exit codes)

| Command | Exit |
|---------|------|
| `aderyn . -o /tmp/…/aderyn-report.md` | **0** |
| `slither contracts/shared/lottery/manager/LotteryManager4626.sol --fail-none` | **0** |
| `slither contracts/shared/lottery/zk/LotteryAmoeRouter.sol --fail-none` | **0** |
| `slither contracts/shared/deploy/batchers/DeploymentBatcher.sol --fail-none` | **0** |
| `slither contracts/creator/vault/CreatorOVault.sol --fail-none` | **0** |
| `slither contracts/shared/core/Registry4626.sol --fail-none` | **0** |
| `slither contracts/creator/vault/CreatorShareOFT.sol --fail-none` | **0** |
| `forge build --sizes` | **non-zero** (EIP-170 size gate on oversized artifacts; compile produced `out/`) |
| One Dollar Audit commission ×8 (`node scripts/security/one-dollar-audit.mjs`) | **0** each (jobIds 418–425) |

## Post-fix rescan (2026-07-18)

After landing SCAN-M1–M3 / L1–L3: re-ran Aderyn + focused Slither + audit/VRF/AMOE/invariant/halmos-as-Foundry suites.  
**No new semantic mediums opened.** Static High classes unchanged (noise). Details: [rescan-2026-07-18/index.md](./rescan-2026-07-18/index.md).

## Next actions

1. Poll ODA v2 jobs **426–433**; reject any report that targets legacy `CreatorVault`.  
2. Triage + patch correct-scope ODA findings once reports land.  
3. Optional: Halmos symbolic CI (prebuilt `out/`) + Mythril on jackpot/AMOE; track LiveHandler phase2 invariant separately.  
