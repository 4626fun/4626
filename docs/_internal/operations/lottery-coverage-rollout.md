# Lottery Coverage Boost Rollout

## Scope

This rollout ships:
- coverage-aware personal boost in `LotteryManager4626` via `ve4626BoostManager.calculateBoostForPosition`
- remote payload v2 (`buyerCurrentShareBalance`) in `CreatorShareOFT`
- Curve-style tokenless-normalized mult **1.0×–2.5×** (`l`=covered Share USD, `L`=Share supply USD, `ve`=effectiveVeLottery, `Ve`=live total ve4626)
- covered-fraction composition `1 + (l/swapUSD)·(boost-1)` so uncovered trade value receives no personal uplift
- fixed-budget gauge voting in `ve4626GaugeVoting` (`69,420` PPM total, `35,000` PPM per-vault cap)
- launch: leave LM `boostManager` / `vaultGaugeVoting` at `0` until canary

## Breaking Interface Note

`CreatorLotteryManager.processSwapLottery` now expects:
- `processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256 buyerCurrentShareBalance)`

All callers must use the 4-arg selector before cutover.

## Preflight

1. Confirm ownership/write access for:
   - lottery manager owner
   - registry owner
   - all gauge controller owners
   - Solana adapter owner
2. Confirm current production caller contracts are updated to 4-arg calls:
   - `CreatorShareOFT` (hub path)
   - `SolanaBridgeAdapter` relay path
3. Re-run verification locally:
   - `forge test --match-path test/CreatorLotteryManager.PauseGuards.t.sol`
   - `forge test --match-path test/CreatorLotteryManager.FeeSponsorship.t.sol`
   - `forge test --match-path test/CreatorShareOFT.RemoteLotteryFunding.t.sol`
   - `forge test --match-path test/ve4626GaugeVoting.t.sol`
   - `forge test --match-path test/ve4626BoostManager.t.sol`
4. Size gate:
   - `forge build --sizes --skip test --skip script`
   - ensure `CreatorLotteryManager` runtime is <= 24576 bytes

## Deployment Sequence

1. Deploy new `ve4626BoostManager`.
2. Deploy new `CreatorLotteryManager`.
3. Deploy updated caller contracts that invoke 4-arg lottery entry:
   - hub `CreatorShareOFT` implementations
   - `SolanaBridgeAdapter`
4. Rewire pointers:
   - registry lottery manager pointer
   - each `CreatorGaugeController.setLotteryManager(...)`
   - `SolanaBridgeAdapter.setLotteryManager(...)`
   - `CreatorLotteryManager.setBoostManager(newBoostManager)`
   - `CreatorLotteryManager.setve4626GaugeVoting(activeve4626GaugeVoting)`
5. Verify onchain reads:
   - `lotteryManager.boostManager()`
   - `lotteryManager.vaultGaugeVoting()`
   - `registry.getLotteryManager(chainId)`
   - each gauge controller `lotteryManager()`

## Post-Cutover Checks

1. Local/hub swap path creates entries and stores `effectiveWinChancePPM`.
2. Remote v2 payload entries are accepted.
3. Legacy remote payload (v1) still decodes in manager.
4. Settlement uses stored odds (no recomputation drift).
5. Sponsored VRF and callback policies still enforce caps/rate limits.

## Rollback

If any critical path fails:
1. Set registry lottery manager pointer back to prior manager.
2. Reset gauge controller and Solana adapter pointers to prior manager.
3. Keep new contracts deployed but detached.
4. Re-run smoke checks on the restored path.

## EIP-170 Fallback

If manager size regresses above limit in a future change:
1. Move additional probability/coverage logic to an external helper contract.
2. Keep manager as orchestration + snapshot/settlement.
3. Re-run `forge build --sizes --skip test --skip script` before redeploy.
