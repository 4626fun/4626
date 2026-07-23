# Codex Remediation (2026-07-22 Export)

Final remediation status for dual Codex exports in this directory.

## Summary

| Metric | Count |
|---|---:|
| Clusters (deduped) | 672 |
| Critical / High | 105 |
| Medium / Low / Info | 567 |
| CH confirm-fix | 88 |
| CH already-mitigated | 10 |
| CH accept-risk | 7 |
| CH false-positive | 0 |
| CH defer | 0 |
| CH pending | 0 |
| MLI defer (default) | 557 |
| MLI already-mitigated | 7 |

## Waves

| Wave | Status |
|---|---|
| W0 Lottery / VRF | complete |
| W1 Waitlist / Privy | complete (proxy cookie = accept-risk) |
| W2 Paymaster / CSW / swap | complete (swap allowlist + stale CSW = accept-risk) |
| W3 Hermit / AlfaClub | complete (dgclaw submodule = accept-risk) |
| W4 Deploy / registry / Ajna | complete |
| W5 CI / supply-chain | complete |
| W6 Remaining highs | complete (strategy caps = accept-risk) |
| MLI triage | complete (defer default; revisit on rescan) |

## Key acceptances

See `docs/_internal/audits/4626/acceptances/` (`C-01`, `C-02`, `W1-*`, `W2-*`, `W3-P0-*`, `W4-*`, `W5-*`, `wave-w6-*`).

## Verification snapshot

- `forge test --match-path test/LotteryManager4626.AdminModuleCallAuth.t.sol` (exit 0)
- `forge test --match-path test/ChainlinkVRFAdapter.RequesterAuth.t.sol`
- Scoped forge suites for W4 / OVaultLPManager seed guard
- Targeted vitest for waitlist, hermit/alfaclub, paymaster, amoe, weights
- `pnpm -C frontend validate:wallet` (exit 0)
