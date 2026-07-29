# Remediations included in this pin

Synced from private `main` `ab8d8c7fa69` (2026-07-28).

## Included (creator + shared)

- **#806 / ODA-498 wrapper cooldown** — hot ShareOFT units keep cooldown attachment (pre-seeded laundering blocked).
- **#805 / ODA-496–498** — CreatorOVault/Core/ShareOFT/Wrapper High/Medium remediations.
- **#798 / ODA-496 lottery** — LM/VRF/AMOE gates already on main.
- Prior carryover: ODA-494/495 Highs, ODA-495-M02 factory revoke, ODA-461 Low/Info, ODA-480/481 P0s.

## Included (agent lane)

- **#788 / ODA-480-[3] agent parity** — `AgentOVaultCoreModule` arms withdraw-cooldown on agent-lane deposits.
- Agent vault stack + `AgentGaugeController` published for lane-parity review.

## Included (oracles — newly published on this pin tip)

- `CreatorOracle.sol`, `AgentOracle.sol`, `IOracle4626.sol`
- Minimal local deps for readable imports: `IRegistry4626`, `IUniswapV3Pool`, `TickMathCompat`
- Replaces failed ODA-511 (target missing on `audit/oda-2026-07-28-agent-lane` @ `0c47be2`)

## Explicit non-goals

- Not a full `contracts/` mirror (no `other/`, archive, fixtures, or complete interface trees).
- Live Base addresses are unchanged by publishing this pin; source for review, not a redeploy announcement.

Historical July 22 (`423e0e3`), July 23 (`413f060`), and July 28 agent-lane (`0c47be2`) pins remain immutable.

## 2026-07-28 strategies + creator revenue sync

- Refreshed `CharmStrategy4626`, Ajna sleeve (`AjnaERC4626Vault`/`Auth`/`Buffer`/`Library`), `ERC4626StrategyAdapter` from private `d82efbad6d2`.
- Added strategy interfaces (`IStrategy`, `IStrategyValuation`, `IAjnaPool`) + UniV3/TickMath deps.
- Added `CreatorPayoutRouter` + `CreatorCoinPolicyController` (absent on agent-lane/oracles pins).
- Bytecode vs live v1.20.0 seal: pin-ahead-of-live / DIFF for all of the above — source pin review, not live identity claim.

## 2026-07-29 LeftClaw #508 + #509 remediation sync

Synced from private `main` `9045a682a`.

- **#509 agent-lane measured accounting (U-01…U-10):** measured strategy refill with quoted-tax gross-up; measured push with delivered-return semantics; trusted-adapter cooldown registry + inflow materiality threshold; tax-netted `previewDeposit`; mint surface advertises unsupported (`maxMint` 0 / `previewMint` reverts); measured `injectCapital`; donation-untracked `coinBalance` delta writes; post-allocation price-guard ordering + strategy-debt `min(reported, spent)` booking; impairment recovery books delivered amounts; shared offset/virtuals constants in `OVaultModuleConstants`.
- **#509 unscored leads:** wrapper fee-waiver no longer waives the wrapper cooldown; operator perms fail closed (registered-bit sentinel, view mirrors enforcement); batcher first-seed received-bound for FOT pairs; `totalAssets` idle leg min-clamps to the live balance; burn-to-zero re-seed loses first-deposit exemptions; `maxTotalSupply` doc alignment.
- **#508 gauge fee-collector remediation:** `AgentGaugeController` / `CreatorGaugeController` per private `main`; lane-parity table in `contracts/README.md`.
- New pin file: `contracts/agent/interfaces/IAgentTokenV4.sol` (quoted-tax interface used by the measured paths).
- Also catches the pin up on prior private work: ODA-507 wrapper hot-units cooldown + `forceApprove`, Ajna automation-Safe keeper wiring in `DeploymentBatcher`, README drift.
- Storage note: `MODULE_STORAGE_VERSION` v5 → v6 (appended `isTrustedAdapter` mapping). Source pin review only — publishing ≠ Base redeploy.
