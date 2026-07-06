# AgentOVault Integration + 4626 Singleton Rename — Delta Audit

**Date:** 2026-07-04
**Reviewer:** GLM 5.2 (automated)
**Baseline:** June 2026 Fable full-repo review (4626-FABLE-2026-06)
**Scope:** Uncommitted branch work — AgentOVault product lane + 4626* singleton hard-cut rename
**Type:** Read-only delta security + architecture audit

---

## Executive Summary

**V1 (non-cooperative deposits): SHIP.** The agent vault accounting seam is sound — measured FOT deposits/withdraws are correctly accounted, inflation-attack guards reject `received != requested`, rebasing-up (`received > requested`) is rejected, share solvency on outflows is enforced, and cross-wiring between creator and agent core modules is prevented by `_expectedCoreModuleKind()` returning distinct `AGENT_MODULE_KIND_CORE` vs `MODULE_KIND_KIND` constants. 12/12 accounting tests pass.

**V2 (revenue router + keeper): SHIP WITH CAVEATS.** AgentRevenueRouter is a clean fork of PayoutRouter with safe no-op keeper behavior. The keeper action correctly guards on `agentRevenueRouterAddress` presence, `projectTaxRecipient === router` check, and `projectTaxPendingSwap > 0` before acting. The API handler returns 501 (scaffold). One functional gap: AgentOracle exposes `getAgentPrice()` but LotteryManager4626 calls `getCreatorPrice()` via `ICreatorOracle` — agent token buys won't generate lottery entries (safe try/catch, no crash, but no lottery participation either).

**Overall:** No Critical or High findings. Two Medium findings (dead-code guard, oracle interface mismatch), two Low (incomplete VRF rename, stale naming), two Info (missing batcher agent test, fixture gap).

---

## Findings Table

| ID | Severity | Status | File:Line | Impact | Recommendation |
|----|----------|--------|-----------|--------|----------------|
| F-01 | Medium | VERIFIED | `DeploymentBatcher.sol:745,790` | Dead-code guard: `agentVaultCoreModule` immutable defaults to `vaultCoreModule` at construction (line 745), so the `if (isAgent && agentVaultCoreModule == address(0)) revert ZeroAddress()` check at line 790 is unreachable. If batcher is deployed without a distinct agent core module, agent deploys will use the creator core module and fail at `vault.setModulesOnce()` with a module-kind mismatch — safe but confusing error. | Either remove the dead check at 790 or change line 745 to NOT default (keep `address(0)` and let 790 catch it). Prefer the latter: `agentVaultCoreModule = _agentVaultCoreModule;` and rely on the 790 guard. |
| F-02 | Medium | VERIFIED | `AgentOracle.sol:505` vs `4626LotteryManager.sol:914` | AgentOracle exposes `getAgentPrice()` but LotteryManager4626._calculateTokenUSD calls `ICreatorOracle(oracleAddr).getCreatorPrice()`. AgentOracle does not implement `getCreatorPrice()`. The lottery's try/catch (line 914) silently returns (0,0,0), so agent token buys generate no lottery entries. No crash, but agent lane has no lottery participation. | For V2+, either (a) make AgentOracle implement `getCreatorPrice()` as an alias to `getAgentPrice()`, or (b) have LotteryManager4626 dispatch on `getVaultKind()` and call `getAgentPrice()` for agent tokens. Document as intentional V1 gap if lottery for agent tokens is deferred. |
| F-03 | Low | VERIFIED | `contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol` + `script/DeployInfrastructure.s.sol:12` | Old VRF file still exists alongside new `contracts/shared/lottery/4626VRFConsumer.sol`. Deploy scripts (`DeployInfrastructure.s.sol`, `DeployCoreInfraV2Extras.s.sol`) still import the old file. Rename is incomplete — dual-file situation. | Either delete the old file and update scripts to import `4626VRFConsumer.sol`, or document that the old file is retained as a compatibility alias. The old file is still modified (M status) so it's not stale; but having both is confusing. |
| F-04 | Low | VERIFIED | `kpr/utils/registry.ts:76`, `frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts`, `frontend/server/_lib/onchain/creatorRegistryVerification.ts` | Stale "CreatorRegistry" naming in function names (`getCreatorRegistryAddress`), comments, and TypeScript types. Not functional — the on-chain address is unchanged at `0x888506...4626` — but creates naming confusion after the hard-cut rename. | Rename `getCreatorRegistryAddress` → `getRegistry4626Address` and update comments. Low priority; can be done in a follow-up naming pass. |
| F-05 | Info | VERIFIED | `test/` (missing) | No `DeploymentBatcher.AgentPhase1.t.sol` test exists. The agent deploy path through the batcher (VaultKind.Agent, "agentVault"/"agentWrapper" salts, agentVaultCoreModule wiring) is untested at the batcher level. | Must be added before mainnet agent deploy. Test should cover: (1) agent Phase 1 deploys with distinct salts, (2) agent vault wired with agent core module (not creator), (3) Phase 1/2 replay/state-hash compatibility, (4) wrong codeId → module wiring failure. |
| F-06 | Info | VERIFIED | `test/helpers/DeploymentBatcherFixture.sol:64-65` | Fixture passes `cfg.vaultCoreModule` for both `_vaultCoreModule` and `_agentVaultCoreModule` constructor args. This means tests that exercise agent deploys through the batcher would use the creator core module, which would fail at `setModulesOnce()` due to module-kind mismatch. No agent batcher test exists yet (F-05), so this is latent. | When adding F-05 tests, fixture should provide a distinct `agentVaultCoreModule` instance. |

---

## Architecture Verdict

The three-layer stack is sound:

```
AgentTokenV4 (FOT, Virtuals-style)
    ↓ tax route
AgentRevenueRouter (fork of PayoutRouter)
    ↓ deposit
AgentOVault ◇ (measured-transfer ERC-4626, AgentOVaultCoreModule)
    ↓ wrap
AgentOVaultWrapper (10³ normalization)
    ↓ bridge
AgentShareOFT ◆ (cross-chain, buy-fee, lottery wiring)
```

**Lane separation from creator ▢/■ is enforced at three levels:**

1. **Vault level:** `AgentOVault._expectedCoreModuleKind()` returns `keccak256("AgentOVaultModule.core")` (line 31), distinct from `CreatorOVault._expectedCoreModuleKind()` which returns `MODULE_KIND_CORE`. `setModulesOnce()` calls `_validateModuleIdentity(coreModule, _expectedCoreModuleKind())` — so an AgentOVault can never be wired with a CreatorOVaultCoreModule and vice versa.

2. **Batcher level:** Distinct CREATE2 salts (`"agentVault"`/`"agentWrapper"` vs `"vault"`/`"wrapper"`) prevent address collisions. `vaultKind` field in `Phase1Params` selects the core module and salt labels.

3. **Registry level:** `I4626Registry.VaultKind` enum (`Creator`/`Agent`) and `AgentIntegrationMeta` struct indexed by token address. `getVaultKind(token)` lets consumers dispatch on lane.

**No lane conflation detected.** The `projectTaxRecipient` invariant (never set to raw vault, always through AgentRevenueRouter) is enforced by `AgentRevenuePolicyController.sol:28` which calls `IAgentTokenV4(agentToken).setProjectTaxRecipient(agentRevenueRouter)`. The keeper action double-checks at runtime (line 82).

---

## Rename Blast-Radius Audit

**Live registry address unchanged:** `0x888506B92181c57A2fD06516FFFb6F375b7A4626` — confirmed in `deployments/base/shared-global-vanity-targets.json`.

**Renamed files (on-chain contract names changed):**
- `CreatorRegistry` → `Registry4626` (`contracts/shared/core/4626Registry.sol`)
- `CreatorLotteryManager` → `LotteryManager4626` (`contracts/shared/lottery/4626LotteryManager.sol`)
- `CreatorVRFConsumerV2_5` → `VRFConsumer4626` (`contracts/shared/lottery/4626VRFConsumer.sol`)

**Stale references remaining (non-blocking but should be cleaned up):**

| Location | Reference | Risk |
|----------|-----------|------|
| `script/DeployInfrastructure.s.sol:12` | imports old `CreatorVRFConsumerV2_5` | Deploy script uses old file |
| `script/DeployCoreInfraV2Extras.s.sol:7` | imports old `CreatorVRFConsumerV2_5` | Deploy script uses old file |
| `script/SeedCreatorRegistry.s.sol` | contract name `SeedCreatorRegistry` | Naming only |
| `kpr/utils/registry.ts:76` | `getCreatorRegistryAddress()` | Naming only |
| `frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts` | "CreatorRegistry" in comments | Naming only |
| `frontend/server/_lib/onchain/creatorRegistryVerification.ts` | Type names `CreatorRegistryValidationReason` etc. | Naming only |
| `contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol` | Old file still exists (modified, not deleted) | Dual-file with `4626VRFConsumer.sol` |

**No prod wiring breakage detected.** All on-chain imports in `contracts/` that reference the registry use either `I4626Registry` (new) or `ICreatorRegistry` (alias interface file still present at `contracts/shared/interfaces/core/ICreatorRegistry.sol`). The lottery/ShareOFT/gauge contracts all import the new names. The stale references are in scripts and frontend server code (naming only, not import paths).

---

## Test Gap Analysis

**Must be added before mainnet agent deploy:**

1. **`DeploymentBatcher.AgentPhase1.t.sol`** — agent Phase 1 deploy through the batcher:
   - VaultKind.Agent deploys with distinct "agentVault"/"agentWrapper" salts
   - Agent vault wired with agent core module (not creator)
   - Phase 1 state hash includes vaultKind
   - Wrong codeId → module wiring failure reverts

2. **`DeploymentBatcher.AgentPhase2.t.sol`** — agent Phase 2 finalize:
   - FOT-aware deposit (received != requested handling)
   - Share split (auction/vesting/Solana/LP) with FOT-adjusted amounts

3. **Mainnet fork test with real AgentTokenV4 proxy** (e.g., ATIKA):
   - Verify `vault()`, `projectTaxRecipient()`, `taxAccountingAdapter()` return expected addresses
   - Verify deposit through AgentRevenueRouter with real FOT token
   - Verify tax harvest via `distributeTaxTokens()` routes correctly

4. **AgentShareOFT lottery integration test** — once F-02 is resolved:
   - Agent token buy generates lottery entry via AgentShareOFT
   - LotteryManager4626 processes agent token swap correctly

**Existing agent test coverage (14 tests, all passing):**
- `AgentOVault.TransferAccounting.t.sol` — 12 tests (measured deposit/withdraw, inflation guards, rebasing rejection)
- `AgentRegistry.VaultKind.t.sol` — 1 test (setAgentIntegrationMeta + getVaultKind)
- `MockAgentTokenV4.t.sol` — 1 test (mock token behavior)

---

## Comparison to Prior Fable Pass

**New issues only (not in 4626-FABLE-2026-06):**

- F-01 through F-06 above are all new, introduced by this diff.
- No prior findings reintroduced or worsened.

**Paths NOT touched by this diff (confirmed no impairment):**
- ERC-4337 / wallet invariants — no changes to `canonicalCswEnv.ts`, `txRouter.ts`, or wallet routing
- x402 / payment paths — not touched
- Deploy-session execution — `DeploymentBatcher` extended but deploy-session server code unchanged
- XMTP / Telegram identity flows — not touched
- Privy auth — not touched
- Solana bridge — `SolanaBridgeAdapter.sol` modified for import path rename only (ICreatorRegistry → I4626Registry)

---

## Validation Gates

| Gate | Command | Result |
|------|---------|--------|
| Forge full suite | `forge test` | **920 passed, 0 failed, 1 skipped** — EXIT=0 ✓ |
| Agent subset | `forge test --match-contract Agent` | **14 passed, 0 failed** — EXIT=0 ✓ |
| KPR typecheck | `pnpm -C kpr typecheck` | **EXIT=0** ✓ |
| Frontend typecheck | `pnpm -C frontend typecheck` | **EXIT=2** — 5 pre-existing errors in account/auth files NOT in this diff (see below) |
| Frontend CSW guard | `pnpm -C frontend guard:canonical-csw` | **OK** — EXIT=0 ✓ |
| Frontend test | `pnpm -C frontend test` | **EXIT=1** — 6 pre-existing failures in 3 files NOT in this diff (see below) |

**Pre-existing frontend failures (NOT caused by this diff):**

Typecheck errors (5):
- `src/lib/account/mergeAccountMeBootstrap.test.ts:16,54` — `AccountSignals` missing `basename`, `primaryWalletAddress`, `embeddedEoaAddress`
- `src/lib/account/mergeAccountMeBootstrap.ts:171` — type incompatibility
- `src/pages/Vault.tsx:111` — unused `setSearchParams`
- `src/pages/accounts/AccountsPage.test.ts:80` — `AccountSignals` type mismatch

Test failures (6):
- `api/__tests__/waitlistBootstrapPrivyUnique.test.ts` — 2 failures (privy unique conflict recovery)
- `server/_lib/wallet/creatorInfrastructure.test.ts` — 2 failures (CSW infrastructure resolution)
- `server/_lib/messaging/creatorXmtpAgents.test.ts` — 2 failures (enableCswAgent validation)

**None of these files are in the agent-vault/registry-rename diff.** Confirmed via `git diff --name-only` — the diff touches only contracts, kpr/utils/registry.ts, kpr/runner.ts, frontend/api/_handlers/_routes.ts, and frontend/src/lib/tokens/tokenSymbols.ts. The failing files are in account/auth/wallet/xmtp code that was not modified in this changeset.

---

## Severity Rubric Reference

- **Critical:** remote unauthenticated fund loss, registry/lottery hijack, vault insolvency, cross-lane module wiring bypass — **none found**
- **High:** owner-cooperation bypass, tax mis-accounting, stuck funds, wrong sender in batcher finalize — **none found**
- **Medium:** UX double-tax, keeper DoS, incomplete access control — F-01, F-02
- **Low/Info:** naming, docs drift, test coverage, deferred layout — F-03, F-04, F-05, F-06
