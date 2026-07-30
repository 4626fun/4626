# Royco Dawn comparison (learn-only)

Tier 2 design memo. Load when evaluating risk tranching, senior/junior markets, Royco Dawn, YDM/utilization curves, or whether to adopt Dawn-like mechanics on Creator/Agent OVault.

**This pass is docs only.** No senior/junior contracts, no Dawn factory fork, no listing OVault on Dawn, no strategy that deposits into Dawn senior.

Sources: [roycoprotocol/royco-dawn](https://github.com/roycoprotocol/royco-dawn), [Royco Dawn docs](https://royco.gitbook.io/royco-dawn).

---

## What Dawn is (and is not)

Royco Dawn is a non-custodial **risk-tranching** protocol. It takes any priced yield source (lending market, staking deposit, tokenized RWA, ERC-4626 vault, etc.) and splits it into two ERC-4626-style deposit classes:

| Tranche | Role |
|---------|------|
| **Senior (ST)** | Capital-protected tier. Pays a risk premium (portion of yield) to junior. First claim on recoveries after losses. |
| **Junior (JT)** | First-loss coverage buffer. Absorbs ST drawdowns up to capacity; earns the risk premium sized by the market’s Yield Distribution Model (YDM). |

### Market bundle

`RoycoFactory` (singleton) deploys each market via CREATE3 as four linked contracts: **ST + JT + Kernel + Accountant**. Factory also owns global access roles.

- **Kernel** — deposit/redeem orchestration, coverage constraints, blacklist; pluggable **Quoter** for tranche-asset → NAV (ERC-4626 share price, Chainlink, protocol-specific oracles).
- **Accountant** — syncs before/after every op: raw-NAV deltas → coverage on losses → impermanent-loss tracking → YDM yield share ST→JT → protocol fees.
- **YDM** — % of senior yield paid to junior: static piecewise curve, Adaptive Curve V1 (scale), Adaptive Curve V2 (vertical translate + per-market adaptation speed).

### Core math (compressed)

- **Raw NAV** — holdings at underlying prices, before coverage / yield share.
- **Effective NAV** — after coverage obligations and risk premium; drives redemption value.
- **Utilization** — how much of the junior buffer is “used” by senior exposure (coverage %, β = JT sensitivity to the same stress as ST). Target equilibrium ≈ **90%** utilization so JT stays slightly over-collateralized and liquid.
- **Liquidation utilization threshold** — must be **>100%**; above it, ST redeemers get a self-liquidation bonus funded by JT to restore health.
- **States** — **PERPETUAL** (normal liquidity, YDM adapts, fees accrue) ↔ **FIXED_TERM** (recovery after JT covers ST losses: ST redeems and JT deposits blocked; YDM frozen). Back to PERPETUAL on full recovery, term expiry, liquidation breach, or ST IL (distressed) — with JT IL erasure in non-recovery exits.
- **IL waterfall** — ST losses → JT coverage (JT IL claim on future ST appreciation) then ST IL; recoveries repay ST IL first, then JT IL; remainder is yield via YDM.

### Not Dawn

Legacy **Royco IAM** (Weiroll recipe / Vault incentive bid–ask markets) is a prior product line. Dawn is the current protocol. Do **not** confuse IAM with our `BribeDepot4626` / `RewardStream4626` (vote-directed) or waitlist/AMOE points.

---

## Map onto 4626 today

Canonical stack: [docs/architecture/index.md](../../architecture/index.md). Value lanes (69% / 21.39% / 9.61%) are **fee disposition** from ShareOFT trade volume — **not** a loss waterfall. Keep that terminology distinct from Dawn coverage.

| Dawn concept | Our closest primitive | Gap |
|--------------|----------------------|-----|
| Yield source (ERC-4626 / ERC20 + oracle) | Creator/Agent OVault + Charm/Ajna legs via `OVaultStrategiesModule` | Single socialized share class (▢/◇ → ■/◆), not ST/JT |
| Raw / effective NAV + Accountant sync | `totalAssets` + strategy `report` / debt; lane oracle for ShareOFT | No coverage obligations or risk-premium yield share between LP classes |
| PERPETUAL ↔ FIXED_TERM / observation | Impairment epochs + recovery escrow (`docs/reference/impairment-v1-disclosures.md`, `OVaultRecoveryEscrow`) | Ex-post side-pocket for **all** LPs, not ex-ante junior first-loss |
| Utilization / YDM | Ajna buffer ratio; gauge fee split is trade-volume funded | No deposit-side utilization that reprices yield between risk tiers |
| Pluggable Kernel quoters | `ERC4626StrategyAdapter` + `IStrategyValuation`; study Dawn `Identical_ERC4626_*_Kernel.sol` | We adapt strategies into one vault; Dawn wraps external sources into two tranches |
| Composable ST for lending / Pendle | ShareOFT mesh + CCA/LP arms | Secondary market for shares ≠ capital-protection tranche |
| Incentives layer | Bribes / RewardStreams reward **voters**, not deposit risk tiers | Orthogonal to Dawn |

---

## Learnings worth remembering (deferred — no build)

1. **Ex-ante risk markets vs ex-post impairment** — Dawn prices first-loss up front; we socialize losses then side-pocket. Different product promise; do not rename impairment as “junior.”
2. **Coverage as a first-class constraint** — blocking ST deposits when junior buffer is thin is cleaner than relying on idle/queue policy alone.
3. **Observation / FIXED_TERM liquidity rules** — temporary drawdowns without forcing junior realization; compare carefully to impairment challenge windows before inventing new vault modes.
4. **Pluggable pricing kernels** — thin per-protocol adapters over a shared accountant are the right shape if we ever wrap external yield for a structured product.
5. **Adaptive yield share (YDM)** — utilization-driven premium keeps junior liquid; only relevant if we introduce two deposit classes.
6. **Do not revive IAM recipes** — for incentives, extend bribe/stream rails or waitlist points; do not fork Weiroll markets.

---

## Explicit non-goals (this archive)

- No ST/JT contracts or Dawn factory fork
- No listing CreatorOVault as a Dawn yield source; no leg that allocates into Dawn senior
- No changes to gauge BPS, ShareOFT mesh, or impairment v1 semantics

When product asks to implement any of the deferred items, treat this memo as the starting comparison — not as a green light to copy Dawn wholesale (audits, Certora, and CREATE3 market ops are a full protocol).
