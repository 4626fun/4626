# Post-fix rescan — 2026-07-18

Re-ran static analyzers and in-tree high-assurance suites after landing SCAN-M1–M3 / SCAN-L1–L3 on `cursor/contracts-security-scan-26cd`.

## Fix coverage (honest status)

| Bucket | Status |
|--------|--------|
| **SCAN-M1–M3** (semantic mediums from 2026-07-17) | **Fixed** on this branch |
| **SCAN-L1–L3** | **Fixed** on this branch |
| **Aderyn / Slither High noise** (H-5 reentrancy flood, uninitialized-state, naming, …) | **Not “fixed”** — still reported; previously triaged as FP / backlog. Rescan shows the **same 12 High detector classes**; no new class opened |
| **One Dollar Audit v2 jobs 426–433** | **Still pending** — not available to fix yet |
| **Board ops residual (`AR-GOV`)** | Open ops checklist — not a code patch |
| **LiveHandler `DeploymentBatcherPhase2LiveInvariantTest`** | **Failing** (pre-existing fixture / permit2 path); not caused by SCAN meta one-shot (`finalizePhase2` does not call `setAgentIntegrationMeta`) |

## Static rescan

| Tool | Exit | Result |
|------|------|--------|
| Aderyn 0.6.8 (`aderyn .`) | **0** | 126 files / 26841 nSLOC; **12 High / 27 Low** detector classes — same set as 2026-07-17. Condensed: [aderyn-highs-condensed.md](./aderyn-highs-condensed.md), summary: [aderyn-summary.md](./aderyn-summary.md) |
| Slither 0.11.5 focused hot contracts | **0** each (`--fail-none`) | See [slither-focused-summary.md](./slither-focused-summary.md). LM still shows `uninitialized-state` / delegatecall FP class |

## Additional tests run (beyond one-time Aristotle Lean proofs)

Aristotle/Lean artifacts under `docs/audits/aristotle/` remain **already proven** (base odds, curve boost, post-boost cap, jackpot fractions, VRF fairness model). This pass did **not** re-execute Lean (no Lean toolchain in the agent image); re-check with `lake build` in those topic dirs when available.

| Suite | Command shape | Exit | Notes |
|-------|---------------|------|-------|
| Audit 2026-07-08 regressions | `forge test --match-path 'test/audit/*.t.sol'` | **0** | 46 passed |
| Spoke VRF (+ SCAN-M1 retry) | `forge test --match-path 'test/ChainlinkVRFIntegratorV2_5*.t.sol'` | **0** | 19 passed |
| AMOE properties + SCAN-M2 | `forge test --match-path 'test/LotteryAmoe*.t.sol'` | **0** | 4 passed |
| Registry VaultKind / SCAN-M3 | `forge test --match-path 'test/agent/AgentRegistry.VaultKind.t.sol'` | **0** | 7 passed |
| Impairment / SCAN-L3 | `forge test --match-path 'test/CreatorOVault.ImpairmentV1.t.sol'` | **0** | 18 passed |
| Deep invariants | `forge test --match-path 'test/DeepInvariantTargets.t.sol'` | **0** | 4 passed (incl. 128k-call wrapper backing) |
| Halmos **as Foundry fuzz** | `forge test --match-path 'test/halmos/*.t.sol'` | **0** | 6 passed (Charm valuation + vault math concrete smoke) |
| Governance properties | `forge test --match-path 'test/GovernanceVotingProperties.t.sol'` | **0** | 4 passed |
| Halmos symbolic (`halmos` 0.3.3) | installed; single `check_` aborted on full-tree forge rebuild / wall-clock | **n/a** | Prefer CI job with prebuilt `out/` + `halmos --contract CreatorOVaultMath --function check_` |
| LiveHandler phase2 invariant | `forge test --match-contract DeploymentBatcherPhase2LiveInvariantTest` | **1** | `valid phase2 rejected` — track separately |

## Recommended next stack (for new contracts / next delta)

1. **Every PR:** Aderyn + existing Slither launch gate (CI).
2. **After hot patches (this pass):** focused forge suites above + `test/audit/*`.
3. **Symbolic:** Halmos on `test/halmos/CreatorOVaultMath.t.sol` (`check_*`) once CI caches `out/`.
4. **Economic / fuzz:** Foundry invariants (`DeepInvariantTargets`, vault rebalance/user accounting) — already green here except LiveHandler phase2.
5. **Formal math:** re-`lake build` Aristotle targets when Lean is available; extend Lean only when formulas change.
6. **Paid AI:** wait for ODA 426–433 (litterbox scope); reject CreatorVault reports.
7. **Optional deep:** Mythril on jackpot payout + AMOE router; Medusa if/when a root `medusa.json` is added (not present today).

## Commands / exit codes (this rescan)

| Command | Exit |
|---------|------|
| `aderyn . -o /tmp/security-rescan-2026-07-18/aderyn-report.md` | **0** |
| `slither <hot file> --fail-none` ×8 | **0** each |
| `forge test --match-path 'test/audit/*.t.sol'` | **0** |
| `forge test --match-path 'test/ChainlinkVRFIntegratorV2_5*.t.sol'` | **0** |
| `forge test --match-path 'test/LotteryAmoe*.t.sol'` | **0** |
| `forge test --match-path 'test/agent/AgentRegistry.VaultKind.t.sol'` | **0** |
| `forge test --match-path 'test/CreatorOVault.ImpairmentV1.t.sol'` | **0** |
| `forge test --match-path 'test/DeepInvariantTargets.t.sol'` | **0** |
| `forge test --match-path 'test/halmos/*.t.sol'` | **0** |
| `forge test --match-path 'test/GovernanceVotingProperties.t.sol'` | **0** |
| `forge test --match-contract DeploymentBatcherPhase2LiveInvariantTest` | **1** |
