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
