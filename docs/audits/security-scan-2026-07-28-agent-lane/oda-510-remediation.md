# ODA-510 remediation — Lottery stack

**Track:** https://onedollaraudit.com/audit/510  
**Report:** [oda-reports/510-report.md](./oda-reports/510-report.md)  
**Pin audited:** `audit/oda-2026-07-28-agent-lane` @ `0c47be2` (pin-ahead-of-live for LM/VRF)

## Fixed

| ID | Sev | Fix |
|----|-----|-----|
| ODA-510-1 | High | Multi-vault `payoutLocalJackpotInner` applies `_fairMaxJackpotShares` per vault (parity with single-vault) |
| ODA-510-2 | High | `_processWin` no longer swallows payout reverts — VRFConsumer `retryLocalCallback` can retry with full gas |
| ODA-510-3 | Medium | Cold-lane EV-cap fallback requires oracle staleness (no raw live price) |
| ODA-510-4 | Medium | `setSingleVaultJackpotOnly` is 2-day queue; execute via `adminModuleCall(executeSingleVault…)` |
| ODA-510-5 | Medium | V3 remote digest consumed only when `entryId > 0` (transient sponsorship skips retryable) |
| ODA-510-8 | Low | `LotteryManager4626AdminModule.renounceOwnership` disabled (blocks `adminModuleCall` renounce) |
| ODA-510-13 | Low | `VRFConsumer4626._lzReceive` emit-and-return on unsupported chain / invalid peer |
| ODA-510-15 | Low | `JACKPOT_PAYOUT_CALL_GAS` raised 300k → 500k |
| ODA-510-16 | Low | ShareOFT `staticcall` returndata must be exactly 32 bytes |
| ODA-510-19 | Low | `_fairMaxJackpotShares` uses `PricingLib.fairMaxJackpotShares` (FullMath) |

## Accepted / DESIGN / ops (not code-fixed this pass)

| ID | Sev | Why |
|----|-----|-----|
| ODA-510-6 | Medium | Per-lane oracle staleness mapping deferred — EIP-170 main budget; global knobs remain |
| ODA-510-7 | Low | Instant odds params vs 24h boost timelock — centralization / product |
| ODA-510-9 | Low | Single-step Ownable — ops key hygiene; router already two-step |
| ODA-510-10 | Low | Bootstrap re-open via zero — accepted sticky pattern elsewhere; monitor |
| ODA-510-11 | Low | Pause settlement owner-only — intentional liveness control |
| ODA-510-12 | Low | Forwarder trusts srcEid/originSender — documented authorized-forwarder trust |
| ODA-510-14 | Low | Dirty-bit abi.decode — unordered LZ; fail-closed on bad payload preferred |
| ODA-510-17 | Low | Deferred VRF array shift — caller-paid gas; FIFO required |
| ODA-510-18 | Low | uint128 EV pack — `MAX_SWAP_USD` / pricing caps make overflow unreachable |
| ODA-510-20–25 | Low | Decimals signal / price circuit / mean aggregate / integrator swap / share peg / legacy payload — DESIGN/ops or out-of-scope |

No Critical findings in ODA-510.

## Tests

- `test/LotteryManager4626.Oda510Remediation.t.sol`
- `test/LotteryManager4626.OdaMediumRemediation.t.sol` (510-2 / 510-8)
- `test/audit/Audit20260708.P2.t.sol` (510-4)
- `test/LotteryManager4626.SolanaLzEntryAuth.t.sol` (510-5)
- `test/LotteryManager4626.Hardening.t.sol` (EIP-170)

## Size

Main `LotteryManager4626` kept under EIP-170 with ≥150B soft headroom after remediation.
