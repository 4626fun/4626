# ACP Daily Market News Automation

This runbook automates daily ACP market-news jobs with:

- **Primary (07:00 UTC):** Otto AI `mega_report`
- **Checkpoint (13:00 UTC):** Laznek `market_pulse`
- **Fallback:** morning slot falls back to `market_pulse` if Otto create/fund fails

Execution is **assistive-only**: create + fund jobs, no autonomous trade execution.

## Files

- Runner: `scripts/ops/acp-daily-market-news-runner.sh`
- Workflow: `.github/workflows/acp-daily-market-news.yml`

## Required GitHub Secrets

- `ACP_ACCESS_TOKEN`
- `ACP_REFRESH_TOKEN`
- `ACP_OWNER_WALLET`
- `ACP_CLIENT_AGENT_ID`

`ACP_CLIENT_AGENT_ID` is the buyer/client agent used to create and fund jobs.

## Optional GitHub Variables

- `ACP_CHAIN_ID` (default `8453`)
- `ACP_OTTO_PROVIDER` (default `0x7457b799121c9b8c51298d08f1c19f0186648c90`)
- `ACP_OTTO_OFFERING` (default `mega_report`)
- `ACP_OTTO_REQUIREMENTS_JSON` (default `{"generate_mega_report":true}`)
- `ACP_OTTO_FUND_AMOUNT` (default `0.25`)
- `ACP_PULSE_PROVIDER` (default `0xec3a443b26f77f235df969767bbcbce57ddca910`)
- `ACP_PULSE_OFFERING` (default `market_pulse`)
- `ACP_PULSE_REQUIREMENTS_JSON` (default `{}`)
- `ACP_PULSE_FUND_AMOUNT` (default `0`)
- `ACP_FUND_CHECK_TIMEOUT_SECONDS` (default `180`)
- `ACP_FUND_CHECK_INTERVAL_SECONDS` (default `15`)

## Preflight Checklist

Before enabling cron:

1. Confirm signer exists on the client agent:
   - `acp agent add-signer --agent-id <ACP_CLIENT_AGENT_ID>`
2. Confirm wallet has spendable **Base USDC** for ACP funding:
   - `acp wallet balance --chain-id 8453 --json`
   - If funding errors with `ERC20: transfer amount exceeds balance`, top up USDC.
3. Run local dry run:
   - `scripts/ops/acp-daily-market-news-runner.sh --slot morning --dry-run`
4. Run local live check:
   - `scripts/ops/acp-daily-market-news-runner.sh --slot checkpoint`

## Manual Run (GitHub Actions)

Use **Actions -> ACP Daily Market News -> Run workflow**.

Inputs:

- `slot`: `morning` or `checkpoint`
- `dry_run`: `true` or `false`

## Failure Behavior

- Morning:
  - tries Otto `mega_report`
  - on create/fund failure, falls back to Pulse `market_pulse`
- Checkpoint:
  - runs Pulse only
- Workflow exits non-zero on hard failure (primary and fallback both fail).

## Troubleshooting

### `Not authenticated`

Refresh tokens/secrets:

- regenerate ACP session:
  - `acp configure`
- update `ACP_ACCESS_TOKEN` and `ACP_REFRESH_TOKEN` in GitHub secrets

### `transfer amount exceeds balance`

Top up **Base USDC** for the ACP client wallet; native gas balance alone is not sufficient for ACP job funding.

If a provider offering does not require funds, set its fund amount to `0` so the runner skips the budget step.

### `You do not have access to this agent`

The configured `ACP_CLIENT_AGENT_ID` belongs to a different ACP owner wallet/session. Reconfigure secrets with matching owner/session.
