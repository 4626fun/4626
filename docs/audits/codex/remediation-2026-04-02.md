---
title: Codex Remediation (2026-04-02)
sidebar_position: 3
---

# Codex Remediation (2026-04-02 Export)

Final remediation status for `docs/audits/codex/codex-security-findings-2026-04-02T04-05-04.818Z.csv`.

## Summary

- Total findings: **19**
- Fixed: **18**
- Already mitigated (no functional rollback): **1**
- Needs follow-up: **0** for this plan scope

## Per-Finding Disposition

| Row | Severity | Title | Disposition |
|---:|---|---|---|
| 1 | medium | New DB migration scripts disable TLS cert validation by default | fixed |
| 2 | medium | Postgres init retries with TLS verification disabled | fixed |
| 3 | medium | Rate-limit revert can block LayerZero VRF inbound lane | fixed |
| 4 | medium | Cursor install script executes remote Foundry installer unsafely | fixed |
| 5 | medium | Solana transfer hook allows forged lottery entries | already mitigated (kept current mitigation as-is per plan scope) |
| 6 | medium | CSW link points can be farmed with unlimited addresses | fixed |
| 7 | low | Public authStatus endpoint leaks masked Zora server API key | fixed |
| 8 | low | Browser defaults skip Zora migration trust checks | fixed |
| 9 | low | Wallet-gated AI prompts no longer enforced | fixed |
| 10 | low | Unauthenticated Uniswap Trading API proxy exposes server key | fixed |
| 11 | low | AdminOps accepts insecure HTTP agentURI values | fixed |
| 12 | low | Keepr join lock not enforced allows joins during lock | fixed |
| 13 | informational | XMTP init blocked when OPFS check fails | fixed |
| 14 | informational | BigInt buffer conversion truncates most-significant bytes | fixed |
| 15 | informational | Mobile chat overlay ignores disconnect state | fixed |
| 16 | informational | Direct executeBatch fallback treats reverted tx as success | fixed |
| 17 | informational | Root entrypoint chown enables symlink-based privilege escalation | fixed |
| 18 | informational | Preflight simulation blocks batch deploys on Unauthorized | fixed |
| 19 | informational | Deploy flow regression for multi-owner Coinbase Smart Wallets | fixed |

## Verification Snapshot

- `forge test --match-path test/vault/CreatorVRFConsumerV2_5.RelayFunding.t.sol --match-test test_rateLimitIgnoresExcessRemoteRequestsWithoutRevert`
- `pnpm lint` (frontend)
- `pnpm typecheck` (frontend)
- `pnpm vitest run` targeted suites for touched API/AA/AI/migration/waitlist/keepr modules
- `node` smoke check for bigint-buffer width behavior
- `cargo test allowlisted_buy` in `programs/creator-share-hook`

All commands above passed in this remediation pass.
