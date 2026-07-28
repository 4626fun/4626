# Remediations included in this pin

Synced from private `main` `73e341cec` (2026-07-28).

## Included (creator + shared)

- **#806 / ODA-498 wrapper cooldown** — hot ShareOFT units keep cooldown attachment (pre-seeded laundering blocked).
- **#805 / ODA-496–498** — CreatorOVault/Core/ShareOFT/Wrapper High/Medium remediations.
- **#798 / ODA-496 lottery** — LM/VRF/AMOE gates already on main.
- Prior carryover: ODA-494/495 Highs, ODA-495-M02 factory revoke, ODA-461 Low/Info, ODA-480/481 P0s.

## Included (agent lane — newly published on this pin)

- **#788 / ODA-480-[3] agent parity** — `AgentOVaultCoreModule` arms withdraw-cooldown on agent-lane deposits (creator-lane fix was already public; agent lane was private-only until this pin).
- Agent vault stack + `AgentGaugeController` published for lane-parity review (same slim surface as creator vault/gauge).

## Explicit non-goals

- Not a full `contracts/` mirror (no `other/`, archive, fixtures, full interface trees, oracles beyond the listed systems).
- Live Base addresses are unchanged by publishing this pin; source for review, not a redeploy announcement.

Historical July 22 (`423e0e3`) and July 23 (`413f060`) pins remain immutable.
