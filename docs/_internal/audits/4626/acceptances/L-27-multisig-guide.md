# L-27 — `docs/operations/deployment/multisig/guide.md` stub status

- Finding: L-27 (Linear: 4626-375)
- Severity: Low
- Disposition: **Accepted (acknowledged) / partial fix documented** — the current guide is short (524 bytes) but not a bare heading stub. It already covers Safe setup, transaction execution, and recommended signer/threshold configuration. Expansion to include key custody and post-signing verification is tracked as a follow-up.

## Current state (verified)

`docs/operations/deployment/multisig/guide.md` contains:
- Safe creation steps (pointing at [safe.global](https://safe.global))
- Signer addition + threshold configuration (with 2/3 or 3/5 recommendation)
- Execution flow (create → collect signatures → execute)
- A recommended-configuration table (Signers: 3-5, Threshold: 2/3 or 3/5, Owner: Safe address)

That is actionable for an operator who already owns a Safe. The finding's characterization ("heading + placeholder only") predates the current content.

## Remaining gaps (tracked, not blocking)

The following items are **not** yet in the guide and should be added as operational procedures mature:
- Key custody guidance (hardware wallet recommendation, backup procedure, signer onboarding/offboarding checklist)
- Concrete CLI command examples for `safe-cli` / Safe Transaction Service
- Emergency-response runbook (pause vault, replace keeper) with precise function-signature references
- Post-signing verification steps (tx-hash comparison, event-log spot checks, independent simulation)

These items depend on the production multisig deployment being finalized, which is a Phase-B/C concern per the deployment plan.

## Why not fixed now

Writing authoritative multisig procedures before the production Safe addresses, threshold, and signer roster are finalized would bake-in assumptions that are likely to be revised. The minimal current guide is sufficient to prevent an operator from being wholly unable to act; the remaining gaps are tracked here and in 4626-375 for completion alongside mainnet deployment.

## Follow-ups

- Reopen 4626-375 or a new operational-docs ticket when the production multisig is stood up to capture the concrete signer roster and runbook.
