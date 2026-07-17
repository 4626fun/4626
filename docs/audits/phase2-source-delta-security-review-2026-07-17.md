# Delta security review — Phase2 source-ahead (2026-07-17)

Scope: post–greenfield changes that affect deploy / lottery / ShareOFT / gauges,
centered on `DeploymentBatcherPhase2Module` AA95 + vaultKind wiring and pin
cutover hygiene. Not a full re-audit of the sealed v1.19.1 stack.

## Method

- Structural guards: lane parity, ovault delegate epilogues, storage layout, EIP-170
- Release-target guard with `SOURCE_RELEASE=v1.19.2` / `CURRENT_RELEASE=v1.19.2`
- On-chain Base probes: store `sizes(codeId)` for sealed vs source Phase2; live
  `DeploymentBatcher.phase2Module()`
- Batched `forge test` (Rebalance suite excluded; known baseline)
- Manual + agent delta pass on Phase2 / ShareOFT finalize / precreate path

## Findings

### F1 — Source Phase2Module ≠ sealed v1.19.1 store seed (Info / ops)

- Sealed `codeId` `0xbe8296b2…` seeded (size 20529); source `0x525ceedc…` not seeded.
- Live module hot-swapped to `0x3089678d…`.
- **Mitigation shipped:** `v1.19.2` source manifest + guard `SOURCE_RELEASE` split;
  addresses/inventory pin live Phase2.

### F2 — Phase1 `agentVaultCoreModule` (Info / closed on-chain 2026-07-17)

- Live Phase1Module `0x0d12951A…` now exposes AgentOVaultCoreModule `0xE9350e3A…`.
- Defaults/guard/docs updated; hot-swap helpers retained for future rotations.

### F3 — Stale script defaults (fixed)

- Upgrade/configure/rehearsal scripts cut over to v1.19.1 pins.

### F4 — `_deployOrExisting` still copies full creation bytecode on reuse (Medium / new)

- `store.get()` before `code.length` short-circuit → residual AA95 / UserOp OOG risk.
- **Remediation:** hash/pointer path that skips full bytecode copy when address exists.

### F5 — Precreate misses `deployPhase2CoreWithRolePolicy` (Medium / new)

- `phase2CorePrecreate.ts` only matches shell selector `deployPhase2Core`; role-policy
  rewrite can skip precreate → CREATE2 inside UserOp → AA95.
- **Remediation:** decode both selectors; same salt/args path.

### F6 — Precreate key fallback too broad (Medium / new)

- Falls back to `PRIVATE_KEY` / `KPR_PRIVATE_KEY` if CREATE2-authorized.
- **Remediation:** require dedicated `DEPLOY_SESSION_PHASE2_PRECREATE_PRIVATE_KEY` only.

### F7 — Finalize does not bind gauge/CCA/oracle to vault wiring (Medium / known)

- Owner can pass diverting `params.ccaLaunchArm` at finalize.
- **Remediation:** require equality with vault-wired / CREATE2-predicted addresses.

### F8 — Module entry `deployPhase2Core` hardcodes Creator vaultKind (Low / new)

- Shell uses orchestrator (safe today); dead footgun if entry called directly.
- **Remediation:** delete entry or delegate to `p1state.vaultKind`.

## Surfaces OK this pass

| Surface | Notes |
|---------|--------|
| ShareOFT / Solana peer at finalize | Explicit registry peer required; tests cover |
| LotteryManager + VRF configure | Defaults only; auth model unchanged |
| Agent gauge fan-out | Covered by AgentLanePhase12 / AgentPhase2GaugeWiring |

## High-value missing tests

1. `_deployOrExisting` reuse with non-zero `store()` (agent tests force `store()==0`).
2. Precreate for `deployPhase2CoreWithRolePolicy` calldata.
3. Finalize rejects mismatched `ccaLaunchArm` / gauge vs vault wiring.


## Slither (focused)

Command: `slither contracts/shared/deploy/batchers/DeploymentBatcher.sol --fail-none`  
Exit: 0. Detectors: 64 (High: 0, Medium: 11, Low: 28, Info: 24, Opt: 1).

Medium hits are mostly known patterns (`incorrect-equality`, `reentrancy-no-eth` on
delegate/module flows, `unused-return` on low-level calls). No new High-impact
Slither findings on the batcher file. Full-repo CI Slither remains the broader gate.

## Residual

1. Store reseed for Phase2Module + Creator/Agent OVaultWrapper codeIds completed (2026-07-17).
2. Phase1 agent-core hot-swap before agent canary.
3. Rebalance suite excluded (~65 known fails).
4. Slither supplemental when memory allows.
