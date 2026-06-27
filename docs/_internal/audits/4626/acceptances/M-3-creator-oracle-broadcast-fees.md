# M-3 — CreatorOracle.broadcastCreatorPrice: equal-split variant deprecated

- **Linear:** [4626-439](https://linear.app/4626fun/issue/4626-439) (parent [4626-422](https://linear.app/4626fun/issue/4626-422))
- **Severity:** Medium
- **File:** `contracts/utilities/oracles/CreatorOracle.sol`
- **Base SHA:** `43746e1ced400e60e00c10c527939f250db23896`

## Summary

The legacy 2-arg `broadcastCreatorPrice(dstEids, options)` divided `msg.value / dstEids.length` and used that per-destination. LayerZero fees are not uniform across chains, so broadcasts where one chain quoted above the split amount reverted mid-loop. The per-chain `broadcastCreatorPriceWithFees(dstEids, options, fees)` overload already existed as the correct path.

Option (B) from the ticket is applied: the legacy function body is replaced with a hard revert + migration-signal event. The selector is preserved.

Every call to the deprecated entrypoint now:

1. Emits `BroadcastEqualSplitCallAttempted(msg.sender, msg.value, dstEids)` so trace / `debug_traceCall` tooling surfaces the migration path to off-chain integrators.
2. Reverts with the dedicated `BroadcastEqualSplitDeprecated()` error so call sites fail loudly with a decodable selector rather than opaque `CALL_EXCEPTION`.

No on-chain ETH is spent on the deprecated path.

## Migration for callers

Replace:

```solidity
oracle.broadcastCreatorPrice{value: totalFee}(dstEids, options);
```

with a per-chain fee quote and the `WithFees` overload:

```solidity
uint256[] memory fees = new uint256[](dstEids.length);
uint256 total;
for (uint256 i; i < dstEids.length; ++i) {
    MessagingFee memory f = endpoint.quote(/* ... */);
    fees[i] = f.nativeFee;
    total += fees[i];
}
oracle.broadcastCreatorPriceWithFees{value: total}(dstEids, options, fees);
```

## Acceptance checklist

- [ ] Legacy `broadcastCreatorPrice` body reduced to emit + revert; signature preserved
- [ ] New `error BroadcastEqualSplitDeprecated()` declared
- [ ] New `event BroadcastEqualSplitCallAttempted(address indexed caller, uint256 msgValue, uint32[] dstEids)` declared
- [ ] `// FIX: M-3 (4626-439)` tags present on error, event, and deprecated function
- [ ] `broadcastCreatorPriceWithFees` untouched
- [ ] Regression tests pass under `forge test --match-contract CreatorOracleBroadcastFees`:
  - [ ] 3-dst 0.3 ETH authorized call → emits event + reverts with deprecation error
  - [ ] zero msg.value still reverts with deprecation error (not the old "Insufficient fee")
  - [ ] unauthorized caller still reverts with deprecation error (migration signal path)
  - [ ] `broadcastCreatorPriceWithFees` selector resolves and does not trip the deprecation error

## Out of scope

- Physical removal of the deprecated entrypoint (option A in the ticket). Can be done in a later major release once off-chain callers are known migrated — tracked on parent 4626-422.
- The callers / off-chain broadcaster scripts that pass `msg.value` equal to an aggregate fee. They must be updated to quote per-chain and switch to `broadcastCreatorPriceWithFees`. Frontend / ops scripts out of scope for this PR.
