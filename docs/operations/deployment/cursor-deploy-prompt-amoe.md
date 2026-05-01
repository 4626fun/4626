# Cursor deploy prompt — AMOE rollout (rev 5)

> **Rev 5 note:** v1.10.1 supersedes the v1.9.x rollout in this doc; for the
> redeploy itself follow `cursor-deploy-prompt-v1.10.1.md`. This doc continues
> to govern the §0 → §3.0.5 AMOE rollout AFTER v1.10.1 broadcasts.

Use this prompt only after the v1.10.1 Base mainnet redeploy has completed and
the new addresses are recorded in
`docs/operations/deployment/releases/v1.10.1-mainnet.md`.

The operational source of truth for the AMOE rollout is
`docs/operations/deployment/amoe-flag-rollout-plan.md`.

Hard gates before resuming AMOE rollout:

- v1.10.1 broadcast complete.
- v1.10.1 addresses recorded in the release packet.
- AMOE selector-surface guard green on the new `CreatorLotteryManager`.
- `authorizedAmoeRelayer()` remains unset until the explicit §3.0.5 handoff.
- AMOE feature flags remain off until their rollout phase says otherwise.

When executing this prompt, follow the rollout plan in order and stop at every
checkpoint or owner-action boundary. Do not substitute legacy v1.8.3, v1.9.0,
or replacement-router addresses for the fresh v1.10.1 manager/router/verifier.
