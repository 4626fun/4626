# 4626 Security Review TODO

Use this as the execution checklist for the current x-ray pass.

## P0 — Deploy Path Integrity

- [ ] Review `contracts/helpers/batchers/DeploymentBatcher.sol` phase ordering (`deployPhase*` / `finalizePhase*`)
- [ ] Verify `msg.sender == params.owner` enforcement across all phase entrypoints
- [ ] Check retry/partial-state behavior when phase execution fails mid-transaction
- [ ] Review `contracts/factories/UniversalCreate2DeployerFromStore.sol` authorization model (`owner` vs `authorizedDeployers`)
- [ ] Validate CREATE2 codeId/salt collision assumptions and failure handling

## P0 — Vault Accounting Symmetry

- [ ] Review `contracts/vault/CreatorOVault.sol` for share/asset accounting consistency
- [ ] Review `contracts/vault/modules/CreatorOVaultCoreModule.sol` deposit/mint vs withdraw/redeem symmetry
- [ ] Verify invariants around `totalSupply`, user share balances, and asset accounting under stressed exits
- [ ] Review `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` strategy debt reconciliation on partial/failed withdrawal legs
- [ ] Verify `totalStrategyWeight <= 10_000` enforcement across add/remove/reweight paths

## P0 — Cross-Chain / LayerZero Route Coherence

- [ ] Review `contracts/utilities/messaging/CreatorShareOFT.sol` fee lane routing and destination consistency
- [ ] Verify peer/endpoint assumptions and message-source trust checks in OFT/OApp flows
- [ ] Review `contracts/utilities/oracles/CreatorOracle.sol` relay assumptions (origin, freshness, update authorization)
- [ ] Review `contracts/utilities/lottery/CreatorLotteryManager.sol` replay/nonce/deadline lifecycle consistency

## P1 — Supporting Surface: Solana NAV Trust Boundary

- [ ] Review `contracts/utilities/bridge/SolanaBridgeAdapter.sol` privileged route/token mapping controls
- [ ] Review `contracts/vault/strategies/SolanaStrategy.sol` report replay guard (`reportId`) and NAV bounds
- [ ] Verify keeper authorization and failure-mode behavior for delayed/inconsistent bridge updates

## P1 — Invariant-Driven Validation

- [ ] For each `On-chain: No` invariant in `x-ray/invariants.md`, verify whether the gap is a real issue vs intended design
- [ ] For each cross-contract invariant (`X-*`), validate both sides in code: caller assumptions and callee write paths
- [ ] Map confirmed issues back to `x-ray/x-ray.md` top attack surfaces

## P2 — Tests / Verification

- [ ] Add targeted tests for deploy phase retries and partial finalize scenarios
- [ ] Add targeted tests for hostile/partial strategy withdrawal accounting
- [ ] Add targeted tests for cross-chain replay/misroute attempts
- [ ] Run focused test subsets before full-suite/coverage attempts

## Suggested Order (ROI-first)

1. `DeploymentBatcher` + universal deployer
2. `CreatorOVault` + core/strategy modules
3. `CreatorShareOFT` + `CreatorOracle` + `CreatorLotteryManager`
4. `SolanaBridgeAdapter` + `SolanaStrategy`

