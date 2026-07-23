# ODA Job 481 Triage — CreatorShareOFT + Wrapper

- Track: https://onedollaraudit.com/audit/481
- Report: https://leftclaw.services/result/481.html
- Pin audited: `4626fun/4626@audit/oda-2026-07-22` (`423e0e3`) — **correct scope**
- Reviewed against: current private `contracts/` (2026-07-23)

## Verdict table

| # | Sev (ODA) | Title | Disposition | Action |
|---|-----------|-------|-------------|--------|
| 1 | Medium | Wrapper cooldown defeated via pre-funded recipient | **FALSE / FIXED** | Current `propagateCooldownOnTransfer` max-propagates; no fresh-recipient carve-out |
| 2 | Medium | OFT payload misclassified as lottery-entry → LM inject | **FIXED** | V3 224B lottery payload + ABI padding checks + non-zero `sourceEventId`; LM auth remains defense-in-depth |
| 3 | Medium | Async-redemption gate split across calls | **DESIGN** | Best-effort large-exit gate (same class as vault L-5) |
| 4 | Medium | `mint` owner-exclusion bypass via `setMinter`; remote backing no-op | **DESIGN** | Trusted minter + hub-only backing by design |
| 5 | Medium | Hardcoded `remoteProtocolWireAuthority` | **DESIGN / OPS** | Confirm default is intended protocol wire; rotate/clear on deploy |

## P0 status
**[2] Message-type confusion** — **FIXED**: hardened `_isRemoteLotteryEntryMessage` (exact V3 length, ABI padding, non-zero `sourceEventId`) on Creator+Agent ShareOFT.

## Lows worth tracking
L-2 forwarder branch not try/catch; L-3 flush dust; L-10 renounceOwnership; L-13 dead `flushThreshold`.
