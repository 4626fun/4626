---
title: Roadmap
sidebar_position: 11
---

# Roadmap

This page tracks staged and deferred surfaces so rollout intent stays explicit.

## UniV4 Strategy Rollout Posture

UniV4 LP strategy modules (`contracts/vault/strategies/univ4/*`) are maintained and tested in-repo, but are currently treated as a staged feature surface.

- Default posture: deferred / disabled-by-default in production wiring until explicitly enabled per deployment.
- Enablement requirements:
  - explicit config review for PoolManager / PositionManager / Permit2 / hook addresses
  - approval-rotation controls and event monitoring (`ApprovalsReconfigured`)
  - pre-deploy and post-deploy validation runbook checks
- Security reporting: findings against deferred code are still in scope; practical severity is assessed based on whether the affected path is active in current deployments.

## Notes

- Disclosure workflow and safe harbor remain in the canonical [Security Policy](https://github.com/wenakita/4626/blob/main/SECURITY.md).
