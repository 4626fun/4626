# CRE Runbook (4626)

## Prerequisites

- Node.js and npm installed
- CRE CLI installed and available in `PATH`
- CRE CLI authenticated (`cre login`) when required
- Bun installed
- Working directory: repo root (`<repo-root>`, i.e. wherever you cloned the repository — e.g. `$REPO_ROOT` exported from your shell)

Verify the local toolchain before doing anything else:

```bash
node -v
npm -v
cre version
```

If `cre` is not found, install the official Chainlink CRE CLI before continuing.  
Do not rely on `npx cre` in locked-down environments, since registry access may be blocked.

## Fresh Machine Bootstrap

```bash
# Run from an existing checkout of this repository:
# cd <repo-root>     # e.g. $REPO_ROOT, set to your local clone path
npm --prefix cre install
cp cre/cre-workflows/.env.example cre/cre-workflows/.env
cp cre/secrets.example.env cre/.env
cp frontend/.env.example frontend/.env.local
```

Minimum required for local simulation:

- `CRE_ETH_PRIVATE_KEY`
- `KPR_API_KEY_VALUE`
- `KPR_API_BASE_URL_VALUE`
- `KPR_PRIVATE_KEY_VALUE`

## Simulate

### Validate + typecheck first

```bash
bash cre/cre-workflows/scripts/validate-workflow-layout.sh
bash cre/cre-workflows/scripts/typecheck-workflows.sh
```

### Simulate all workflows (local-simulation)

```bash
CRE_SIMULATION_ENABLED=true bash cre/cre-workflows/scripts/simulate-workflows.sh
```

### Runtime orchestration workflows

The CRE runtime workflow lane (`runtime-indexer-*`, `runtime-reference-feeds`, `runtime-orchestrator`) is retired and no longer simulated or deployed.

### Engine logs (debug mode)

```bash
cre workflow simulate <workflow-name> --target local-simulation --engine-logs
```

### Non-interactive trigger selection

```bash
cre workflow simulate <workflow-name> --target local-simulation --non-interactive --trigger-index 0
```

- `trigger-index 0` is cron for all current workflows.
- For script-based runs:
  - `CRE_ENGINE_LOGS=true` enables engine logs
  - `CRE_TRIGGER_INDEX=<n>` overrides trigger index

## Deploy

```bash
cd cre/cre-workflows
cre workflow deploy <workflow-name> --target staging-settings
cre workflow deploy <workflow-name> --target production-settings
```

Capture returned workflow IDs and store them in ops metadata.

## Activate

```bash
cre workflow activate <workflow-id>
```

## Update

```bash
cre workflow update <workflow-id> --workflow-file <path/to/workflow.yaml> --target <target-name>
```

After update, verify whether workflow ID changed. If yes, update any allowlists/consumers that validate workflow identity.

## Pause

```bash
cre workflow pause <workflow-id>
```

## Delete

```bash
cre workflow delete <workflow-id>
```

## Secrets

```bash
cre secrets set KPR_API_KEY
cre secrets set KPR_API_BASE_URL
cre secrets set KPR_PRIVATE_KEY
```

Workflow mapping file: `cre/cre-workflows/secrets.yaml`

## Troubleshooting

- **`cre: command not found`**
  - Install the official Chainlink CRE CLI and make sure it is available in `PATH`
  - Re-run `cre version` before attempting simulation
- **`npx cre` fails**
  - This usually means npm registry access is blocked or restricted
  - Use the official CLI install path instead of registry fallback
- **`git clone` fails with proxy / CONNECT / 403**
  - The machine cannot reach GitHub directly
  - Use a machine with normal outbound access or a pre-existing checkout
- **Simulation fails with config/paths**
  - Run `bash cre/cre-workflows/scripts/validate-workflow-layout.sh`
- **Type errors across shared modules**
  - Run `bash cre/cre-workflows/scripts/typecheck-workflows.sh`
  - Ensure root shared dependency install succeeds in `cre/cre-workflows`
- **HTTP-trigger workflows need manual replay**
  - Fixtures are in `cre/cre-workflows/fixtures/http/`
    - `ajna-bucket-manager.manual.json`
    - `charm-rebalance-manager.manual.json`
    - `solana-orchestrator.manual.json`
  - CLI payload file paths are resolved relative to the selected workflow folder.
  - Use:
    - `cre workflow simulate ajna-bucket-manager --target local-simulation --non-interactive --trigger-index 1 --http-payload @../fixtures/http/ajna-bucket-manager.manual.json`
    - `cre workflow simulate charm-rebalance-manager --target local-simulation --non-interactive --trigger-index 1 --http-payload @../fixtures/http/charm-rebalance-manager.manual.json`
    - `cre workflow simulate solana-orchestrator --target local-simulation --non-interactive --trigger-index 1 --http-payload @../fixtures/http/solana-orchestrator.manual.json`
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
