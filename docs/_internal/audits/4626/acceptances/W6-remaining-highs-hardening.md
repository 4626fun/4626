# Acceptance: W6 — Remaining HIGH hardening (2026-07-22)

- **Status:** Fixed (strategy-caps dilution = accept-risk)
- **Source:** Codex intake 2026-07-22

## Fixed

- AMOE retry debit / broadcasting before relay
- Stripe unpaid pending no longer grants Phase3/feature keys
- Devnet cost probe no longer spills env key material to `/tmp`
- Safe exec script: exclude owner pk from hash args; bind Safe + recompute hash
- `/ipfs/*` redirects off `4626.fun` origin to `pinata.4626.fun`
- `scripts/launch.sh` scrubs secrets from install/build
- Supabase RLS forward migration for agent_memory / wallet_intel / feedback / episodic
- Seed script rejects placeholder API keys when `EXECUTE=1`
- Payout router harvest plan does not set min-out from quote alone
- `OVaultLPManager.seedRebalance` runs `checkCanRebalance()` TWAP/boundary checks

## Accept-risk

- Strategy caps underprice/dilution: no small safe deposit fail-closed hook without broader vault semantics change.
