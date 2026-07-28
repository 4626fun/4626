# ODA-507 remediations — AgentShareOFT + AgentOVaultWrapper

Source job: [507](https://onedollaraudit.com/audit/507) against public pin `audit/oda-2026-07-28-agent-lane` (`0c47be2`).
Report: [oda-reports/507-report.md](./oda-reports/507-report.md).

## Closed this pass (Creator-lane parity)

| ID | Severity | Fix |
|----|----------|-----|
| ODA-507-1 | Medium | Port Creator M-08 hot-balance cooldown (`cooldownShareOFTBalance`, amount-gated `_requireWrapperCooldown`, hot-unit `propagateCooldownOnTransfer`) to `AgentOVaultWrapper` |
| ODA-507-2 | Medium | Port ODA-498-3 `accountingUser == burnFrom` dust guard in `_unwrapInternal` |
| ODA-507-4 | Low | Port ODA-428-F1 winner-callback peer parity (`hubLotteryPeer \|\| peers[hubEid]`) to `AgentShareOFT` |

Tests: `test/oda/ODA507_AgentShareWrapperParity.t.sol`.

## Deferred / accepted for now

| ID | Notes |
|----|-------|
| ODA-507-3 | Hardcoded `remoteProtocolWireAuthority` — key-compromise / centralization; not a Creator missing-parity code delta in this pass |
| ODA-507-8/9/10/12/14/15/16 + view Info | Design/UX — see [oda-low-info-remediations.md](./oda-low-info-remediations.md) |

Low/Info code items (5/6/7/11/13 + deposit dust + unwrap async) closed in the wait-work pass — [oda-low-info-remediations.md](./oda-low-info-remediations.md).

## Constraints

- Pin ≠ redeploy. Live Base agent CREATE2 vaults still outstanding (paid canaries).
- Do not re-pay job 507 to re-check.
