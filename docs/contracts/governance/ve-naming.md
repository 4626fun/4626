---
title: ve■4626 naming
sidebar_position: 0
---

# ve■4626 naming (canonical)

## Locked lane names (2026-07-11)

| Lane | Canonical | Symbol | Meaning |
|------|-----------|--------|---------|
| Lock | **ve■4626** | — | Locked dual-decay power |
| Desk | **`ve4626Utility`** | — | Claim utilities from lock power |
| Voting | **ve33** | `ve33` | Gauge / fees / bribes weight |
| Lottery mult | **veLottery** | `veLottery` | Personal odds multiplier (opt-in) |

**Choose `veLottery`, not `veLotto`.**

| Candidate | Verdict | Why |
|-----------|---------|-----|
| **veLottery** | **Canonical** | Matches LotteryManager / product “lottery”; already on-chain (`"veLottery"`, `claimVeLottery`, `effectiveVeLotteryOf`); pairs cleanly with **ve33** |
| veLotto | **Rejected** | Nickname / casino-brand feel; abbreviates unevenly vs full product word; would force a rename churn for zero clarity gain |
| veChance / veVote | Rejected earlier | Too easy to confuse: gauge **vote** already directs vault lottery probability |
| Use / Vote / Chance | Rejected earlier | Everyday words, but Vote vs Chance both sounded like “lottery” |

**ve33** stays: short, maps to ve(3,3) gauge voting, and does **not** mean “personal lottery boost.”

### UI copy (keep lanes distinct)

| UI | Claims | Do not say |
|----|--------|------------|
| “Use my ve for **voting**” | `claimVe33` | “lottery chance” for this lane |
| “Use my ve for **personal lottery boost**” | `claimVeLottery` (opt-in) | bare “chance” next to gauge copy |

Integrators store **`ve33Token` / `veLotteryToken`** (or `voteToken` / `lotteryToken` locals) so they never clash with gauge `vote()`.

## ■ rule

| Form | ■ between ve and 4626? | Example |
|------|------------------------|---------|
| **Product lock name** | **Yes** | **ve■4626** |
| Solidity lock | No | `ve4626` |
| Every other module | **No** | `ve4626Utility` — not `ve■4626Utility` |
| Token display strings | Optional | `"ve■4626 33"` / `"ve■4626 Lottery"` |
| Symbols | No | `ve33`, `veLottery` |

Always lowercase **ve** for vote-escrow. Never `VE` / `Ve4626`.

### Frontend / React

**Solidity / on-chain** keeps lowercase `ve4626*` (contracts, interfaces, setters).

**React** must satisfy `react-hooks/rules-of-hooks` and component naming:

| Kind | Canonical form | Example |
|------|----------------|---------|
| Hook file + export | `use` + **PascalCase** body | `useVe4626GaugeVoting.ts` → `useVe4626GaugeVoting` |
| Component file + export | **PascalCase** | `Ve4626GaugeVotingPanel.tsx` → `Ve4626GaugeVotingPanel`, `Ve4626GaugeVotingMini` |

ESLint treats `useve4626…` / `ve4626…Panel` as invalid (hook body must start with an uppercase letter after `use`; components must be PascalCase). Do **not** reintroduce the all-lowercase React forms.

```tsx
import { Ve4626GaugeVotingPanel as GaugeVotingPanel } from '@/components/ve33/Ve4626GaugeVotingPanel'
// <GaugeVotingPanel />
```


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
| `ve4626GaugeVoting` | `vote()` requires utility, then `utility.sync` + `effectiveVe33Of`; no raw-token/raw-ve fallback |
| `ve4626VoterRewardsDistributor` | Fee slice to voters |

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
effectiveBoost = 1 + coverage·(boost - 1)
```

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


## Solidity symbol casing

| Kind | Canonical |
|------|-----------|
| Contract | `ve4626`, `ve4626GaugeVoting`, `ve4626BoostManager`, … |
| Interface | `Ive4626`, `Ive4626GaugeVoting`, … (**not** `IVe4626*`) |
| Setter | `setve4626GaugeVoting`, `setve4626VoterRewardsDistributor`, `setve33Token`, `setveLotteryToken` |
| Event | `ve4626GaugeVotingUpdated`, … |
| Storage (gauge pointer) | `ve4626GaugeVoting` (not `vaultGaugeVoting`) |

Env vars remain SCREAMING_SNAKE (`VITE_VE4626`, `VE4626_GAUGE_VOTING`) — that is not the `Ve4626` product token.
