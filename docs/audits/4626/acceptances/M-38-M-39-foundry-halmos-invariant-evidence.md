# M-38 / M-39 Foundry + Halmos Invariant Evidence

Date: 2026-05-05

This note records the first Foundry invariant and Halmos symbolic-test evidence added after the M-38 / M-39 coverage-gap follow-up. It is not a replacement for full protocol verification; it is proof that the new invariant harnesses compile, execute, and cover the intended small decision surfaces.

## Files Added

- `test/DeploymentBatcher.Phase3Invariants.t.sol`
- `test/SystemSafetySymbolic.t.sol`

## Coverage

`DeploymentBatcher.Phase3Invariants.t.sol` covers the phase-3 paid-strategy weight gate:

- invalid productive weights are not accepted
- valid productive weights are not rejected
- registered strategy count matches nonzero weights
- registered strategy weights are nonzero and sum to at most `10_000`
- zero-weight strategy code IDs may be omitted

`SystemSafetySymbolic.t.sol` covers compact model checks for:

- wrapper backing and emergency sweep bounds
- wrapper cooldown max-propagation
- strategy withdrawal accounting under zero-withdraw and negative-idle-delta cases
- NAV/share-price monotonicity under nondecreasing assets
- `CreatorOVault` first-deposit share offset, measured-transfer accounting, `previewRedeem` liquid-asset cap, and `maxDeposit` gating
- `CreatorShareOFT` buy-fee conservation, SwapOnly buy-fee gating, lottery beneficiary fallback, and remote pending-fee accounting
- jackpot reserve overpay prevention
- payout-router deposit/queue matching
- Solana bridge unit conversion
- one-way Solana token registration
- CCA completion precondition gating
- AMOE deadline buffer and replay/nullifier acceptance gates

`LotteryAmoeProperties.t.sol` adds standalone AMOE properties for Echidna, Medusa, Halmos, and Certora local typechecking:

- 60-second legacy AMOE deadline buffer
- nonce, wallet, and points-burn nullifier replay gates
- manager-return semantics for ZK fan-out
- points-burn semantic bounds
- public-input bindings for creator coin, epoch, allowlist root, and points ledger root

## Foundry Evidence

Command:

```sh
forge test --match-path "test/SystemSafetySymbolic.t.sol" --fuzz-runs 64
```

Result:

```text
Ran 6 test suites in 13.47ms (20.48ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
```

AMOE-specific Foundry commands:

```sh
forge test --match-path "test/*Amoe*.t.sol"
forge test --match-path "test/zk/*Amoe*.t.sol"
forge test --match-path "test/LotteryAmoeProperties.Foundry.t.sol" --fuzz-runs 256
```

Result:

```text
70 tests passed, 0 failed, 0 skipped
40 tests passed, 0 failed, 0 skipped
2 tests passed, 0 failed, 0 skipped
```

Command:

```sh
forge test --match-path "test/DeploymentBatcher.Phase3Invariants.t.sol" --fuzz-runs 16
```

Result:

```text
Ran 2 test suites in 50.86s (50.86s CPU time): 2 tests passed, 0 failed, 0 skipped (2 total tests)
```

The phase-3 invariant campaign included:

```text
[PASS] invariant_phase3WeightGateOnlyAcceptsValidProductiveWeights() (runs: 256, calls: 128000, reverts: 0)
```

## Halmos Evidence

Command:

```sh
uvx --python 3.12 halmos --contract DeploymentBatcherPhase3WeightGateSymbolicTest --function check_phase3WeightGate --solver-timeout-assertion 60000
```

Result:

```text
[PASS] check_phase3WeightGate(uint16,uint16,uint16) (paths: 11, time: 0.04s, bounds: [])
Symbolic test result: 1 passed; 0 failed; time: 0.06s
```

For `SystemSafetySymbolic.t.sol`, Halmos requires AST-bearing Forge artifacts. The local verification used a temporary artifact directory:

```sh
forge build "test/SystemSafetySymbolic.t.sol" --ast --out "out-halmos"
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract StrategyWithdrawalAndNavSymbolicTest --function check_ --solver-timeout-assertion 60000
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract WrapperBackingAndCooldownSymbolicTest --function check_ --solver-timeout-assertion 60000
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract CreatorOVaultAccountingSymbolicTest --function check_ --solver-timeout-assertion 60000
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract CreatorShareOFTFeeAndLotterySymbolicTest --function check_ --solver-timeout-assertion 60000
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract GaugePayoutAndPayoutRouterSymbolicTest --function check_ --solver-timeout-assertion 60000
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract SolanaBridgeAndCcaCompletionSymbolicTest --function check_ --solver-timeout-assertion 60000
```

Result summaries:

```text
[PASS] check_strategyWithdrawAccounting(uint64,uint64,uint64,uint64,uint64)
[PASS] check_wrapperBackingAndEmergencyWithdraw(uint64,uint64,uint64,uint64)
[PASS] check_cooldownPropagation(uint64,uint64,bool,bool)
[PASS] check_coinBalanceTracksMeasuredTransfers(uint64,uint64,uint64)
[PASS] check_maxDepositGate(bool,bool,bool,bool,bool,uint64,uint64,uint64)
[PASS] check_previewRedeemCapsQueuedAssets(uint64,uint64,uint64)
[PASS] check_buyFeeConservation(uint64,uint16)
[PASS] check_feeAppliesOnlyOnSwapOnlyBuy(uint64,uint16,uint8,uint8,bool)
[PASS] check_lotteryBeneficiarySelection(address,bool,bool,address)
[PASS] check_remotePendingFees(uint64,uint64,bool)
[PASS] check_jackpotReserveCannotOverpay(uint64,uint64)
[PASS] check_payoutRouterQueuesConvertedShares(uint64,uint64)
[PASS] check_ccaCompletionGate(bool,bool,bool,bool,bool,bool,bool)
[PASS] check_registerTokenIsOneWay(bool,bytes32,bytes32)
[PASS] check_solanaBridgeUnitConversion(uint64,uint8)
```

The final Halmos group reported:

```text
Symbolic test result: 3 passed; 0 failed; time: 0.36s
```

The `CreatorOVault` and `CreatorShareOFT` Halmos groups reported:

```text
Symbolic test result: 3 passed; 0 failed; time: 0.62s
Symbolic test result: 4 passed; 0 failed; time: 0.23s
```

AMOE standalone Halmos command:

```sh
forge build "test/LotteryAmoeProperties.t.sol" --ast --out "out-halmos"
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract LotteryAmoeProperties --function check_ --solver-timeout-assertion 60000
```

Result:

```text
Symbolic test result: 4 passed; 0 failed; time: 0.47s
```

## Echidna / Medusa / Certora Evidence

AMOE standalone properties:

```sh
echidna "test/LotteryAmoeProperties.t.sol" --contract LotteryAmoeProperties --test-mode assertion --test-limit 5000 --seq-len 1 --format text --disable-slither
medusa fuzz --compilation-target "test/LotteryAmoeProperties.t.sol" --target-contracts "LotteryAmoeProperties" --test-limit 5000 --seq-len 1 --workers 4 --no-color
certoraRun "/home/akitav2/projects/4626/test/LotteryAmoeProperties.t.sol:LotteryAmoeProperties" --verify LotteryAmoeProperties:/home/akitav2/projects/4626/certora/specs/LotteryAmoeProperties.spec --compilation_steps_only --solc "/home/akitav2/.solc-select/artifacts/solc-0.8.30/solc-0.8.30" --solc_allow_path "/home/akitav2/projects/4626" --optimistic_loop --msg "local AMOE property compile check"
```

Results:

```text
Echidna: 5,001 calls, all AMOE properties passing
Medusa: 4 AMOE assertion tests passed, 0 failed
Certora: local compilation/typecheck passed
```

## Known Boundary

`model_navShareSupplyMonotonicity(...)` remains Foundry-fuzz only. Halmos timed out on the division-heavy monotonicity query even after narrowing the denominator type. This was intentionally renamed from `check_` to `model_` so Halmos does not include it in the symbolic prefix run.

`model_firstDepositShareOffset(...)` also remains Foundry-fuzz only. Halmos timed out on the multiplication/modulo proof for the first-deposit offset, while Foundry fuzz continues to cover the rule.

Halmos also emits unrelated existing `forge lint` warnings while compiling the full project. Those warnings are outside these new test files and did not cause the symbolic checks above to fail.

## Deeper Stateful Invariant Evidence

`DeepInvariantTargets.t.sol` promotes the highest-value model checks into stateful handlers:

- wrapper backing invariant around `CreatorOVaultWrapper` with live wrap, unwrap, dust, and emergency sweep calls
- strategy withdrawal invariant around a source-level M-09 best-effort withdraw harness with happy, reverting, and mismatched strategies
- gauge jackpot-reserve invariant around a live `CreatorGaugeController` fixture
- bounded NAV numerator monotonicity checked by Halmos, plus scaled PPS monotonicity checked by Foundry fuzz

Foundry:

```sh
forge test --match-path "test/DeepInvariantTargets.t.sol" --fuzz-runs 64
```

Result:

```text
WrapperBackingInvariantTest: 1 passed, 0 failed
StrategyWithdrawInvariantTest: 1 passed, 0 failed
GaugeReserveInvariantTest: 1 passed, 0 failed
BoundedNavMonotonicityHalmosTest: 1 passed, 0 failed
```

Halmos:

```sh
forge build "test/DeepInvariantTargets.t.sol" --ast --out "out-halmos"
uvx --python 3.12 halmos --forge-build-out "out-halmos" --contract BoundedNavMonotonicityHalmosTest --function check_ --solver-timeout-assertion 60000
```

Result:

```text
Symbolic test result: 1 passed; 0 failed; time: 0.37s
```

## Live Handler Invariant Evidence

`LiveHandlerInvariants.t.sol` adds the remaining live-contract handlers:

- `CreatorLotteryManagerLiveInvariantTest` exercises local entries, remote entries, AMOE entries, AMOE manager failure branches, share-balance/oracle branches, VRF results, and pending-result processing against a live `CreatorLotteryManager` harness.
- `DeploymentBatcherPhase12LiveInvariantTest` exercises phase-1 core deployment, phase-1 finalization, registry endpoint poisoning, and deterministic ShareOFT collision reuse through the actual `DeploymentBatcher` phase-1 path.
- `DeploymentBatcherPhase2LiveInvariantTest` exercises phase-2 Permit2 finalization, deposit transfer, and deferred-auction state through the actual `finalizePhase2WithPermit2(...)` path.
- `DeploymentBatcherPhaseLiveInvariantTest` exercises phase-3 strategy registration through `DeploymentBatcher.deployPhase3Strategies(...)` with live batcher/helper mocks and validates the weight/skip rules through the actual batcher path.

Foundry:

```sh
forge test --match-path "test/LiveHandlerInvariants.t.sol" --fuzz-runs 64
```

Result:

```text
CreatorLotteryManagerLiveInvariantTest: 4 passed, 0 failed
DeploymentBatcherPhase12LiveInvariantTest: 1 passed, 0 failed
DeploymentBatcherPhase2LiveInvariantTest: 1 passed, 0 failed
DeploymentBatcherPhaseLiveInvariantTest: 1 passed, 0 failed
```

## CRE Explicit-Intent Evidence

The M-39 CRE follow-up files now exist under `frontend/api/__tests__/`:

- `cre-hmac-bypass.test.ts`
- `cre-nonce-replay.test.ts`
- `cre-ai-consensus-fallback.test.ts`
- `cre-claim-execute-race.test.ts`

Command:

```sh
pnpm -C frontend exec vitest run api/__tests__/cre-hmac-bypass.test.ts api/__tests__/cre-nonce-replay.test.ts api/__tests__/cre-ai-consensus-fallback.test.ts api/__tests__/cre-claim-execute-race.test.ts
```

Result:

```text
4 test files passed, 9 tests passed
```
