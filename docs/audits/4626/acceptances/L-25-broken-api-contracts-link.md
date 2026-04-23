# L-25 — `docs/contracts/index.md` broken `/api/contracts` link

- Finding: L-25 (Linear: 4626-373)
- Severity: Low
- Disposition: **Fixed** — broken link removed, replaced with pointer to NatSpec + GitHub source.

## Problem

`docs/contracts/index.md` (section "API Reference", line 32) linked to `/api/contracts`, an interactive contract explorer route. No such route exists in `frontend/api/` (see `ls frontend/api/` — the only contract-adjacent endpoints are `[...path].ts`, `agent-registration.ts`, etc.).

## Fix

The broken link was removed from `docs/contracts/index.md`. The section now directs readers to the NatSpec comments in `contracts/` and the canonical source tree on GitHub. When a published contract explorer exists, the section can be updated to point at it.

## Follow-ups

- If/when a contract-API explorer is shipped under `frontend/api/contracts/`, update this section with the real URL and restore the "interactive" phrasing.
