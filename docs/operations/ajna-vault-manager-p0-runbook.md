# Ajna Vault Manager P0 Runbook

This runbook covers rollout and rollback for the P0 Ajna Vault Manager lane introduced for nested Ajna strategies:

- `CreatorOVault -> ERC4626StrategyAdapter -> AjnaERC4626Vault -> AjnaVaultAuth`
- `AjnaERC4626Vault.move*` is keeper-callable (`AUTH.isKeeper`) and pause-aware.
- Registry + automation uses `public.ajna_vaults`.

## Scope and invariants

- `deposit/mint/withdraw/redeem` remain swapper-only on `AjnaERC4626Vault`.
- Only `moveFromBuffer`, `moveToBuffer`, `move` are opened to `swapper OR keeper`.
- `move*` now enforces `notPaused`; `AjnaVaultAuth.pause()` is the hard stop.
- Automation status lives in `ajna_vaults.automation_status`:
  - `dry_run`: simulate + plan logging, no move tx broadcast.
  - `live`: simulate + execute move tx.
  - `paused`: no execution (manager returns skipped).
  - `halted`: no execution, reserved for explicit safety intervention.

## Relevant endpoints

- Rebalance execution:
  - `POST /api/keeper/ajna/rebalance`
- Queue fanout:
  - `GET|POST /api/keeper/jobs/enqueue-ajna-manager`
- Operator diagnostics:
  - `GET /api/deploy/v2/ajna/automation/status`
- Operator controls:
  - `POST /api/deploy/v2/ajna/automation/control`

## Required environment

- Keeper execution:
  - `KEEPR_API_KEY`
  - `KEEPR_PRIVATE_KEY`
  - `BASE_RPC_URL` (recommended non-public RPC)
- Enqueue scheduler:
  - `CRON_SECRET`
  - `KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED=true`
  - Optional: `KEEPER_AJNA_MANAGER_CHAIN_ID` (default `8453`)
  - Optional: `KEEPER_AJNA_MANAGER_LIMIT` (default `25`)

## Rollout procedure

1. **Deploy code + migration**
   - Apply migration: `supabase/migrations/20260512010000_ajna_vault_registry.sql`
   - Deploy app code with `KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED=false`
2. **Seed registry**
   - Confirm phase-3 session transitions are writing `ajna_vaults` rows.
   - Verify `automation_status` defaults to `paused`.
3. **Stage 1 (canary dry-run)**
   - For 1-2 vaults, call control endpoint and set:
     - `automationStatus = dry_run`
     - conservative `maxBucketStep` / `maxAssetsPerMove`
   - Trigger `enqueue-ajna-manager` and worker.
   - Validate status endpoint reflects `lastRunAt`, no tx hash, no lastError.
4. **Stage 2 (limited live)**
   - Flip selected canary vaults to `live`.
   - Keep strict `maxAssetsPerMove`.
   - Monitor tx success and revert profile.
5. **Stage 3 (expand)**
   - Move remaining allowlisted vaults from `paused` -> `dry_run` -> `live`.

## Halt and rollback

Fast rollback options, in order of blast radius:

1. **Per-vault stop (preferred)**
   - `POST /api/deploy/v2/ajna/automation/control` with `automationStatus = paused` (or `halted`).
2. **Global enqueue stop**
   - `KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED=false`.
3. **Contract-level emergency stop**
   - `AjnaVaultAuth.pause()` for affected vaults.

Rollback does not require deleting registry rows. Keep historical `last_error`, `last_success_tx`, and metadata for forensic analysis and controlled resume.

## Verification checklist

- `ajna_vaults` has expected chain/token/adapter rows.
- `status` endpoint enforces owner/admin auth and returns current automation config.
- `control` endpoint updates status + caps and writes metadata stamp.
- `enqueue-ajna-manager` produces deduped `internal_api` jobs.
- `POST /api/keeper/ajna/rebalance`:
  - skips when `paused|halted`
  - dry-runs in `dry_run`
  - simulates then broadcasts in `live`
  - persists `lastRunAt`, `lastSuccessTx`, and `lastError`.
