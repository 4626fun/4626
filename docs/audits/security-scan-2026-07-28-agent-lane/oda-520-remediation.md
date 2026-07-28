# ODA-520 remediation — CreatorPayoutRouter & CreatorCoinPolicyController

**Track:** https://leftclaw.services/result/520.html  
**Report:** [oda-reports/520.html](./oda-reports/520.html)  
**Pin:** `audit/oda-2026-07-28-strategies-revenue` @ `f09a31ad09fbe6e0c7833bce7b61b8743a2b6293`

## Fixed

| Sev | Item | Fix |
|-----|------|-----|
| High | Keeper spend cap only on external venue | `_consumeKeeperExternalSpend` now runs at the start of `_convertAndQueue` (V3 + direct deposit) |
| High | `swapRouter` omitted from external-swap blocklist | Block `swapRouter`, `weth`, `protocolRewards` in `_requireSafeExternalSwapAddress` |
| High/Med | Standing max `swapRouter` allowance | `setSwapPath` no longer approves; `_convertAndQueue` uses per-call approve/reset (also closes M4 self-revoke DoS) |
| Medium | External `spender=swapRouter` zeros V3 allowance | Eliminated by removing standing allowance (above) |
| Low | Residual `shareOFT` permanently stuck | `sweepShareOFT()` queues balance into burn stream |
| Low | Cap window 2× burst + reconfigure reset | Decaying spend window; `setKeeperExternalSpendCap` preserves accrued spend |
| Low | Controller ownership handoff had no delay | `OWNERSHIP_TRANSFER_DELAY = 1 days` before `acceptCreatorCoinOwnership` |

## Leads closed in the same pass

| Lead | Fix |
|------|-----|
| Incomplete V3 path-length validation | Require `(path.length - 20) % 23 == 0` |
| Underflow panic on `tokenIn` increase | Guarded spent calculation |
| Wrong ProtocolRewards fallback selector | `0x9f1d9267` → `0xdb518db2` (`withdrawFor(address,uint256)`) |
| Controller constructor no code check | Require code on `creatorCoin` / `payoutRouter` |

## Tests

- `test/PayoutRouter.t.sol` (`test_ODA520_*`)
- `test/CreatorCoinPolicyController.ODA520.t.sol`

## Deferred

- Oracle/TWAP-backed slippage floors (`minOut != 0` remains the floor; callers still supply `minOut`)
- `receive()` gas-stipend incompatibility with `.transfer()`/`.send()`
- `processBatch` `totalTokenOut` unit mixing (event-only)
- Emergency-withdraw request expiry / overwrite event
- Delta-measure `wrapper.unwrap` / `vault.deposit` return values (out-of-repo trust)
