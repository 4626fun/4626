# ILotteryAmoeConsumer
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/zk/LotteryAmoeRouter.sol)

**Title:**
LotteryAmoeRouter (v2)

On-chain settlement layer for 4626.fun AMOE lottery entries.
v2 closes the trust gap that allowed `authorizedAmoeRelayer` to
assert an arbitrary `pointsBurnedAsUSD` for any allowlisted
wallet — the value is now bound into a PLONK proof, replay-
guarded by a global nullifier mapping, and anchored by a daily
Merkle root of the off-chain points-burn ledger.
The verifier was migrated from Groth16 v2 to PLONK in PR #409
(no trusted setup needed beyond the universal Powers-of-Tau
transcript). See `docs/security/amoe-plonk-migration.md` for
the full rationale, gas/bytecode tradeoffs, and the
security divergence from stock snarkjs output (explicit
`checkField` on all 8 public inputs).
When PR 4b is rolled out, `CreatorLotteryManager.authorizedAmoeRelayer`
is set to this router's address so `processAmoeEntry` is only ever
called with a cryptographically-bound value.

Two entry paths:
submitAmoeEntry      v1 ECDSA / EIP-1271 (compat path)
submitAmoeEntryZK    v2 PLONK-backed   (audit-grade path)
Both produce the same `AmoeEntryRecorded` event so downstream
consumers don't need to branch.


## Functions
### recordAmoeEntry

Legacy ZK-path consumer hook. Kept for backward compatibility
with deployments that wired the router as an event-only
broadcaster. Production deployments should set the manager
(see `IAmoeManager` + `setManager`) to fan out with the proven
`pointsBurnedAsUSD`.


```solidity
function recordAmoeEntry(address buyer, address creatorCoin, uint64 epoch, uint256 entryId) external;
```

