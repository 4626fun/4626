# ODA Job 480 Triage — CreatorOVault + CoreModule

- Track: https://onedollaraudit.com/audit/480
- Report: https://leftclaw.services/result/480.html
- Pin audited: `4626fun/4626@audit/oda-2026-07-22` (`423e0e3`) — **correct scope**
- Reviewed against: current private `contracts/` (2026-07-23)

## Verdict table

| # | Sev (ODA) | Title | Disposition | Action |
|---|-----------|-------|-------------|--------|
| 1 | High | Stale-impairment clear bricked by reverting bond refund | **FIXED** | Bond refund fail emits `ImpairmentChallengeBondRefundFailed` and retains ETH (no revert) |
| 2 | High | Impairment claim double-claim via transfers | **FALSE** (current) | `OVaultImpairmentClaims` is non-transferable (`ClaimTransferDisabled`) |
| 3 | High | Third-party deposit→receiver resets withdraw cooldown | **FIXED** | CoreModule `deposit`/`mint` refresh `lastDepositBlock` only when `receiver == msg.sender` |
| 4 | Medium | Management defeats impairment challenge/bond | **DESIGN** | Privileged trust model |
| 5 | Medium | CREATOR_COIN pause/blacklist/burn | **DESIGN** | Underlying-token trust |
| 6 | Medium | `setModulesOnce` identity check cosmetic | **DESIGN** | Owner one-shot; catastrophic if malicious |
| 7 | Medium | `paused` does not gate `claimQueuedWithdrawal` | **PARTIAL / likely DESIGN** | Intentional exit during pause? Confirm product intent |
| 8 | Medium | Shutdown irreversible via `impairmentGuardian` | **DESIGN** | Role trust |

## FP called out by ODA (agree)
“Redeem burns full shares but pays capped assets” — **false positive**; not a reachable invariant break.

## P0 status
1. **Bond refund reverts** — **FIXED**: `_settleImpairmentChallengeBond` uses soft-fail refund + `ImpairmentChallengeBondRefundFailed`.
2. **Cooldown grief** — **FIXED**: self-deposit/mint only; covered by `test/oda/ODA480_481_P0.t.sol` + WithdrawDelay suite.

## Lows (skim)
L-1 `maxDeposit` overflow under max supply; L-2 live vs module `maxWithdraw` divergence; L-5 large-withdraw split via transfers — document or harden as product requires.
