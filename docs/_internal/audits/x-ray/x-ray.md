# X-Ray Report

> 4626 | 20782 nSLOC | 21cc6caed (`main`) | foundry | 11/05/26

---

## 1. Protocol Overview

**What it does:** Multi-contract creator vault protocol on Base that deploys per-creator ERC-4626 vault infrastructure, routes token fees, and coordinates lottery/oracle/cross-chain extensions.

- **Users**: creators deploying vault stacks, traders paying share-token transfer fees, keepers managing strategy state.
- **Core flow**: creator runs phased deploy with `DeploymentBatcher`, users deposit into `CreatorOVault`, keepers rebalance/report.
- **Key mechanism**: ERC-4626 vault + strategy modules, fee split via gauge, OFT cross-chain share token plumbing.
- **Token model**: creator coin + ShareOFT + vault shares with fee-routing and burn/lottery/protocol split lanes.
- **Admin model**: creator/protocol ownership plus keeper/updater roles across vault, gauge, lottery, oracle, and bridge adapters.

For a visual overview of the protocol's architecture, see the [architecture diagram](architecture.svg).

### Contracts in Scope

| Subsystem | Key Contracts | nSLOC | Role |
|-----------|--------------|------:|------|
| Vault Core | `CreatorOVault`, `CreatorOVaultWrapper`, `CreatorOVault*Module` | 2565 | ERC-4626 accounting, share issuance, strategy orchestration |
| Deployment | `DeploymentBatcher`, `VaultActivationBatcher`, CREATE2 deploy helpers | 2284 | Phased deterministic deployment and ownership wiring |
| Strategies | CCA/Charm/Ajna/Solana strategy contracts | 4659 | Yield deployment, LP management, bridge-facing rebalances |
| Fees & Governance | `CreatorGaugeController`, voting/bribes contracts | 1458 | Fee splitting, burn/jackpot/protocol routing, governance signals |
| Messaging & Utility | `CreatorShareOFT`, `OVaultHubComposer`, `CreatorOracle`, routers | 2025 | Cross-chain messaging, oracle updates, payout conversion |
| Lottery & Randomness | `CreatorLotteryManager`, VRF/randomness/zk routers | 3978 | Jackpot entry, randomness consumption, winner settlement |
| Bridge & Registry | `SolanaBridgeAdapter`, `CreatorRegistry`, factories | 1333 | Route/token registration, canonical address graph, per-creator mappings |
| Alfa LP Extension | `AlfaCreatorKeyLPFactory`, `AlfaCreatorKeyPool` | 305 | Creator/FriendKey AMM extension |

### How It Fits Together

The core trick: per-creator systems are composed from shared modules (deployment, vault, gauge, lottery, oracle, bridge) while preserving creator-local state via registry wiring.

### Creator Deploy Path

```text
Creator
└─ DeploymentBatcher.deployPhase1*/finalizePhase1*
   ├─ UniversalCreate2DeployerFromStore.deploy()
   ├─ deploy core contracts (vault / wrappers / routers)
   └─ phase assertions + ownership wiring
```

*Critical state setup is front-loaded in phased deploy gates and owner checks.*

### User Deposit and Strategy Allocation

```text
User
└─ CreatorOVault.deposit()/mint()
   ├─ CreatorOVaultCoreModule accounting
   └─ Keeper/management deployToStrategies()
      └─ strategy modules (CCA / Charm / Ajna / Solana)
```

*Vault share accounting and strategy debt accounting must remain synchronized.*

### Share Fee and Distribution Lane

```text
Transfer path
└─ CreatorShareOFT._transferWithFees()
   └─ CreatorGaugeController.receiveFees()
      ├─ burn stream route
      ├─ lottery route
      └─ protocol/creator routes
```

*Fee routing is the main cross-contract economic coupling surface.*

### Lottery Settlement Path

```text
Authorized swap / entry
└─ CreatorLotteryManager.processSwapLottery()
   ├─ VRF/randomness source request
   ├─ winner selection
   └─ payout via gauge/controller paths
```

*Randomness sponsorship and winner settlement are stateful and role-dependent.*

---

## 2. Threat & Trust Model

### Protocol Threat Profile

> Protocol classified as: **Yield Aggregator / Vault** with **DEX/AMM + Bridge + Governance + Lottery** characteristics

The dominant blast radius centers on vault accounting + strategy debt + fee-routing correctness. Secondary risk planes come from cross-chain/OFT dependencies and role-heavy operational surfaces.

### Actors & Adversary Model

| Actor | Trust Level | Capabilities |
|-------|-------------|-------------|
| Creator/Owner | Bounded (owns creator-specific stack) | Runs phase deploy and config setters; can update key operational parameters quickly. |
| Protocol Treasury/Admin | Trusted | Holds ownership for shared modules and strategy ownership handoff paths. |
| Keeper | Bounded (role-gated ops only) | Executes report/tend/nav updates; can influence liveness and accounting cadence. |
| Oracle Updater | Bounded (whitelisted updater set) | Pushes creator pricing and relay updates into oracle paths. |
| Lottery Operator/Auth Caller | Bounded (allowlisted contracts) | Triggers lottery processing and randomness-sponsored paths. |
| External User/Trader | Untrusted | Calls permissionless deposit/withdraw and transfer-triggered fee paths. |

**Adversary Ranking** (ordered by threat level):

1. **State-coupling exploiter** — targets cross-contract accounting asymmetry between vault, strategy modules, gauge, and ShareOFT.
2. **Role-key compromise attacker** — abuses owner/keeper/updater authorities to redirect or desynchronize high-value flows.
3. **Cross-chain/message adversary** — attacks OApp/OFT configuration assumptions or message route integrity.
4. **MEV/market manipulator** — pressures swap/liquidity/oracle assumptions around fee conversion and strategy execution.

See [entry-points.md](entry-points.md) for the full permissionless and role-gated entrypoint map.

### Trust Boundaries

- **Creator ownership boundary** — creator must remain control-plane authority for phase deploy and creator-local vault settings (`DeploymentBatcher`, `CreatorOVault`).
- **Protocol-admin boundary** — shared modules rely on privileged ownership transitions and global setters with immediate operational impact.
- **Keeper boundary** — keeper reports and nav updates can affect user-visible accounting and strategy posture without direct user approvals.
- **Cross-chain boundary** — LayerZero endpoint/peer configuration mediates message authenticity for ShareOFT, oracle, and lottery relays.
- **External liquidity/oracle boundary** — Uniswap/Chainlink/Base-bridge dependencies influence price and execution assumptions beyond local contract control.

### Key Attack Surfaces

- **Deploy-path phase integrity (`DeploymentBatcher`)** &nbsp;&#91;[I-4](invariants.md#i-4), [G-9](invariants.md#g-9)&#93; — phase transitions, owner assertions, and CREATE2 deploy permissions are worth checking for wedge/retry edge paths that leave partial ownership or stale wiring.

- **Vault share/debt symmetry (`CreatorOVault` + strategies)** &nbsp;&#91;[I-1](invariants.md#i-1), [I-2](invariants.md#i-2)&#93; — deposit/withdraw/report/tend interactions are worth tracing for accounting divergence between vault totals and per-strategy debt during stressed exits.

- **Cross-chain message-route coherence (`CreatorShareOFT`/oracle/lottery)** &nbsp;&#91;[X-2](invariants.md#x-2), [I-3](invariants.md#i-3)&#93; — peer/endpoint config and fee relay lanes are worth confirming for consistent destination routing across OFT, price relay, and jackpot settlement flows.

- **Solana bridge/strategy NAV trust boundary** &nbsp;&#91;[X-3](invariants.md#x-3), [G-6](invariants.md#g-6)&#93; — `SolanaBridgeAdapter` + `SolanaStrategy` are worth checking for report authenticity, replay resistance, and bounded NAV progression.

### Upgrade Architecture Concerns

- **Phase-module ownership transitions are high leverage** — batcher and module ownership handoffs across deploy phases should be checked for partial-transition lock states.
- **Multiple shared infra contracts amplify config drift risk** — deployer/store/gauge/oracle/OFT split ownership means stale references can persist if updates are non-atomic.

### Protocol-Type Concerns

**As a Yield Aggregator / Vault:**
- `CreatorOVault` + strategy module interactions are sensitive to share/asset conversion symmetry under non-happy-path withdrawals.
- Strategy onboarding paths require strict underlying-asset parity and weight-budget constraints to avoid hidden over-allocation.

**As a Bridge/Messaging protocol:**
- OFT/OApp peer and endpoint config coherence directly affects whether cross-chain state is trustworthy.
- Replay and nonce disciplines in lottery/strategy bridge-adjacent paths should remain consistently enforced.

### Temporal Risk Profile

**Deployment & Initialization:**
- Multi-phase deployment introduces sequencing risk if any phase is partially completed and retried with diverged assumptions.
- Initial owner/peer/wiring setup in shared contracts is a high-sensitivity window before operational steady state.

**Market Stress:**
- Strategy and fee-conversion paths that depend on external liquidity can behave differently under volatility and thin pools.

---

## 3. Invariants

> ### 📋 Full invariant map: **[invariants.md](invariants.md)**
>
> A dedicated reference file contains the complete invariant analysis.
>
> - **10 Enforced Guards** (`G-1` … `G-10`)
> - **6 Single-Contract Invariants** (`I-1` … `I-6`)
> - **3 Cross-Contract Invariants** (`X-1` … `X-3`)
> - **2 Economic Invariants** (`E-1` … `E-2`)

---

## 4. Documentation Quality

| Aspect | Status | Notes |
|--------|--------|-------|
| README | Present | `README.md` plus subsystem README coverage |
| NatSpec | ~92 annotations | Broad coverage in core and strategy contracts |
| Spec/Whitepaper | Present | Architecture/design docs under `docs/` |
| Inline Comments | Adequate | Security/audit-era comments common in sensitive modules |

---

## 5. Test Analysis

| Metric | Value | Source |
|--------|-------|--------|
| Test files | 192 | File scan (always reliable) |
| Test functions | 1269 | File scan (always reliable) |
| Line coverage | Unavailable — forge coverage failed (stack too deep in `DeploymentBatcher`) | Coverage tool |
| Branch coverage | Unavailable — same compile failure | Coverage tool |

### Test Depth

| Category | Count | Contracts Covered |
|----------|-------|-------------------|
| Unit | 1269 | Broad coverage across core and utility contracts |
| Fork | 5 | Targeted integrations |
| Stateless Fuzz | 51 | Present |
| Stateful Fuzz (Foundry) | 11 | Present |
| Formal Verification (Certora) | 3 | Present |
| Formal Verification (Halmos) | 38 | Present |

### Gaps

- Echidna and Medusa suites are not present in current scan output.
- HEVM formal checks are not present in current scan output.
- Coverage metrics are unavailable due to compile-depth constraints, but test existence is strong from file/function scan.

---

## 6. Developer & Git History

> Repo shape: normal_dev — 263 source-touching commits across ~225 days on `main`.

### Contributors

| Author | Commits | Source Lines (+/-) | % of Source Changes |
|--------|--------:|--------------------|--------------------:|
| wenakita | 2985 | +81327 / -58203 | 91.5% |
| Akita V2 | 811 | +6195 / -3952 | 7.0% |
| 4626 Audit Bot | 3 | +1359 / -248 | 1.5% |
| Cursor Agent | 6 | +6 / -4 | 0.0% |

### Review & Process Signals

| Signal | Value | Assessment |
|--------|-------|------------|
| Unique contributors | 16 | Small core team with dominant primary author |
| Merge commits | 469 of 3974 (11.8%) | Some structured PR flow exists |
| Repo age | 2025-09-27 → 2026-05-10 | ~7.5 months active history |
| Recent source activity (30d) | 51 commits | High late-cycle change velocity |
| Test co-change rate | 43.3% | Moderate source-test co-modification rate |

### File Hotspots

| File | Modifications | Note |
|------|-------------:|------|
| `contracts/helpers/batchers/DeploymentBatcher.sol` | 37 | Highest churn deployment-critical file |
| `contracts/vault/CreatorOVault.sol` | 26 | Core accounting hot path |
| `contracts/utilities/lottery/CreatorLotteryManager.sol` | 18 | Large operational surface |
| `contracts/governance/CreatorGaugeController.sol` | 17 | Fee-routing core logic |
| `contracts/utilities/messaging/CreatorShareOFT.sol` | 16 | Cross-chain + fee integration |

### Security-Relevant Commits

| SHA | Date | Subject | Score | Key Signal |
|-----|------|---------|------:|------------|
| `c2866f22e` | 2026-01-19 | `chore(security): remediate scanner findings across app and contracts` | 25 | security-language + focused guard/access edits |
| `2fca62a67` | 2026-04-23 | `Security audit remediation — Sprint 9` | 23 | security remediation + test-linked changes |
| `268cba38e` | 2026-02-21 | `fix(security): prevent ERC-4626 dilution from misvaluation` | 23 | vault accounting + strategy security paths |
| `da1eec86a` | 2026-02-20 | `fix(security): harden vault accounting and swap safety` | 23 | multi-domain guard hardening |

### Dangerous Area Evolution

| Security Area | Commits | Key Files |
|--------------|--------:|-----------|
| fund_flows | 126 | `DeploymentBatcher.sol`, `CreatorOVault.sol`, `CreatorShareOFT.sol` |
| access_control | 120 | `CreatorRegistry.sol`, `CreatorGaugeController.sol`, `CreatorLotteryManager.sol` |
| oracle_price | 120 | `CreatorOracle.sol`, strategy and gauge-related flows |
| state_machines | 108 | deployment/vault/lottery paths |
| signatures | 99 | lottery/oracle/bridge-update surfaces |

### Forked Dependencies

| Library | Path | Upstream | Status | Notes |
|---------|------|----------|--------|-------|
| `continuous-clearing-auction` | `lib/continuous-clearing-auction` | external | Submodule | Large dependency surface |
| `liquidity-launcher` | `lib/liquidity-launcher` | external | Submodule | Very large transitive Solidity surface |
| `v3-core` | `lib/v3-core` | Uniswap V3 | Submodule | pragma divergence notes present in analysis |
| `v3-periphery` | `lib/v3-periphery` | Uniswap V3 | Submodule | pragma divergence notes present in analysis |

### Security Observations

- **Primary-author concentration** — `wenakita` accounts for ~91.5% of source-line additions.
- **Deployment path churn** — `DeploymentBatcher.sol` is the highest-modification contract and a critical trust/control surface.
- **Late-cycle intensity** — 51 source-touching commits landed in the last 30 days.
- **Security remediation density** — multiple high-score security-fix commits touch vault, gauge, oracle, and strategy internals.
- **Source-only late commits exist** — 12 late commits modified source without test-file co-change.

### Cross-Reference Synthesis

- **Hotspot + attack surface alignment** — deployment/vault/gauge/shareOFT appear in both churn leaders and top threat surfaces.
- **Security-fix concentration + invariants** — prior remediation commits cluster around accounting and access-control boundaries reflected in `I-*` and `X-*`.
- **Late lottery/oracle activity + temporal risks** — recent changes in lottery/randomness/oracle planes increase review priority for epoch/replay/time-window invariants.

---

## X-Ray Verdict

**HARDENED** — The codebase has strong test and formal-signal presence plus explicit role boundaries, but high complexity and recent high-churn security-critical changes keep residual integration risk elevated.

**Structural facts:**
1. 20,782 nSLOC across a multi-subsystem, cross-chain architecture with heavy contract interdependence.
2. 192 test files / 1269 test functions with fuzz + invariant + formal artifacts present in scan output.
3. Source evolution is highly concentrated in one primary author (~91.5% line additions).
4. 51 source commits landed in the most recent 30-day window on the analyzed `main` branch.
5. Coverage execution is currently blocked by stack-depth compile failure in `DeploymentBatcher` under coverage mode.

