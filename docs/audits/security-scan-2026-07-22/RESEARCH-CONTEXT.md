# 4626 — LeftClaw research context (1-pager)

**Question:** What is the trust/threat model for Creator vault → ShareOFT → lottery → gauges → ve4626 on Base, and what residual risks remain after the ODA 2026-07-22 batch?

**Use this brief as SOURCE OF TRUTH for links + dispositions.** Synthesize architecture and residual risk. **Do not** re-audit full Solidity line-by-line. **Do not** use `github.com/wenakita/CreatorVault` or private `wenakita/4626`.

## Public source pin

| Field | Value |
|-------|-------|
| Repo | https://github.com/4626fun/4626 |
| Tag (current) | `audit/oda-2026-07-28-agent-lane` |
| Commit | `0c47be2` |
| Tree | https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-agent-lane/contracts |
| Mutable branch | `audit/oda-v1200-greenfield-candidate` (same slice) |

**Historical pins (immutable):** July 22 `audit/oda-2026-07-22` @ `423e0e3`; July 23 remediated `audit/oda-2026-07-23-remediated` @ `413f060`.

**Pin freshness:** Current tag includes greenfield remediations through private `main` + **agent-lane** vault/ShareOFT/wrapper/core/gauge (ODA-480-[3] agent cooldown parity). Do not use private `wenakita/4626` or legacy `wenakita/CreatorVault`.

## Scope map (core systems)

Lottery/VRF · CreatorOVault + CoreModule · Creator ShareOFT + Wrapper · **AgentOVault + CoreModule** · **Agent ShareOFT + Wrapper** · DeploymentBatcher · Registry · Charm + Ajna strategies · Creator/Agent gauges · ve4626 + bribes.

## ODA jobs (2026-07-22)

| Job | System | Status | Report |
|-----|--------|--------|--------|
| [460](https://onedollaraudit.com/audit/460) | Lottery probe | complete | [IPFS](https://bafkreih3qksesfnonape4ixkut233rfhzn5zzgxq5tsyxiivdpeh4tu7vi.ipfs.community.bgipfs.com/) |
| [461](https://onedollaraudit.com/audit/461) | Lottery stack | complete | [IPFS](https://bafkreiaq44tl5ir7cla3q65yxaut5tu24cm23vrjupxrgxujdm6mm7mehm.ipfs.community.bgipfs.com/) |
| [462](https://onedollaraudit.com/audit/462) | CreatorOVault | stuck (superseded by 480) | — |
| [463](https://onedollaraudit.com/audit/463) | ShareOFT + Wrapper | stuck (superseded by 481) | — |
| [464](https://onedollaraudit.com/audit/464) | DeploymentBatcher | complete | [IPFS](https://bafkreigiw33hvt2tkqp2sj7fndp7uqytjda7tnkit47xxtcgdtlisgms7y.ipfs.community.bgipfs.com/) |
| [465](https://onedollaraudit.com/audit/465) | Registry | complete | [IPFS](https://bafkreicbfgs3ltksyehyffogrmcgvr645buwege6syx3aoepidxfcgofjy.ipfs.community.bgipfs.com/) |
| [466](https://onedollaraudit.com/audit/466) | Charm + Ajna | complete | [IPFS](https://bafkreigivupyilcb2meseopt7kj4sszrqupw67kl5ereq55ldmb5visrty.ipfs.community.bgipfs.com/) |
| [467](https://onedollaraudit.com/audit/467) | CreatorGauge | complete | [IPFS](https://bafkreihh7hr73mzhe7uu664wpwggxbp46k4rkvgon5xxlah47eyv2ddpem.ipfs.community.bgipfs.com/) |
| [468](https://onedollaraudit.com/audit/468) | ve4626 + bribes | complete | [IPFS](https://bafkreia3hbdlzupry7k7mnresq4gmlqp77i5sxhgniws2fzr42f55ktsya.ipfs.community.bgipfs.com/) |
| [480](https://onedollaraudit.com/audit/480) | CreatorOVault **resubmit** | **complete** | [HTML](https://leftclaw.services/result/480.html) |
| [481](https://onedollaraudit.com/audit/481) | ShareOFT/Wrapper **resubmit** | **complete** | [HTML](https://leftclaw.services/result/481.html) |

## Disposition summary (operator triage)

### FIXED (high-signal)
- **480-1**: impairment bond refund soft-fail (no liveness brick on reverting challenger).
- **480-3**: third-party `deposit`/`mint` to victim no longer refreshes withdraw cooldown.
- **481-2**: ShareOFT lottery-entry classifier hardened (V3 224B + padding + nonzero sourceEventId).
- Lottery: `return(0,0)` nonReentrant brick; pause-before-grace; replay namespacing; payout isolation; pricing/decimals; VRF/AMOE hardening; renounce disabled.
- Gauge: bridged ShareOFT unwrap DoS → jackpot fold; TWAP floor; fee-tier whitelist; lotteryManager revoke-to-0.
- Batcher: first-writer registry squat guard; codeId bytecode hash pin; Phase3 `vault.asset()` match; deposit bounds by decimals.
- Registry: canonical wallet proof; LZ live overlay; creator clear wallet; factory codehash at call.
- Charm/Ajna: stale-oracle+debt fail-closed; vault/pool validation; bankrupt LP→0; adapter maxWithdraw cap.
- ve/bribes: emergency-reset freeze window; whitelist/vault/boost timelocks; renounce/permit/CEI guards.

### DESIGN / SKIP (do not treat as open Critical)
- Registry multi-factory first-writer bindings (trust model).
- Charm spot NAV / rebalance sandwich (CLM residual).
- 464 finalize redesign (F-03/F-04) deferred.
- 466 spot Charm withdraw mins (documented SKIP).
- 465-8 cross-namespace OFT uniqueness skipped (EIP-170).
- 466-10 oracle rewire: owner-gated instant (24h timelock dropped for size).
- 468-M3 trust-model SKIP.

## Requested deliverable outline
1. Executive summary (≤10 bullets)
2. Architecture / value flow (vault ↔ ShareOFT ↔ lottery ↔ gauges ↔ ve)
3. Trust boundaries (owner, factories, oracles, LZ, VRF, keepers)
4. ODA findings map (cite job IDs; 480/481 P0s FIXED in private tree)
5. Residual risks after FIXED items
6. Launch-readiness recommendations (ops + pin republish)

*Updated for LeftClaw research · 2026-07-28 (agent-lane pin)*

## LeftClaw research job

| Field | Value |
|-------|-------|
| Job | [482](https://leftclaw.services/jobs/482) |
| Commissioned | 2026-07-23 |
| Price | $3 USDC (x402) |
| Payer | `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` |
| Tracking file | `leftclaw-research-job.json` |
| Status | **Stale / unindexed** as of 2026-07-28 — commissioned against July 22 pin `423e0e3` before agent-lane publish. Do not wait on 482. Re-commission a new research job against tag `audit/oda-2026-07-28-agent-lane` when needed. |

