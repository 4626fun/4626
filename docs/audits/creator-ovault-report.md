---
title: CreatorOVault risk report
sidebar_label: CreatorOVault report
sidebar_position: 2
last_updated: '2026-07-28'
audience:
  - developers
  - protocols
  - operators
stage: use
owner: docs-team
last_reviewed: '2026-07-28'
status: current
---

# CreatorOVault — protocol risk report

**Protocol-level curation note for every CreatorOVault on the current greenfield stack.** This is not a numeric risk score and not a per-creator TVL dossier. Instance addresses, live allocation, and wiring health must be verified onchain (or via the app Status vault report) for each vault.

| | |
|---|---|
| **Product** | CreatorOVault (ERC-4626, Yearn V3–style roles / report / strategies) |
| **Chain** | Base (primary); ShareOFT may bridge via LayerZero |
| **Deposit asset** | Zora creator coin (standard ERC-20; not fee-on-transfer / rebasing) |
| **Share** | ▢ vault shares; ■ = LayerZero ShareOFT via wrapper |
| **Launch allocation target** | ~45% Charm · 45% Ajna · 10% idle |
| **Current infra epoch** | [v1.20.0 greenfield](/reference/addresses) (hard cutover for new launches) |
| **Updated** | 2026-07-28 |

Related: [CreatorOVault contract](/contracts/core/creator-ovault) · [Strategy bundle](/guides/strategy-bundle) · [Impairment disclosures](/reference/impairment-v1-disclosures) · [Security & audits](/audits) · [Addresses](/reference/addresses)

---

## Overview

4626 deploys **one CreatorOVault per creator**. The vault holds the creator’s Zora **creator coin**, mints **▢** ERC-4626 shares on deposit, and allocates TVL across paid **legs** (yield strategies). Holders redeem by burning shares for creator coin — subject to liquidity, strategy unwind, impairment state, and queue semantics when applicable.

Architecture borrows Yearn V3 patterns: strategy debt ratios, keeper `report`, management configuration, and emergency controls. Price per share (PPS) is derived from `totalAssets()` / supply with virtual-share inflation protection and donation-resistant balance tracking.

### Legs vs arms (critical distinction)

| Kind | Examples | Role | On vault? |
|------|----------|------|-----------|
| **Leg (strategy)** | Charm active LP, nested Ajna 4626 sleeve | Deploy / manage **creator coin** for yield | Yes — `addStrategy`, weights, `strategyMaxAssets` |
| **Arm** | CCA launch, Share mesh V4 LP, Solana OVault mesh, trade-fee / gauge / lottery | Extend **■ ShareOFT** (launch, DEX liquidity, bridge, fees) | No — never `addStrategy` |

Solana exposure at finalize (~30% of `■` bridged) is an **arm**, not a vault yield leg. Do not treat bridged ShareOFT as a redemption path for vault creator-coin NAV.

### Canonical strategy topology

```text
CreatorOVault  (deposit / redeem surface)
├── CreatorCharmStrategy          — Uniswap / Charm LP management
├── ERC4626StrategyAdapter        — only Ajna-facing strategy the outer vault sees
│   └── AjnaERC4626Vault
│       ├── AjnaVaultAuth
│       └── AjnaVaultBuffer
└── Idle creator-coin balance     — buffer for redemptions / rebalancing

Arms (ShareOFT domain — not legs):
CCALaunchArm · OVaultLPManager (mesh) · Solana mesh bridge · gauge / lottery
```

New vault launches pay the launch bundle and target **~45% Charm · 45% Ajna · 10% idle** for CREATOR allocation after strategy deploy. See [Step 1: Pay launch fee](/guides/strategy-bundle).

---

## Risk summary

### Key strengths

- **ERC-4626 product surface with Yearn-style controls** — explicit `owner` / `management` / `keeper` / `emergencyAdmin`, strategy queue, and keeper `report`.
- **Hardening against classic vault attacks** — virtual shares, minimum first deposit, per-tx price limits, block delay, exact-transfer accounting (rejects fee-on-transfer / rebasing assets).
- **Nested Ajna sleeve** — Ajna pause, buffer, auth, and bucket mechanics stay inside the inner vault; the outer vault only knows the ERC-4626 adapter.
- **Strategy caps** — `strategyMaxAssets` and valuation-readiness checks bound how much NAV a leg may claim until governance revises caps.
- **Impairment side-pocket v1** — trip/finalize/claim flow can isolate impaired strategy NAV from the clean book; stale trips are bounded by `maxImpairmentTripDuration` (default 14 days). Details: [Impairment v1 disclosures](/reference/impairment-v1-disclosures).
- **Risk-config delay** — fee and material risk parameter changes are scheduled behind `riskConfigDelay` (minimum 1 day by default on current modules).
- **Public review trail** — June 2026 FABLE technical review, Aristotle / Lean proof targets for lottery/gauge math, and vault-stack source reviews with documented fix follow-ups. Start at [Security & audits](/audits).

### Key risks

- **Creator-coin market risk** — vault NAV is denominated in a creator ERC-20 whose price, liquidity, and issuer behavior are outside the vault’s control.
- **Strategy valuation risk** — Charm LP and Ajna sleeve NAV depend on pool state, oracles / internal accounting, and keeper reporting. Caps reduce unbounded trust; they do not eliminate mark-to-market or lending losses.
- **Liquidity under stress** — redemptions compete for idle coin plus what strategies can unwind. Charm LP and Ajna buckets can be slow or paused; there is no guarantee of atomic full exit at quoted PPS under stress.
- **Privileged roles** — owner/management can change strategies, weights, and (via scheduled risk config) fees and caps. Emergency and impairment authorities can halt or side-pocket the vault.
- **Cross-product complexity** — ShareOFT, CCA, mesh LP, Solana bridge, gauge, and lottery share the creator’s economic surface but are **not** the vault’s redemption engine. Confusing arms with legs leads to wrong risk models.
- **No public bug bounty program** listed on major platforms at the time of this report — reliance is on internal/partner reviews and disclosed audits.

### Critical risks

- **Impairment / Suspect mode freezes ERC-4626 ops** — while `Suspect`, deposit/mint/withdraw/redeem revert and max-* views return zero. Claim rights at trip belong to the **address holding shares** (wrappers and external integrations receive claims, not end users behind them). See [critical user disclosure](/reference/impairment-v1-disclosures#critical-user-disclosure).
- **Keeper / report dependency** — PPS and strategy debt accounting depend on honest, timely `report` and strategy `_totalAssets()` implementations. Malicious or stale reporting can misstate NAV until caps, impairment, or emergency controls intervene.
- **Deploy and module trust** — new vaults are created via batchers, bytecode store, and delegatecall modules. Shared infra compromise or wrong epoch wiring affects every greenfield launch. Verify addresses against [Contract addresses](/reference/addresses).
- **Ajna / Charm external protocol risk** — losses, pauses, or bugs in Charm, Ajna, or Uniswap liquidity layers flow into vault NAV for the corresponding sleeve.

---

## Audits and disclosures

### Protocol security hub

| Material | What it covers | Link |
|----------|----------------|------|
| **Security & audits overview** | Entry point, FABLE report structure | [/audits](/audits) |
| **FABLE June 2026** | Technical security review (scope, executive summary, full report, sessions) | [/audits/fable](/audits/fable) |
| **Aristotle** | Formal / Lean-oriented targets (lottery, gauge fee split, boost math, VRF) | [/audits/aristotle](/audits/aristotle) |
| **Impairment v1 disclosures** | Side-pocket behavior, claim trust boundaries, recovery caps | [/reference/impairment-v1-disclosures](/reference/impairment-v1-disclosures) |

FABLE is a **repository-wide** technical review (not a single-file vault-only engagement). Aristotle materials focus heavily on lottery/gauge fairness math; they complement, rather than replace, vault strategy diligence.

### Vault-stack findings posture (qualitative)

CreatorOVault and its modules have undergone source review with a published fix follow-up trail. Documented themes that depositors should still understand (even where code fixes shipped):

| Theme | Why it matters |
|-------|----------------|
| Queued withdrawal settlement vs reservation-capped previews | Bank-run / queue fairness if settlement math underpays claimants |
| Impairment authority + liveness | Who can freeze the vault; how long Suspect can last |
| `riskConfigDelay` | Whether fee/cap changes are timelocked from day one |
| Module storage layout / versioning | Delegatecall module safety across upgrades |
| ShareOFT burn allowances | Who can burn ■ without holder approval |

Treat the [audits hub](/audits) and contract pages as the living index; this report does not re-list every finding ID.

### Bug bounty

No active public bug bounty listing (Immunefi / Sherlock / Cantina–style) is asserted in public docs as of this update. Security contact and process follow materials under [Security & audits](/audits) and [Legal](/legal/terms).

### Due diligence caveats

- This page describes the **protocol template** for greenfield CreatorOVaults. A specific vault may still be on a deprecated epoch, partially wired, or not yet strategy-activated — verify onchain.
- Protocol-provided marketing APR bands are **not** audited yield guarantees; this report does not publish expected APR.
- Deep-risk consolidation notes exist for launch/API/wallet domains; they are not a substitute for reading strategy and impairment surfaces when depositing into a vault.

---

## Historical track record

| Dimension | Protocol posture (verify instances separately) |
|-----------|--------------------------------------------------|
| **Production stack** | Shared infrastructure and new launches target **v1.20.0** greenfield on Base. Prior v1.19.x / earlier addresses may still appear on already-deployed vaults but are **not** supported launch targets. |
| **Per-vault TVL / PPS history** | Not curated in this document. Read `totalAssets()`, `pricePerShare()`, and strategy asset breakdowns on the vault; use app Status / vault report tooling for wiring checks. |
| **Incidents** | No separate public incident register is maintained on this page. Impairment trips, emergency shutdowns, and strategy pauses are the onchain signals to watch (see Monitoring). |
| **Canaries** | Addresses docs note that creator + agent paid canaries on the new stack may still be outstanding — treat early vaults as higher operational-uncertainty until your own wiring checks pass. |

---

## Funds management

### Where creator-coin capital sits

For a fully activated launch-bundle vault, CREATOR allocation targets approximately:

| Sleeve | Target | Mechanism |
|--------|--------|-----------|
| **Charm** | ~45% | Active LP management (creator coin ↔ USDC / pool inventory) |
| **Ajna** | ~45% | Nested `ERC4626StrategyAdapter` → AjnaERC4626Vault (+ auth/buffer) |
| **Idle** | ~10% | Unallocated creator coin in the vault for flexibility / redemptions |

Weights and actual assets are onchain via `getStrategies()` (addresses, weights, assets). Caps (`strategyMaxAssets`) may bind a sleeve below its target weight.

### Accessibility

| Action | Behavior |
|--------|----------|
| **Deposit** | Transfer creator coin → mint ▢ (subject to whitelist / activation rules, min deposit, impairment state). |
| **Withdraw / redeem** | Burn ▢ → receive creator coin when liquidity and strategy unwind allow; may involve queues or best-effort strategy withdrawals. |
| **Wrap to ■** | Optional via [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) for DEX / OFT — **not** the same as redeeming vault NAV. |
| **Suspect impairment** | Deposit/mint/withdraw/redeem **revert**; claims follow impairment docs. |

### Fees

Vault fee parameters (performance / management and recipients) are onchain admin surfaces, typically changed via scheduled risk-config flows behind `riskConfigDelay`. Separately, **ShareOFT trade fees** and gauge/lottery splits apply to ■ trading — they are arm/fee-domain economics, not Charm/Ajna strategy yield accounting. See [Fees, auction, and lottery](/overview/how-it-works).

### Valuation and caps

Legs are onboarded with a valuation class (internal-accounting / oracle-backed / capped). Until valuation is trusted, **caps** are the primary trust ceiling: Ajna growth and Charm LP mark-to-market both need ongoing review after large rebalances. Caps do not create insurance.

### Impairment / loss isolation (v1)

When a strategy is impaired:

1. Authority (`owner` or `impairmentGuardian`) may trip an impairment epoch.
2. Clean-book `totalAssets()` excludes finalized impaired strategy NAV.
3. Depositors at `tripBlock` receive non-transferable epoch claims (to the holding address).
4. Realized recoveries pay through escrow/claims — they are **not** silently merged back into clean NAV.
5. Stale trips can be cleared permissionlessly after `maxImpairmentTripDuration`.

Full rules: [Impairment v1 disclosures](/reference/impairment-v1-disclosures).

### Provability

| Claim | How to verify |
|-------|----------------|
| Strategies + weights + assets | Vault `getStrategies()` |
| Caps | `strategyMaxAssets(strategy)` |
| Fees / delay | Onchain fee getters + `riskConfigDelay` |
| Impairment mode | Impairment / epoch views on the vault modules |
| Shared infra epoch | [Addresses](/reference/addresses) vs vault module immutables / factory provenance |
| Wiring checklist | App Status vault report (`/api/status/vaultReport` or `/api/v1/vault/report`) |

---

## Liquidity risk

- **Idle buffer (~10% target)** — primary immediate redemption inventory; can be depleted by withdrawals or aggressive strategy funding.
- **Charm LP** — exit depends on pool depth, inventory mix (creator coin vs USDC), and strategy unwind path; thin creator markets amplify slippage and time-to-exit.
- **Ajna sleeve** — buffer and pause controls can throttle availability; lending utilization and bucket state affect how quickly creator coin returns to the outer vault.
- **Queued withdrawals** — under contention, settlement may be asynchronous; do not assume every redeem is atomic at the last observed PPS.
- **Impairment freeze** — Suspect mode is a hard liquidity stop for ERC-4626 ops until clear/finalize paths complete.
- **ShareOFT / Solana** — secondary market liquidity for ■ is **not** vault redemption liquidity. Bridged shares do not redeem remote creator coin from a Base vault.

---

## Centralization and control

### Vault roles

| Role | Powers (summary) |
|------|------------------|
| **Owner** | Full control, including emergency shutdown and top-level governance of the vault instance |
| **Management** | Strategy configuration (`addStrategy` / `removeStrategy`, debt ratios / operational strategy controls) |
| **Keeper** | Profit/loss reporting and tending (`report`) |
| **EmergencyAdmin** | Emergency shutdown path (narrower than owner) |
| **Impairment guardian** | With owner, may trip/clear impairment (not the broader historical role set) |

Exact bindings are per vault — read role getters onchain after deploy / ownership handoff.

### Scheduled risk configuration

Material risk parameters (fees, strategy max assets, related knobs) go through a **delay** (`riskConfigDelay`, default minimum **1 day**). Immediate zero-delay fee changes are not the intended production posture on current modules.

### Deploy and shared infrastructure

New vaults are produced by protocol factories/batchers and module bytecode (core / strategies / admin). Protocol treasury Safe and related Safes appear in [Addresses](/reference/addresses). Compromised deployer keys, wrong bytecode epoch, or incomplete Phase 2/3 wiring are systemic risks for launches — independent of any single vault’s strategy mix.

### Programmability

| Domain | Onchain / offchain |
|--------|---------------------|
| Share math, deposits, redemptions, strategy debt accounting | Onchain |
| Keeper reports, strategy rebalances, Ajna/Charm ops | Privileged keepers / automation |
| Cap and fee governance | Owner/management + delay |
| Oracle / pool marks for LP and mesh | External market + oracle contracts |
| Credit-style offchain underwriting | **Not** part of CreatorOVault legs (unlike unsecured credit vaults) |

---

## Operational risk

- **Keeper liveness** — missed reports/tends degrade allocation efficiency and can leave NAV stale relative to markets.
- **Oracle and pool assumptions** — Charm and post-graduation mesh paths consume market/oracle state; manipulation windows are mitigated by vault price limits / delays but not eliminated.
- **Multi-step launch** — trading-live ShareOFT requires auction graduation and mesh steps beyond vault activation; incomplete launch increases product confusion more than vault accounting risk, but ops mistakes during Phase 3 strategy deploy can mis-wire legs.
- **Deploy-session vs long-lived custody** — temporary deploy-session operators differ from the creator’s long-lived vault owner and from protocol agent wallets. Depositors should confirm final `owner` / `management` after activation, not only mid-deploy actors.
- **Documentation drift** — allocation and arm/leg language has drifted in some educational surfaces historically; this report and [strategy bundle](/guides/strategy-bundle) use **45/45/10** and legs≠arms as canonical for greenfield launches.

---

## External dependencies

| Dependency | Criticality | Notes |
|------------|-------------|-------|
| **Zora creator coin (ERC-20)** | Critical | Vault asset; issuer and market risk |
| **Charm / Uniswap liquidity** | Critical | LP leg NAV and exit path |
| **Ajna** | Critical | Lending sleeve via nested ERC-4626 vault + buffer/auth |
| **Uniswap V4 + mesh LP manager** | High (arm) | Post-CCA ■ liquidity; not vault CREATOR leg |
| **LayerZero V2 OFT** | High (arm) | ■ bridging; remote ■ ≠ remote vault redeem |
| **Creator oracle / TWAP surfaces** | High | Pricing guards for vault limits and mesh rebalance |
| **Chainlink VRF (lottery)** | Medium (adjacent) | Fee/lottery domain on ■ buys — not vault NAV |
| **Bytecode store / CREATE2 / batchers** | Critical (launch) | Determines which code every new vault runs |

---

## Monitoring

### Shared infrastructure (Base)

Canonical table: [Contract addresses](/reference/addresses). At minimum watch:

| Contract | Why monitor |
|----------|-------------|
| Registry4626 | Vault registration / discovery |
| OVaultFactory4626 / DeploymentBatcher (+ phase helpers) | New vault creation, wiring changes |
| CreatorOVaultCoreModule / StrategiesModule / AdminModule | Implementation surface for greenfield vaults |
| UniversalBytecodeStoreV2 / CREATE2 deployer | Bytecode substitutions |
| Protocol treasury Safe | Ownership of shared deploy/strategy infra |
| LotteryManager4626 / VRFConsumer4626 | Adjacent fee/lottery domain |
| VaultActivationBatcher | Activation / finalize path |

### Per-vault checklist

For vault `V`:

1. Confirm `V` is the ERC-4626 deposit surface (not the wrapper or ShareOFT).
2. Read `owner`, `management`, `keeper`, `emergencyAdmin` (and impairment guardian if exposed).
3. Call `getStrategies()` — expect Charm + Ajna adapter kinds when fully launched; note weights vs ~45/45 and idle.
4. Read `strategyMaxAssets` per strategy and compare to reported assets.
5. Read `pricePerShare`, `totalAssets`, fee parameters, `riskConfigDelay`.
6. Check impairment / Suspect state before depositing.
7. Run Status **vault report** wiring checks (core · wiring · pricing/Ajna · strategies).
8. Separately inventory arms (CCA, mesh LP, Solana peers) if you trade ■ — do not fold them into vault CREATOR NAV.

### Critical events

- Emergency shutdown / pause flips
- Strategy add/remove or large weight changes
- `strategyMaxAssets` or fee schedule executions after delay
- Impairment trip / clear / finalize / recovery notifications
- Keeper `report` with large loss
- Ajna auth pause or buffer policy changes
- Module/bytecode epoch changes on shared infra
- Ownership transfers on vault or protocol Safes

---

## Appendix: contract architecture

```text
                         Protocol infra (shared)
         Registry · Factory · Batchers · Bytecode store · Safes
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ CreatorOVault V                                             │
│  asset: creator coin · shares: ▢ · roles · report · caps    │
│  impairment epochs (optional side-pocket)                   │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
      CreatorCharmStrategy          ERC4626StrategyAdapter
      (Charm / Uni LP)              └─ AjnaERC4626Vault
                                       ├─ AjnaVaultAuth
                                       └─ AjnaVaultBuffer

▢ ──wrap──► CreatorOVaultWrapper ──► CreatorShareOFT (■)
                                      │
                                      ├─ CCALaunchArm (primary market)
                                      ├─ OVaultLPManager (V4 mesh)
                                      ├─ LayerZero → remote ■ / Solana mesh
                                      └─ Gauge · lottery · trade fees
```

Trust boundary reminder: **legs** move creator-coin NAV inside the vault; **arms** move or monetize ■. Remote ■ never implies a remote CreatorOVault redeem of Base creator coin.

---

## Reassessment triggers

Revisit this protocol report when any of the following occur:

| Trigger | Example |
|---------|---------|
| **Release / epoch** | New greenfield cutover (post–v1.20.0), module storage version bump, batcher redesign |
| **New leg or arm** | Additional `addStrategy` product, or new ShareOFT facility marketed as “strategy” |
| **Allocation policy** | Launch targets change from 45/45/10 |
| **Impairment redesign** | v2 claims, transferable claims, or adapter-aware beneficial ownership |
| **Control changes** | Default `riskConfigDelay`, role model, or emergency semantics change |
| **Audit / bounty** | New vault-scoped audit published, or public bounty launched |
| **Incident** | Material impairment across vaults, strategy insolvency, or infra key compromise |
| **Time** | At least every **6 months** while CreatorOVault remains the public deposit surface |

---

## Assessment history

| Date | Notes |
|------|-------|
| 2026-07-28 | Initial public protocol-level CreatorOVault curation report (qualitative sections; no numeric score). |

Prev: [Security & audits](/audits) · Next: [Aristotle](/audits/aristotle)
