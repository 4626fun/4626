# Summary of changes for run 990dded9-109f-47e1-ab22-0a0e24c9ed6e
I completed a security audit of the agent revenue / fee-routing subsystem (`AgentGaugeController.sol`, `AgentRevenueRouter.sol`, `AgentRevenuePolicyController.sol`, `AgentOVaultTaxAdapter.sol`), focused on accounting, fee routing, external-call safety, and privileged admin actions. The full report is in `SECURITY_AUDIT.md`, with per-finding exploit paths and remediation.

Prioritized findings:

HIGH
- H-1 (fee routing / external call): `AgentGaugeController._calculateMinOutput`'s `fallbackMinOutputBps` computes `minOut` in WETH units for a WETH→AgentToken swap, treating the two tokens as 1:1. Since AgentToken's unit price is far below ETH, the min-output floor (and the derived `sqrtPriceLimitX96`) becomes trivially satisfiable, effectively disabling slippage protection and enabling sandwich/MEV extraction on the permissionless `processWETHFees()`. Fix: never denominate `minOut` in input-token units — keep failing closed, require an AgentToken-denominated caller `minOut`, or gate the swap to owner/keeper during oracle outages.
- H-2 (privileged admin): A single timelock-less `owner` can repoint every fee sink (`setVault/setWrapper/setAgentToken/setLotteryManager/setProtocolTreasury/setVe4626VoterRewardsDistributor`) and drain jackpot backing (`setLotteryManager(self)` then `payJackpot`), plus sweep transiently-held vaultShares/AgentToken via `emergencyWithdraw`. Fix: timelock + multisig, `Ownable2Step`, guardian-gated/rate-limited emergency withdrawal excluding protocol-owned assets.

MEDIUM
- M-1 (accounting): `emergencyWithdraw` adjusts `accountedOFTBalance` but never `pendingFees`; `_distributeInternal` does `accountedOFTBalance -= pendingFees`, so after a ShareOFT emergency withdrawal the invariant `accountedOFTBalance >= pendingFees` breaks and all future distributions underflow-revert permanently (no reset setter exists).
- M-2 (accounting/admin): The jackpot guard blocks ShareOFT withdrawal only while `jackpotReserve > 0`, not while `pendingFees > 0`, so undistributed burn/voter/treasury fee value can be withdrawn when the jackpot is empty (e.g. before the first distribution).
- M-3 (fee routing/config): `setVault/setWrapper/setAgentToken` perform no cross-consistency checks (`vault.asset() == agentToken`, `wrapper.vaultShares() == vault`), so a wrong-but-nonzero config silently strands or mis-routes fees.
- M-4 (external call safety): `AgentRevenueRouter` swaps rely solely on owner/keeper-supplied `minOut` with no oracle floor; a compromised keeper can pass a trivial `minOut` and lose value to MEV within the (large) `tokenIn` budget. (Noted mitigations already present: safe-address allowlist, exact/reset approvals, overspend guard, `nonReentrant`.)

LOW / INFO
- L-1: Router `_claimProtocolRewards` treats any successful low-level call as a claim (no balance-delta check) and emits a claim event even on a no-op.
- L-2: `setSwapConfig` accepts arbitrary fee tiers; gauge `emergencyWithdraw` lacks `nonReentrant`; WETH can be stranded in the Router if no swap path exists.
- L-3/I-1: `AgentOVaultTaxAdapter` accrual counters are influenceable by any authorized caller (analytics only); jackpot rescue is coupled to reusing the `lotteryManager` role; ETH `receive()` mis-attributes `from`. The `accountedOFTBalance` (G-11) model is otherwise consistent across the OFT distribution branches — the only invariant breakages are the owner `emergencyWithdraw` paths (M-1/M-2).

Note: the repository's Lean project is essentially empty; this task was a Solidity source audit, so the deliverable is the written report (`SECURITY_AUDIT.md`), committed and pushed. External contracts (vault, wrapper, oracle, distributor, lottery manager, OFT tokens, routers) were treated as trusted and are out of scope except where the subsystem's assumptions about them are unsafe.