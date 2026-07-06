# contracts/ Folder Architecture Optimization Proposal

**Date:** 2026-07-05
**Status:** PROPOSAL — awaiting go-ahead before execution
**Author:** GLM 5.2 (automated audit)

---

## 1. Current State Analysis

109 production `.sol` files across 12 top-level dirs. 286 `.sol` files total
(incl. test + script).

### Problems Identified

| # | Issue | Severity | Evidence |
|---|-------|----------|----------|
| A1 | **`utilities/` is a catch-all** | High | 20 files / 6 subdirs mixing 6 unrelated domains (bridge, lottery-infra, messaging, oracles, routers, vesting). "utilities" implies helper code; these are core protocol contracts. |
| A2 | **Agent lane fragmented across 6 dirs** | High | `vault/agent/`, `governance/agent/`, `utilities/messaging/agent/`, `utilities/oracles/agent/`, `utilities/routers/agent/`, `revenue/agent/`. The agent product lane cannot be reviewed as a coherent unit. |
| A3 | **Lottery split across 2 roots** | Medium | Managers in `lottery/`, infrastructure in `utilities/lottery/`. Same domain, two homes. |
| A4 | **Revenue split across 2 roots** | Medium | Agent revenue in `revenue/agent/`, creator revenue (CreatorPayoutRouter, CreatorVaultShareBurnStream) in `creator/revenue/`. |
| A5 | **`crosschain/` dead dir** | Low | Contains only README.md, zero `.sol` files. |
| A6 | **`helpers/` mixes 3 concerns** | Medium | Deploy batchers (deploy infra), TaxHookConfigurator (Uniswap V4 hook), UniversalBytecodeStore (runtime infra). Different lifecycles, different owners. |
| A7 | **Interfaces inconsistently organized** | Medium | 12 flat files at `interfaces/` root mixing external (IWETH9, ILayerZeroEndpointV2, IAjnaPool) with internal (ICreatorOracle, IStrategy). 4 subfolders exist but don't cover all domains. |
| A8 | **Prefix inconsistency** | Low | `Creator*` (15+ files), `4626*` (3 files, just renamed), `Agent*` (9 files), unprefixed (DeploymentBatcher, TaxHookConfigurator). Post-rename, `Creator` and `4626` coexist confusingly. |
| A9 | **Deep relative imports** | Low | 21 imports use `../../../` (3+ levels). e.g. `../../utilities/vesting/CreatorLinearVesting.sol`. No `@4626/` self-remapping. |
| A10 | **`libraries/` split style** | Low | `TickMathCompat.sol` + `V4LiquidityAmounts.sol` at root, `uniswapv3/` in subfolder. Inconsistent depth. |

### Blast Radius of a Full Restructure

- 109 production `.sol` files would move
- 37 files import from `utilities/` → path updates
- 38 files import from `helpers/` → path updates
- 21 deep relative imports → simplify via `@4626/` remapping
- ~100 test files + ~50 scripts → import path updates
- **Total: ~286 files touched**

This is a mechanical but high-volume change. Must be done on a dedicated
branch, validated with `forge test` (920 tests) + `forge build --sizes`
(EIP-170 gate), and committed atomically.

---

## 2. Proposed Target Architecture

Modeled after OpenZeppelin (by-function) + Lens/Aave (by-domain-feature),
adapted to 4626's dual-lane (Creator + Agent) structure.

```
contracts/
├── core/                          # Protocol singleton registry
│   └── 4626Registry.sol
│
├── vault/                         # ERC-4626 vaults + modules + wrappers
│   ├── creator/
│   │   ├── CreatorOVault.sol
│   │   ├── CreatorOVaultWrapper.sol
│   │   ├── libraries/
│   │   │   └── CreatorOVaultLiquidityLib.sol
│   │   └── modules/
│   │       ├── CreatorOVaultCoreModule.sol
│   │       ├── CreatorOVaultAdminModule.sol
│   │       ├── CreatorOVaultStrategiesModule.sol
│   │       ├── CreatorOVaultModuleBase.sol
│   │       ├── CreatorOVaultModuleStorage.sol
│   │       └── ICreatorOVaultModuleIdentity.sol
│   ├── agent/
│   │   ├── AgentOVault.sol
│   │   ├── AgentOVaultWrapper.sol
│   │   └── modules/
│   │       └── AgentOVaultCoreModule.sol
│   └── recovery/
│       ├── CreatorOImpairmentClaims.sol
│       └── CreatorORecoveryEscrow.sol
│
├── strategies/                    # Vault yield strategies (was vault/strategies)
│   ├── cca/
│   │   ├── CCALaunchStrategy.sol
│   │   ├── CCALaunchStrategyConfigModule.sol
│   │   └── CCALaunchStrategyEncodingHelper.sol
│   ├── ajna/
│   │   ├── AjnaERC4626Vault.sol
│   │   ├── AjnaVaultAuth.sol
│   │   ├── AjnaVaultBuffer.sol
│   │   └── AjnaVaultLibrary.sol
│   ├── launchpad/
│   │   └── LBPStrategyWithTaxHook.sol
│   ├── univ3/
│   │   └── CreatorCharmStrategy.sol
│   └── univ4/
│       ├── ApprovedV4HooksRegistry.sol
│       ├── ConcentratedStrategy.sol
│       ├── CreatorLPManager.sol
│       ├── FullRangeStrategy.sol
│       └── LimitOrderStrategy.sol
│
├── governance/                    # Gauge voting, bribes, ve4626 (generalized in shared/)
│   ├── shared/
│   │   ├── ve4626GaugeVoting.sol
│   │   ├── ve4626VoterRewardsDistributor.sol
│   │   └── VaultRolePolicyManager.sol
│   ├── creator/
│   │   ├── CreatorGaugeController.sol
│   │   ├── ve4626.sol
│   │   └── ve4626BoostManager.sol
│   ├── agent/
│   │   └── AgentGaugeController.sol
│   ├── bribes/
│   │   └── BribeDepot.sol
│   └── factories/
│       └── BribesFactory.sol
│
├── lottery/                       # Unified lottery domain (was split)
│   ├── manager/
│   │   ├── 4626LotteryManager.sol
│   │   └── 4626VRFConsumer.sol
│   ├── randomness/
│   │   ├── IRandomnessSource.sol
│   │   ├── RandomnessRouter.sol
│   │   ├── ChainlinkVRFAdapter.sol
│   │   ├── DrandRandomnessSource.sol
│   │   └── EIP2537Probe.sol
│   ├── vrf/
│   │   └── ChainlinkVRFIntegratorV2_5.sol
│   └── zk/
│       ├── IAmoePlonkVerifier.sol
│       ├── AmoePlonkVerifier.sol
│       └── LotteryAmoeRouter.sol
│
├── revenue/                       # Unified revenue domain (was split)
│   ├── creator/
│   │   ├── CreatorPayoutRouter.sol
│   │   ├── CreatorVaultShareBurnStream.sol
│   │   └── CreatorCoinPolicyController.sol
│   └── agent/
│       ├── AgentRevenueRouter.sol
│       ├── AgentOVaultTaxAdapter.sol
│       └── AgentRevenuePolicyController.sol
│
├── messaging/                     # LayerZero OFT + hub composer (was utilities/messaging)
│   ├── creator/
│   │   ├── CreatorShareOFT.sol
│   │   └── OVaultHubComposer.sol
│   └── agent/
│       └── AgentShareOFT.sol
│
├── oracles/                       # Price oracles (was utilities/oracles)
│   ├── creator/
│   │   └── CreatorOracle.sol
│   └── agent/
│       └── AgentOracle.sol
│
├── bridge/                        # Solana bridge (was utilities/bridge)
│   └── SolanaBridgeAdapter.sol
│
├── vesting/                       # Token vesting (was utilities/vesting)
│   └── CreatorLinearVesting.sol
│
├── deploy/                        # Deploy infrastructure (was helpers/)
│   ├── batchers/
│   │   ├── DeploymentBatcher.sol
│   │   ├── StrategyDeploymentBatcher.sol
│   │   ├── StrategyDeploymentFactories.sol
│   │   ├── VaultActivationBatcher.sol
│   │   ├── VaultAuxiliaryDeployBatcher.sol
│   │   └── RouteCoherenceChecker.sol
│   ├── infra/
│   │   ├── UniversalBytecodeStore.sol
│   │   ├── UniversalBytecodeStoreV2.sol
│   │   └── OFTBootstrapRegistry.sol
│   ├── hooks/
│   │   └── TaxHookConfigurator.sol
│   └── factories/
│       ├── Create2Deployer.sol
│       ├── UniversalCreate2DeployerFromStore.sol
│       └── CreatorOVaultFactory.sol
│
├── alfaclub/                      # AlfaClub product lane (unchanged)
│   ├── AlfaCreatorKeyPool.sol
│   └── AlfaCreatorKeyLPFactory.sol
│
├── libraries/                     # Shared internal libraries
│   └── uniswap/
│       ├── TickMathCompat.sol
│       ├── V4LiquidityAmounts.sol
│       ├── LiquidityAmounts.sol
│       └── PositionKey.sol
│
└── interfaces/                    # ALL interfaces, organized by domain
    ├── core/
    │   ├── I4626Registry.sol
    │   ├── ICreatorRegistry.sol          # alias (kept for compat)
    │   ├── ICreatorOVault.sol
    │   ├── IAgentOVault.sol
    │   ├── ICreatorGaugeController.sol
    │   ├── IAgentGaugeController.sol
    │   └── ILotteryManager4626.sol
    ├── vault/
    │   └── ICreatorOVaultComposer.sol
    ├── strategies/
    │   ├── IStrategy.sol
    │   ├── IStrategyValuation.sol
    │   ├── ILPStrategy.sol
    │   └── ICCALaunchStrategy.sol
    ├── oracles/
    │   └── ICreatorOracle.sol
    ├── bridge/
    │   ├── IBaseSolanaBridge.sol
    │   └── ICrossChainERC20Factory.sol
    ├── deploy/
    │   └── ICREATE2Factory.sol
    ├── external/                         # third-party protocol ifaces
    │   ├── IWETH9.sol
    │   ├── ILayerZeroEndpointV2.sol
    │   ├── IAjnaPool.sol
    │   └── ICharmFactory.sol
    ├── agent/                            # agent-lane-specific external ifaces
    │   ├── IAgentTokenV4.sol
    │   └── IAgentTaxAccountingAdapter.sol
    └── uniswap/                          # Uniswap V3/V4 ifaces (unchanged)
        ├── INonfungiblePositionManager.sol
        ├── IUniswapV3Factory.sol
        ├── IUniswapV3MintCallback.sol
        ├── IUniswapV3Pool.sol
        └── IUniswapV3SwapCallback.sol
```

### Key Structural Decisions

1. **`utilities/` eliminated entirely.** Every subdomain promoted to a
   top-level dir (`messaging/`, `oracles/`, `bridge/`, `vesting/`). This
   matches OpenZeppelin's by-function convention and makes the protocol
   surface self-describing.

2. **Agent lane kept as `agent/` subfolders within each domain**, NOT a
   single `agent/` top-level dir. Rationale: the agent lane is a *variant*
   of the creator lane, not an independent product. Co-locating
   `vault/creator/` + `vault/agent/` makes the variant relationship visible
   and forces the two to be reviewed together. A top-level `agent/` would
   hide the shared interfaces and encourage drift.

3. **Lottery unified** under `lottery/` with `manager/`, `randomness/`,
   `vrf/`, `zk/` subfolders. Managers and infra are the same domain.

4. **Revenue unified** under `revenue/` with `creator/` + `agent/`
   subfolders. CreatorPayoutRouter moves to `creator/revenue/`.

5. **`helpers/` → `deploy/`** with `batchers/`, `infra/`, `hooks/`,
   `factories/`. "helpers" is vague; "deploy" says what it is. Hooks stay
   under deploy because TaxHookConfigurator is a deploy-time configurator,
   not runtime governance.

6. **`strategies/` promoted to top-level** (was `vault/strategies/`).
   Strategies are consumed by vaults but are an independent extensibility
   surface with their own interfaces (`IStrategy`, `IStrategyValuation`).

7. **`crosschain/` removed.** Dead dir. README content preserved in
   `docs/` if needed.

8. **Interfaces fully domain-organized.** No flat files at `interfaces/`
   root. External third-party ifaces (IWETH9, ILayerZeroEndpointV2, IAjnaPool,
   ICharmFactory) go to `interfaces/external/`.

9. **`libraries/uniswap/`** consolidates all Uniswap-compat math libs.

### Out of Scope (Intentionally NOT Changed)

- **File-level naming** (`Creator*` vs `4626*` vs `Agent*` prefixes).
  The `Creator` → `4626` rename is a separate, larger effort that touches
  deploy scripts, frontend, kpr, deployment manifests, and on-chain
  bytecode stores. Do NOT couple it with the folder restructure. The
  folder restructure is purely about *where* files live, not *what* they
  are called.
- **`alfaclub/`** stays as-is — it's an independent product lane.
- **`lib/` and `node_modules/`** — external deps, not touched.

---

## 3. Self-Remapping Recommendation

Add to `foundry.toml` remappings:

```toml
"@4626/=contracts/",
```

This converts:
```solidity
import {CreatorLinearVesting} from "../../utilities/vesting/CreatorLinearVesting.sol";
import {I4626Registry} from "../../interfaces/core/I4626Registry.sol";
```
to:
```solidity
import {CreatorLinearVesting} from "@4626/creator/vesting/CreatorLinearVesting.sol";
import {I4626Registry} from "@4626/shared/interfaces/core/I4626Registry.sol";
```

Benefits:
- Kills all 21 deep relative imports
- Makes moves cheaper (only the path after `@4626/` changes)
- Matches the `@openzeppelin/`, `@uniswap/`, `@layerzerolabs/` convention
  already in use

Caveat:
- `@4626/` must NOT collide with the existing `tamago/` remapping
  (`tamago/=contracts/vault/tamago/`). Verify no clash.
- Some scripts/tests use relative imports to read `out/` artifacts — those
  stay relative.

---

## 4. Migration Plan

### Phase 0 — Prep (no moves yet)
1. Create dedicated branch `chore/contracts-folder-architecture`
2. Stash the in-flight audit fixes (F-01..F-05 + frontend fixes) — they
   must land on `main` FIRST, before the restructure, so the restructure
   diff is purely mechanical moves + import path updates.

### Phase 1 — Restructure (single atomic commit)
1. `git mv` all 109 `.sol` files to new locations (preserves history)
2. Update all import paths in `contracts/` (relative → new relative OR
   `@4626/`-remapped)
3. Update all import paths in `test/` and `script/`
4. Update `foundry.toml` remappings (add `@4626/`)
5. Update `remappings.txt` (add `@4626/`)
6. Delete `contracts/crosschain/` (move README to `docs/` if content matters)

### Phase 2 — Validate
1. `forge build` — must compile clean
2. `forge build --sizes` — EIP-170 gate, no contract over 24,576 bytes
3. `forge test` — all 920 tests pass (0 failures, 1 skip)
4. `pnpm -C frontend typecheck` — no new errors
5. `pnpm -C kpr typecheck` — no new errors
6. `pnpm -C frontend guard:canonical-csw` — passes
7. Spot-check 3-5 files to confirm imports resolve

### Phase 3 — Commit + Push
1. Single commit: `chore: restructure contracts/ folder architecture`
2. PR review — the diff will be large but 100% mechanical (moves + path
   string updates). No logic changes.

### Risk Mitigation
- **`git mv`** preserves file history (blame/rename detection)
- **Single atomic commit** so reverts are clean
- **No logic changes** in the restructure commit — if `forge test` fails,
  it's a missed import path, not a semantic regression
- **Dedicated branch** so `main` is never at risk

---

## 5. Effort Estimate

| Step | Files | Time |
|------|-------|------|
| `git mv` 109 production files | 109 | 15 min (scriptable) |
| Update import paths in `contracts/` | ~80 files w/ imports | 20 min (sed/script) |
| Update import paths in `test/` | ~100 files | 15 min (sed/script) |
| Update import paths in `script/` | ~50 files | 10 min (sed/script) |
| foundry.toml + remappings.txt | 2 | 2 min |
| Validate (forge build/test/sizes + ts gates) | — | 10 min |
| **Total** | **~286** | **~70 min** |

The import-path update is the tedious part. It can be done with a
Python script that:
1. Builds a map of `{old_path: new_path}` for all 109 files
2. For each `.sol` file, regex-replaces import paths using the map
3. Writes the updated file

This script can be validated against `forge build` before committing.

---

## 6. Decision Points for User

1. **Execute now or after audit fixes land?**
   Recommend: AFTER. The audit fixes (F-01..F-05 + frontend) are in-flight
   and must land on `main` first. The restructure should be a clean,
   mechanical follow-up on a dedicated branch.

2. **Adopt `@4626/` self-remapping?**
   Recommend: YES. Kills deep relative imports, matches existing
   `@openzeppelin/` convention, makes future moves cheaper. Low risk.

3. **Rename `Creator*` files to `4626*` in the same pass?**
   Recommend: NO. That's a separate effort touching deploy scripts,
   frontend, kpr, manifests, and on-chain bytecode stores. Coupling it
   with the folder move doubles the risk and muddies the diff. Keep the
   restructure purely about *location*, not *naming*.

4. **Move `strategies/` out of `vault/`?**
   Recommend: YES. Strategies are an independent extensibility surface.
   Co-locating them with vaults implies they're vault-internal, which
   they're not (they have their own interfaces and factories).
