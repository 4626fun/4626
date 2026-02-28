# OpenBB Market Data (Self-Hosted) Runbook

This repo can fetch market data inside XMTP group chats via OpenBB’s FastAPI service (`openbb-api`). The agent calls OpenBB over HTTP and formats results for `/mkt …` commands.

## What We Added

### Chat commands

- `/mkt help`
- `/mkt quote <symbol>`
- `/mkt news <symbol> [limit]`
- `/mkt ratios <symbol>`
- `/mkt calendar [today|week|YYYY-MM-DD..YYYY-MM-DD]`
- `/mkt chart <symbol> [1w|1m|3m|1y|YYYY-MM-DD..YYYY-MM-DD]`

### Agent config (this repo)

Set these env vars for the agent runtime:

- `OPENBB_API_BASE_URL` (required) Example: `http://openbb:6900`
- `OPENBB_API_TOKEN` (optional) Bearer token for a reverse proxy / gateway in front of OpenBB

## Running OpenBB API Locally

Install OpenBB and run its API server:

```bash
pip install "openbb[all]"
openbb-api --host 0.0.0.0 --port 6900
```

Smoke test (FastAPI defaults):

- API docs: `http://localhost:6900/docs`
- OpenAPI schema: `http://localhost:6900/openapi.json`

Then point the agent at it:

```bash
export OPENBB_API_BASE_URL="http://localhost:6900"
```

## Running Alongside the Agent (Docker / Railway)

The agent process in this repo is designed to be long-lived (`frontend/Dockerfile.agent`). In production you typically run:

- OpenBB as its own service/container (private network)
- The 4626 agent as its own service/container

When both are on the same private network, use the OpenBB service name as the host:

- `OPENBB_API_BASE_URL=http://openbb:6900`

## Provider Keys (Ratios / Calendar)

Some endpoints can work with free sources, but others usually require provider credentials to be configured on the OpenBB server.

Examples of common provider keys:

- `FMP_API_KEY` (Financial Modeling Prep)
- `INTRINIO_API_KEY`
- `TRADINGECONOMICS_API_KEY`

OpenBB supports reading provider keys from a `.env` file as environment variables. See:

- https://docs.openbb.co/platform/settings/environment_variables

Important: these provider keys belong on the OpenBB service (Python) environment, not inside this Node/TS repo.

## Security Notes

- `openbb-api` is typically unauthenticated by default. Keep it on a private network.
- If you need access control, put OpenBB behind a reverse proxy that enforces a bearer token, and set `OPENBB_API_TOKEN` in the agent runtime.

