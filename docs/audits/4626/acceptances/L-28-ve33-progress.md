# L-28 — `docs/governance/ve33-progress.md` stale "In Progress" claims

- Finding: L-28 (Linear: 4626-377 — see canonical mapping; body carries L-28 text)
- Severity: Low
- Disposition: **Fixed** — page rewritten to separate Completed / In Progress / Planned with code-path citations.

## Problem

The previous "In Progress" section listed "Frontend voting UI", "Bribe marketplace", and "Cross-chain voting aggregation" with no code-path citations. In the audited tree, two of those already ship code:

- `frontend/src/pages/GaugeVoting.tsx` (141 LOC) — Frontend voting UI is complete.
- `contracts/governance/bribes/BribeDepot.sol` — Bribe marketplace contract is deployed.

Only "Cross-chain voting aggregation" genuinely has no code.

## Fix

`docs/governance/ve33-progress.md` now has three categories — Completed, In Progress, Planned — with a legend explaining what each means in terms of shipped code:

- **Completed**: contract and, where applicable, frontend exist in the audited commit.
- **In Progress**: partial code is merged (currently: bribe-marketplace frontend).
- **Planned**: no code exists yet (currently: cross-chain voting aggregation).

Each completed item now cites the specific Solidity / React file path so future readers can verify the claim directly against the repo.

## Follow-ups

- Revisit on each release: confirm every "Completed" item still exists at its cited path.
- Promote "Bribe marketplace frontend" to Completed once the UI page lands.
