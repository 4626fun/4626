# W2 CH-030 Stale CSW Rebind

Date: 2026-07-22
Status: accept-risk

## Summary
- The current wallet sync path already follows tombstone pointers (`merged_into_profile_id`) and gates persisted EVM wallets against the live Privy classification before reasserting them.
- I did not find a narrowly scoped unlink-tombstone remediation in the confirmed-fix files for this wave that could be extended safely without pulling broader wallet/account-linking behavior into scope.
- Because this wave is limited to confirmed minimal diffs in paymaster, permit, and prepared-call paths, the residual stale-CSW rebind concern remains documented here rather than partially patched in a higher-risk auth flow.

## Mitigation
- Keep the existing tombstone-aware wallet sync guards in place.
- Revisit CH-030 as a dedicated wallet-sync/auth hardening task with focused tests around unlink, merge, and canonical-CSW reassignment behavior.
