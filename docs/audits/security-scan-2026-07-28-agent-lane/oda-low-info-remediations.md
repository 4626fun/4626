# Low / Info remediations — wait-work pass (2026-07-28)

Closes code-actionable Low/Info items from ODA-507 and Creator-parity gaps left from ODA-498.
Prior ODA-461 Lows were already closed in `461-low-info-remediations.md` (accepted DESIGN/ops leftovers unchanged).

## Fixed this pass

| ID | Item | Fix |
|----|------|-----|
| ODA-507-5 / 498-2 parity | `flushFees` compose injection | AgentShareOFT requires `composeMsg.length == 0` |
| ODA-507-6 | Hub lottery forward bricks OFT path | try/catch + `RemoteLotteryEntryForwardFailed` (Agent + Creator) |
| ODA-507-7 | Fee-flush OFT dust accounting | `_removeDust` send amount; retain dust in `pendingFees` (Agent + Creator) |
| ODA-507-11 | `renounceOwnership` bricks recovery | Disabled on Agent/Creator ShareOFT + wrappers |
| ODA-507-13 | Raw `.approve` on agentToken | `forceApprove` in ctor + `refreshApproval` |
| ODA-498-4 parity | `unwrap` skips async gate | Agent wrapper calls `_requireSynchronousRedemption` |
| ODA-507 Info | depositFor folds beneficiary dust into operator mint | Both wrappers: dust only when `accountingUser == mintTo` |
| ODA-498 residual | Creator hub lottery peer check | CreatorShareOFT now matches Agent peer-gated forward |

## Still accepted / not code-fixed

| Item | Why |
|------|-----|
| ODA-507-3 hardcoded `remoteProtocolWireAuthority` | Centralization / key ops — not a permissionless bug |
| ODA-507-8 owner burn asymmetry | Trusted-owner design |
| ODA-507-9/10/12/14/15/16 | Rounding / UX / convenience — no fund-loss path |
| View Info (`convertToAssets`, preview msg.sender, flush gas limit) | Docs/UX only |
| ODA-461 / 496 accepted residuals | Already documented (VRF rotation ops, Solana exactly-once, oracle-impl, etc.) |
| Lottery inbound allowlist beyond peers | Base LZ `peers` auth remains; peer check now on Creator forward path |

## Tests

- `test/oda/ODA507_AgentShareWrapperParity.t.sol`
- `test/CreatorOVaultWrapper.t.sol`
- `test/CreatorShareOFT.RemoteFeeFlushCommand.t.sol`
