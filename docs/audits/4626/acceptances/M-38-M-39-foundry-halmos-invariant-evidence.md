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

## Foundry Evidence

Command:

```sh
forge test --match-path "test/SystemSafetySymbolic.t.sol" --fuzz-runs 64
```

Result:

```text
Ran 6 test suites in 13.47ms (20.48ms CPU time): 6 tests passed, 0 failed, 0 skipped (6 total tests)
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

## Known Boundary

`model_navShareSupplyMonotonicity(...)` remains Foundry-fuzz only. Halmos timed out on the division-heavy monotonicity query even after narrowing the denominator type. This was intentionally renamed from `check_` to `model_` so Halmos does not include it in the symbolic prefix run.

`model_firstDepositShareOffset(...)` also remains Foundry-fuzz only. Halmos timed out on the multiplication/modulo proof for the first-deposit offset, while Foundry fuzz continues to cover the rule.

Halmos also emits unrelated existing `forge lint` warnings while compiling the full project. Those warnings are outside these new test files and did not cause the symbolic checks above to fail.

## Next Deeper Targets

- Convert the wrapper backing model into a stateful handler around `CreatorOVaultWrapper` using the existing mocks from `CreatorOVaultWrapper.t.sol`.
- Convert the strategy withdrawal model into a stateful handler around the M-09 harness and hostile strategy fixtures.
- Add a live `CreatorGaugeController` jackpot-reserve invariant using the existing gauge mocks.
- Revisit NAV monotonicity with a dedicated arithmetic lemma or a bounded Halmos harness that avoids direct symbolic division over wide operands.
