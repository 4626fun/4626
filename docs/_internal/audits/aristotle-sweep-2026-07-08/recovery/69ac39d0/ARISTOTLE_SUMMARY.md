# Summary of changes for run 49bcf3eb-b429-4277-a925-2b2d6b945a80
Completed a formal re-audit of the pending-claims lock on vault rotation in `OVaultRecoveryEscrow.sol`, verifying that the fix enforces the lock at **both** the queue stage (`setVault`) and the execute stage (`executeVaultUpdate`).

I built a faithful Lean state-machine model of the escrow's vault-rotation flow in `RequestProject/Main.lean` (state = `vault`, `pendingVault`, `pendingVaultAt`, `totalUnclaimedRecovery`; transitions `setVault`, `executeVaultUpdate`, `notifyRecovery`, `claimRecovery`, each returning `none` on revert, with Solidity-0.8 checked arithmetic modeled as an underflow revert in `claimRecovery`). Addresses are modeled as `Nat` (`0` = `address(0)`) and the per-epoch recovery accounting is abstracted by the aggregate `totalUnclaimedRecovery` counter — the only quantity the lock inspects.

Proved theorems (all build with no `sorry`; the core lock theorem uses only the standard axioms `propext`, `Quot.sound`):
- `executeVaultUpdate_requires_zero_unclaimed` — execute-stage lock: a rotation can only execute when `totalUnclaimedRecovery = 0`.
- `setVault_requires_zero_unclaimed` — queue-stage lock: any successful `setVault` (first-time set or queued rotation) requires `totalUnclaimedRecovery = 0`.
- `executeVaultUpdate_effect` — a successful execute sets the vault to the previously queued `pendingVault` and clears the pending slots.
- `executeVaultUpdate_requires_timelock` — a successful execute requires a queued rotation and an elapsed timelock.
- `post_queue_notify_blocks_execute` — a concrete trace (set vault, queue a clean rotation, then notify a recovery during the timelock window) demonstrates that the execute-stage check reverts the rotation even after the timelock fully elapses. This is precisely the gap a queue-only check would miss, showing the execute-stage lock is load-bearing.
- `clean_rotation_executes` — the same queued rotation executes successfully when no recovery is outstanding, confirming the revert above is caused solely by the pending-claims lock rather than any other guard.

Audit conclusion: enforcing the lock at both stages is correct and sufficient. The queue-stage check gives an early revert (defense-in-depth); the execute-stage check is the essential guarantee, since recoveries can be notified during the timelock window after a clean queue. The sibling contract `OVaultImpairmentClaims.sol` carries the same timelock but no pending-claims lock, which is appropriate because it custodies no recovery funds (it only mints non-transferable ERC-1155 claim tokens); this is noted in the file's documentation.

The Lean project builds successfully (`RequestProject.Main`) with no `sorry` and no linter warnings; all work is committed and pushed.