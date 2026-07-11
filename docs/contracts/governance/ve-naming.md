---
title: ve■4626 naming
sidebar_position: 0
---

# ve■4626 naming (canonical)

## ■ rule

| Form | ■ between ve and 4626? | Example |
|------|------------------------|---------|
| **Product lock name** | **Yes** | **ve■4626** |
| Solidity lock | No | `ve4626` |
| Every other module | **No** | `ve4626Utility` — not `ve■4626Utility` |
| Token display strings | Optional | `"ve■4626 33"` / `"ve■4626 Lottery"` |
| Symbols | No | `ve33`, `veLottery` |

Always lowercase **ve** for vote-escrow. Never `VE` / `Ve4626`.

## Lock asset invariant (critical)

| Token | Lockable in `ve4626`? |
|-------|------------------------|
| **■4626** / protocol wrapped ShareOFT (`WRAPPED_SHARE_OFT`, $4626 stack) | **Yes** — sole `wrappedShareOFT` |
| Creator vault ■ (e.g. ■AKITA, per-vault ShareOFT) | **No** |
| Creator Coin | **No** |

`lock(token, …)` reverts `InvalidToken` unless `token == wrappedShareOFT`.

Creators do **not** get ve■4626 or veLottery by holding their own vault ShareOFT. They buy/earn **■4626** and lock it like anyone else.

**Coverage** for lottery (share balance of the *traded* creator) is a **separate** path from the ve lock asset.

## Model

```
■4626 only
    │ lock
    ▼
ve■4626          product
ve4626           contract (dual-decay power)
    │ claim utilities
    ▼
ve4626Utility
    ├── ve33      → ve4626GaugeVoting (+ fees/bribes)
    └── veLottery → ve4626BoostManager (lottery mult, opt-in)
```

| You do | Name |
|--------|------|
| Lock **■4626 only** | **ve■4626** |
| Claim utilities | **`ve4626Utility`** |
| Voting utility | **ve33** |
| Lottery mult utility | **veLottery** |
| Shrink utilities after decay | **`sync(user)`** (veLottery burned first) |
| Read decay-safe balances | **`effectiveVe33Of` / `effectiveVeLotteryOf`** (or `previewUtilities`) |

## Contracts

| Contract | Role |
|----------|------|
| `ve4626` | Lock **■4626** + dual-decay total power |
| `ve4626Utility` | claimVe33 / claimVeLottery / forfeit / sync / effective* |
| `ve4626UtilityToken` | Non-transferable ERC-20 (not B20) |
| `ve4626BoostManager` | `calculateBoostForPosition`: `working/(0.4·l)` ∈ **[1.0, 2.5]**; ve=`effectiveVeLotteryOf`, Ve=live total ve4626 power |
| `ve4626GaugeVoting` | `vote()` → `utility.sync` + `effectiveVe33Of` (preferred) or `ve33Token` / ve fallback || `ve4626VoterRewardsDistributor` | Fee slice to voters |

## P1 decay-safety

Raw `ve33Of` / `veLotteryOf` / ERC-20 balances can be **stale** after dual-decay until `sync`.

| Consumer | Must use |
|----------|----------|
| Gauge `vote()` | `utility.sync(user)` then `effectiveVe33Of` |
| Boost share | `utility.effectiveVeLotteryOf` (view haircut; no state write required) |
| UI / integrators | Prefer `previewUtilities` / effective* over raw balances |

## Lottery personal mult (authoritative — Curve-correct)

Curve LiquidityGauge (TOKENLESS = 40%):

```text
working = min(0.4·l + 0.6·L·(ve/Ve), 1.0·l)
boost   = working / (0.4·l) ∈ [1.0, 2.5]
effectiveBoost = 1 + coverage·(boost - 1)```

| Symbol | Meaning |
|--------|---------|
| `l` | Covered skin = `min(creatorShareUSD, swapUSD)` |
| `L` | Creator ShareOFT **total supply** USD |
| `ve` | `effectiveVeLotteryOf` |
| `Ve` | Live `ve4626.getTotalVotingPower()` |
| Full (2.5) | ve share ≥ position share (`ve/Ve ≥ l/L`) |
| Tokenless (1.0) | No veLottery on a covered trade |
| `coverage` | `l / swapUSD`; only covered trade value receives uplift |

Curve caps working balance at `l`. The advertised **2.5×** is the full working balance divided by the 0.4 tokenless baseline; it is not a `2.5·l` working-balance cap.

No covered position → personal layer **off** (base trade odds unchanged).
## One-liner

> Lock **■4626 only** into **ve■4626**. Claim **ve33** / **veLottery** via **`ve4626Utility`**. Creator ■ is not a ve lock asset.
