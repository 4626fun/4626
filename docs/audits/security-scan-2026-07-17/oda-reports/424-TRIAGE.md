# ODA job 424 — CreatorGaugeController triage (correct scope)

**Status:** complete · **Track:** https://onedollaraudit.com/audit/424  
**Source:** usable (targeted `CreatorGaugeController.sol`; not CreatorVault-scoped).

| ID | Sev | One-liner | Disposition |
|----|-----|-----------|-------------|
| **M-1** | Medium | Fallback minOut mixes WETH input units with creatorCoin output | **Fixed** — fail closed when oracle unavailable; nonzero `setFallbackMinOutputBps` reverts (`FallbackMinOutputDisabled`). Agent already fail-closed; setter aligned. |
| **M-2** | Medium | Instant `setLotteryManager` → `payJackpot` drains jackpot past emergency timelock | **Fixed** — Creator matches Agent: first set immediate; reassignment 1-day queue + `executeLotteryManagerUpdate()`. |
| **M-3** | Medium | `sqrtPriceLimitX96` from average price + exact-spend → griefable DoS | **Fixed** (Creator + Agent) — pass `sqrtPriceLimitX96 = 0`; rely on oracle `amountOutMinimum`. |
| **L-1** | Low | Emergency withdraw unguarded for creatorCoin/vaultShares | Open / ops — balances usually transient |
| **L-2** | Low | Un-swept bridged ShareOFT withdrawable when buckets empty | Open — anyone can `receiveBridgedFees` first |
| **L-3** | Low | Dust ETH via `receive()` blocks WETH emergency withdraw | **Fixed** — withdraw allowed up to `balance - pendingWETHFees` |
| **L-4** | Low | Shared `lastDistribution` couples WETH/OFT timers | Open — follow-up |
| **L-5–L-7, L-9, L-11–L-12** | Low | Auto-dist deps, threshold units, Ownable2Step, timelock cluster, TWAP/sanity | Open / backlog |
| **L-8** | Low | `renounceOwnership` bricks admin | **Fixed** — override reverts `OwnershipRenounceDisabled` |
| **L-10** | Low | `setOracle(0)` allowed | **Fixed** — zero rejected; disable via `setOracleConfig(_, false)` |
| **I-1…I-3** | Info | Dead guards / unused deps | No action |

## Sibling job 425

ve4626 suite — **source unavailable** (private repo, no litterbox in job description). Prefer v2 litterbox job **433** when it completes.
