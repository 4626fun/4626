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
| `ve4626BoostManager` | Curve quoted boost BPS **[10_000, 25_000]** (`working/(0.4·l)`; working ≤ l) |
| `ve4626GaugeVoting` | `vote()` → `utility.sync` + `effectiveVoteOf` (preferred) or `voteToken` / ve fallback |
| `ve4626VoterRewardsDistributor` | Fee slice to voters |

## P1 decay-safety

Raw `voteOf` / `chanceOf` / ERC-20 balances can be **stale** after dual-decay until `sync`.

| Consumer | Must use |
|----------|----------|
| Gauge `vote()` | `utility.sync(user)` then `effectiveVoteOf` |
| Boost share | `utility.effectiveChanceOf` (view haircut; no state write required) |
| UI / integrators | Prefer `previewUtilities` / effective* over raw balances |

## Lottery personal mult (authoritative — Curve-correct)

Curve LiquidityGauge (TOKENLESS = 40%):

```text
lim     = 0.4·l + 0.6·L·(ve/Ve)
working = min(l, lim)                         # cap is l, NOT 2.5·l
quotedBoost = working/(0.4·l) ∈ [1.0, 2.5]   # returned as BPS 10_000–25_000
odds    = baseWinChance × quotedBoost / 10_000
```

| Symbol | Meaning |
|--------|---------|
| `l` | Covered skin = `min(creatorShareUSD, swapUSD)` |
| `L` | Creator ShareOFT **total supply** USD |
| `ve` | `effectiveChanceOf` (veChance) |
| Max 2.5× | when **ve share ≥ LP share** (`r ≥ 1`) |
| Tokenless (covered, no ve) | **1.0×** size-base (neutral — not 0.4× penalty) |
| No covered position | personal off (`baseBoost` 1.0×) |

Do **not** cap working at `2.5·l` (that would be 6.25× vs tokenless — not Curve).

## One-liner

> Lock **■4626 only** into **ve■4626**. Claim **vote** / **chance** via **`ve4626Utility`**. Creator ■ is not a ve lock asset.
