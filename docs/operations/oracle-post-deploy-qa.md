---
title: Oracle Post-Deploy QA
sidebar_position: 20
---

# Oracle Post-Deploy QA

Quick operator runbook for validating a deployed `CreatorOracle` without changing onchain state.

Primary tool: `script/OraclePostDeployQa.s.sol`

## Purpose

This script provides a Silo-style post-deploy QA pass for our oracle lane:

- confirms config shape (feed + V3/V4 setup),
- confirms registry/gauge/CCA wiring coherence,
- prints live/stored oracle price state,
- runs V4/V3 TWAP sanity checks and deltas.

It is **read-only** and safe to run against live RPC endpoints.

## Run

Required env:

- `CREATOR_TOKEN`

Optional env:

- `ORACLE` (override oracle address; otherwise resolved from registry)
- `REGISTRY` (defaults to Base registry)
- `GAUGE` (optional wiring check)
- `CCA` (optional wiring check)
- `TWAP_DURATION` (default `1800`)
- `V3_TWAP_DURATION` (default `1800`)
- `STRICT` (`1` to fail on key health checks)

Example:

```bash
CREATOR_TOKEN=0x... \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url $BASE_RPC_URL
```

Strict mode:

```bash
CREATOR_TOKEN=0x... STRICT=1 \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url $BASE_RPC_URL
```

## Command Cookbook

### Base mainnet (default registry resolution)

```bash
CREATOR_TOKEN=0x<creator_token> \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url $BASE_RPC_URL
```

### Base mainnet (strict gate + explicit dependencies)

```bash
CREATOR_TOKEN=0x<creator_token> \
REGISTRY=0x<registry> \
ORACLE=0x<oracle> \
GAUGE=0x<gauge> \
CCA=0x<cca_strategy> \
STRICT=1 \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url $BASE_RPC_URL
```

### Base mainnet (custom TWAP windows)

```bash
CREATOR_TOKEN=0x<creator_token> \
TWAP_DURATION=3600 \
V3_TWAP_DURATION=3600 \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url $BASE_RPC_URL
```

### Local Anvil fork of Base

Start a fork (example):

```bash
anvil --fork-url $BASE_RPC_URL --chain-id 8453
```

Then run QA against the fork:

```bash
CREATOR_TOKEN=0x<creator_token> \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url http://127.0.0.1:8545
```

### CI/operator fail-fast check

Use strict mode so the command exits non-zero when core expectations fail:

```bash
CREATOR_TOKEN=0x<creator_token> STRICT=1 \
forge script script/OraclePostDeployQa.s.sol:OraclePostDeployQa \
  --rpc-url $BASE_RPC_URL
```

## Expected Healthy Output

Healthy runs should generally show:

- `registryMatchesOracle: true`
- `gaugeMatchesOracle: true` (when gauge is provided/resolved)
- `ccaMatchesOracle: true` (when CCA is provided)
- `chainlinkFeed: <non-zero address>`
- at least one of:
  - `v4PoolConfigured: true`, or
  - `v3PoolConfigured: true`
- `creatorUsd1e18: > 0`
- `isPriceFresh: true`
- `creatorPerEth1e18 (V4 TWAP): > 0` when V4 is configured
- `creatorUsd1e18 (V3 TWAP): > 0` when V3 is configured
- delta bps values (`deltaBps(...)`) within expected operational range for that token.

## Quick Triage

### `oracle not found` / zero oracle address

- Confirm `CREATOR_TOKEN` is correct.
- Check registry mapping:
  - `getOracleForToken(CREATOR_TOKEN)`
- If mapping is stale after deploy, fix registry registration before retry.

### `registryMatchesOracle: false`

- Registry points to an unexpected oracle for that token.
- Verify deployment outputs and the token->oracle registration transaction.
- Treat as a release blocker for pricing-dependent flows.

### `gaugeMatchesOracle: false`

- Gauge slippage protection may reference the wrong oracle.
- Re-check gauge setup call path and `setOracle(...)` history.

### `ccaMatchesOracle: false`

- Launch pricing path may be wired to a different oracle.
- Re-check CCA `setOracleConfig(...)` wiring.

### `chainlinkFeed` is zero

- ETH/USD leg is disabled for V4-chainlink-derived updates.
- Set a valid feed before relying on `updateCreatorPriceFromTWAP`.

### Both `v4PoolConfigured` and `v3PoolConfigured` are false

- Oracle has no active market price source configured.
- Configure at least one pool source before production use.

### `creatorUsd1e18: 0` or `isPriceFresh: false`

- Price not initialized, stale, or updates not flowing.
- Check:
  - bootstrap/init state,
  - updater authorization/cadence,
  - pool observation path health.

### V4 TWAP value is zero (`creatorPerEth1e18: 0`)

- Usually indicates insufficient/invalid observations or V4 path issues.
- Verify V4 pool setup and observation recording activity.

### V3 TWAP value is zero (`creatorUsd1e18 (V3 TWAP): 0`)

- Usually indicates V3 pool config mismatch, no observation depth, or quote failure.
- Confirm pool/token pairing and TWAP duration.

### Large delta bps between stored price and implied TWAP

- Investigate pool volatility/manipulation, stale stored state, or feed drift.
- Compare across multiple TWAP windows before actioning.
- If persistent and unexplained, pause dependent operations and escalate.

## Operational Notes

- This script is **diagnostic only**; it does not mutate state.
- `STRICT=1` is useful in CI/operator gates where fail-fast behavior is preferred.
- Use the same RPC/network context as production when validating production deploys.
