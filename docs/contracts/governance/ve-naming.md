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
| Token display strings | Optional | `"ve■4626 Vote"` |
| Symbols | No | `veVote`, `veChance` |

Always lowercase **ve** for vote-escrow. Never `VE` / `Ve4626`.

## Lock asset invariant (critical)

| Token | Lockable in `ve4626`? |
|-------|------------------------|
| **■4626** / protocol wrapped ShareOFT (`WRAPPED_SHARE_OFT`, $4626 stack) | **Yes** — sole `wrappedShareOFT` |
| Creator vault ■ (e.g. ■AKITA, per-vault ShareOFT) | **No** |
| Creator Coin | **No** |

`lock(token, …)` reverts `InvalidToken` unless `token == wrappedShareOFT`.

Creators do **not** get ve■4626 or veChance by holding their own vault ShareOFT. They buy/earn **■4626** and lock it like anyone else.

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
    ├── vote   (veVote)   → ve4626GaugeVoting (+ fees/bribes)
    └── chance (veChance) → ve4626BoostManager (lottery mult, opt-in)
```

| You do | Name |
|--------|------|
| Lock **■4626 only** | **ve■4626** |
| Claim utilities | **`ve4626Utility`** |
| Voting utility | **vote** / **veVote** |
| Lottery mult utility | **chance** / **veChance** |
| Shrink utilities after decay | **`sync(user)`** (chance burned first) |
| Read decay-safe balances | **`effectiveVoteOf` / `effectiveChanceOf`** (or `previewUtilities`) |

## Contracts

| Contract | Role |
|----------|------|
| `ve4626` | Lock **■4626** + dual-decay total power |
| `ve4626Utility` | claimVote / claimChance / forfeit / sync / effective* |
| `ve4626UtilityToken` | Non-transferable ERC-20 (not B20) |
| `ve4626BoostManager` | `calculateBoostForPosition`: `working/l` ∈ **[0.4, 1.0]**; ve=`effectiveChance`, L=Share supply USD |
| `ve4626GaugeVoting` | `vote()` → `utility.sync` + `effectiveVoteOf` (preferred) or `voteToken` / ve fallback |
| `ve4626VoterRewardsDistributor` | Fee slice to voters |

## P1 decay-safety

Raw `voteOf` / `chanceOf` / ERC-20 balances can be **stale** after dual-decay until `sync`.

| Consumer | Must use |
|----------|----------|
| Gauge `vote()` | `utility.sync(user)` then `effectiveVoteOf` |
| Boost share | `utility.effectiveChanceOf` (view haircut; no state write required) |
| UI / integrators | Prefer `previewUtilities` / effective* over raw balances |

## Lottery personal mult (authoritative)

```text
working = min(0.4·l + 0.6·L·(ve/Ve), 1.0·l)
boost   = working / l ∈ [0.4, 1.0]
```

| Symbol | Meaning |
|--------|---------|
| `l` | Covered skin = `min(creatorShareUSD, swapUSD)` |
| `L` | Creator ShareOFT **total supply** USD |
| `ve` | `effectiveChanceOf` (veChance) |
| Full (1.0) | ve share ≥ LP share (`ve/Ve ≥ l/L`) |
| Tokenless (0.4) | No veChance on a covered trade |

Product line “up to **2.5×** boost” = **2.5× the tokenless rate** (`0.4 × 2.5 = 1.0`), **not** Curve gauge’s `2.5·l` deposit cap. Same 40/60 split as gauges; **cap is full position weight (1.0)**.

No covered position → personal layer **off** (base trade odds unchanged).

## One-liner

> Lock **■4626 only** into **ve■4626**. Claim **vote** / **chance** via **`ve4626Utility`**. Creator ■ is not a ve lock asset.
