# KPR Runbook (4626)

## Prerequisites

- Node.js and npm installed
- Bun installed
- Working directory: repo root (`<repo-root>`, i.e. wherever you cloned the repository — e.g. `$REPO_ROOT` exported from your shell)

Verify the local toolchain before doing anything else:

```bash
node -v
npm -v
pnpm -C kpr -v
```

If `pnpm` is not found, install pnpm before continuing.

## Fresh Machine Bootstrap

```bash
# Run from an existing checkout of this repository:
# cd <repo-root>     # e.g. $REPO_ROOT, set to your local clone path
pnpm -C kpr install
cp kpr/kpr-workflows/.env.example kpr/kpr-workflows/.env
cp kpr/secrets.example.env kpr/.env
cp frontend/.env.example frontend/.env.local
```

Minimum required for local simulation:

- `KPR_ETH_PRIVATE_KEY`
- `KPR_API_KEY_VALUE`
- `KPR_API_BASE_URL_VALUE`
- `KPR_PRIVATE_KEY_VALUE`

## Simulate

### Validate + typecheck first

```bash
bash kpr/kpr-workflows/scripts/validate-workflow-layout.sh
bash kpr/kpr-workflows/scripts/typecheck-workflows.sh
```

### Simulate all workflows (local-simulation)

```bash
KPR_SIMULATION_ENABLED=true bash kpr/kpr-workflows/scripts/simulate-workflows.sh
```

### Runtime orchestration workflows

The KPR runtime workflow lane (`runtime-indexer-*`, `runtime-reference-feeds`, `runtime-orchestrator`) is retired and no longer simulated or deployed.

### Engine logs (debug mode)

```bash
pnpm -C kpr run start -- <workflow-name>
```

### Non-interactive trigger selection

```bash
pnpm -C kpr run start -- <workflow-name>
```

- `trigger-index 0` is cron for all current workflows.
- For script-based runs:
  - `KPR_ENGINE_LOGS=true` enables engine logs
  - `KPR_TRIGGER_INDEX=<n>` overrides trigger index

## Run modes

```bash
# Run one workflow
pnpm -C kpr run start -- <workflow-name>

# Run all
pnpm -C kpr run start

# Dry-run all
pnpm -C kpr run dry-run
```

## Secrets

Use `kpr/.env` (copied from `kpr/secrets.example.env`) for local secrets.

Workflow mapping file: `kpr/kpr-workflows/secrets.yaml`

## Troubleshooting

- **`pnpm: command not found`**
  - Install pnpm and re-run the command
- **`git clone` fails with proxy / CONNECT / 403**
  - The machine cannot reach GitHub directly
  - Use a machine with normal outbound access or a pre-existing checkout
- **Simulation fails with config/paths**
  - Run `bash kpr/kpr-workflows/scripts/validate-workflow-layout.sh`
- **Type errors across shared modules**
  - Run `bash kpr/kpr-workflows/scripts/typecheck-workflows.sh`
  - Ensure root shared dependency install succeeds in `kpr/kpr-workflows`
- **HTTP-trigger workflows need manual replay**
  - Fixtures are in `kpr/kpr-workflows/fixtures/http/`
    - `ajna-bucket-manager.manual.json`
    - `charm-rebalance-manager.manual.json`
    - `solana-orchestrator.manual.json`
  - CLI payload file paths are resolved relative to the selected workflow folder.
  - Use:
    - `pnpm -C kpr run start -- ajna-bucket-manager`
    - `pnpm -C kpr run start -- charm-rebalance-manager`
    - `pnpm -C kpr run start -- solana-orchestrator`
  - Add `--engine-logs` when diagnosing payload/trigger issues.
- **Log trigger not firing**
  - Verify watched addresses in `strategy-signal-listener/config.*.json`
  - Confirm chain selector in `project.yaml` and workflow `chainName` alignment
- **Charm rebalance appears duplicated / racing**
  - Verify `CHARM_REBALANCE_CANONICAL_MODE=queue` (default)
  - In canonical mode, Charm actions should be produced by `strategy-signal-listener` and executed by `keepr-action-queue`
  - Use `CHARM_REBALANCE_CANONICAL_MODE=direct` only for explicit emergency/manual override
- **Solana reconcile path not executing**
  - Check `/api/keeper/solana/reconcile` auth header (`Bearer KPR_API_KEY`)
  - Verify `SOLANA_ORCHESTRATOR_URL` is configured
  - Inspect checkpoint table `keepr_workflow_checkpoints` for status (`completed`, `already_processed`, `failed`)
