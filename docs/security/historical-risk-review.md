---
title: Historical Risk Review Checklist
sidebar_position: 6
---

# Historical Risk Review Checklist

Quarterly checklist for risks that appear from long-lived systems, not just current code snapshots.

## Cadence

- Frequency: quarterly
- Owner: security/on-call maintainer
- Output artifact: dated note under `docs/audits/` or `docs/operations/` with findings and actions

## Checklist

### 1) Deprecated env keys and aliases

- Run canonical env guards and startup doctor checks.
- Verify no retired env aliases are still accepted silently.
- Confirm kill switches and trust-zone envs are still wired and documented.

### 2) Historical mutation residue

- Review recent deploy/session and keeper action history for repeated retries, orphan stages, or stale queues.
- Verify “read-only” status routes still have no side effects.
- Confirm action-type to trust-zone mapping still matches live action catalog.

### 3) On-chain authority drift

- Verify current owner/delegation assumptions for batcher, helper, create2 deployer, and strategy controllers.
- Re-run readiness checks for phase helper authorization and registry authorization.
- Validate canonical addresses in defaults/env match documented production targets.

### 4) Schema and data drift

- Run `pnpm -C frontend guard:schema`.
- Confirm no new raw DDL appeared in runtime paths.
- Spot-check merge/collision-sensitive tables for invariants (`profiles`, aliases, wallet links).

### 5) Operational runbook drift

- Confirm runbooks still match command names, env keys, and active endpoints.
- Verify rollback instructions are still executable.
- Ensure every high-risk runbook has explicit `Preflight`, `Execute`, `Verify`, `Rollback` sections.

## Severity rubric

- **High:** can cause unauthorized writes, fund movement, or identity/account corruption.
- **Medium:** can cause prolonged downtime, stuck queues, or silent data divergence.
- **Low:** documentation/process drift with no immediate production blast radius.

## Exit criteria

- All High findings have an immediate mitigation or kill-switch path.
- All Medium findings have scheduled fixes and owners.
- Updated artifact is linked from `docs/audits/README.md`.
