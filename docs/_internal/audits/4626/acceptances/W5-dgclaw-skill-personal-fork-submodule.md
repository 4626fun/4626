# Acceptance: `dgclaw-skill` personal-fork submodule

- Status: accepted risk / deferred remediation
- Scope: `.gitmodules` entry for `dgclaw-skill`
- Current URL: `https://github.com/wenakita/dgclaw-skill.git`

## Decision

Leave the `dgclaw-skill` submodule URL unchanged for this Wave W5 CI/supply-chain remediation pass.

## Rationale

No verified upstream replacement URL was available during remediation. Retargeting the submodule network-wide without confirming the canonical upstream and validating bootstrap/build behavior could break fetches or silently change consumed code. The smallest safe diff is to preserve the current source and record the risk explicitly.

## Follow-up

1. Identify and verify the canonical upstream repository for `dgclaw-skill`.
2. Validate that the upstream contents and expected commit history match current build expectations.
3. Retarget the submodule in a dedicated change once compatibility and ownership are confirmed.
