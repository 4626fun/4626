# 4626 Chainlink Submission: Required Env Vars and Secrets

This file is the single source of truth for environment variables and secrets needed to run the 4626 Chainlink hackathon submission flows.

## Scope

This covers:
- CRE CLI local simulation for hackathon workflows
- Mock bridge server used in demo runs
- Optional "real API bridge" mode for runtime endpoints

It does **not** include every production variable in the full 4626 stack.

## Fresh-Machine Prerequisites

Before copying any env vars, make sure the machine has:

- Node.js and npm installed
- the official Chainlink CRE CLI installed and available in `PATH`
- a working outbound network path for:
  - cloning the repo
  - CRE authentication (`cre login`)
  - any package installs needed by the repo

Verify before continuing:

```bash
node -v
npm -v
cre version
```

If `cre` prints `command not found`, stop here and install the official CRE CLI first.  
Do **not** assume `npx cre` will work, since restricted environments may block npm registry access.

## Fresh-Machine Setup Order

Run these in order on a new machine:

```bash
git clone https://github.com/4626fun/convergence-chainlink-hackathon.git
cd convergence-chainlink-hackathon
npm --prefix cre install
cp cre/cre-workflows/.env.example cre/cre-workflows/.env
cp cre/secrets.example.env cre/.env
cp frontend/.env.example frontend/.env.local
```

Then:

1. Paste the required values into `cre/cre-workflows/.env`
2. Optionally paste `cre/.env` and `frontend/.env.local` if using the real bridge
3. Run the preflight check below
4. Start the mock bridge
5. Run `cre workflow simulate ...`

## Known Environment Blockers

The most common reasons setup fails on a fresh machine are:

- `cre` CLI is not installed or not in `PATH`
- outbound proxy/firewall blocks:
  - GitHub clone
  - CRE auth
  - npm registry access

If those restrictions exist, the workflow configuration can still be valid, but simulations will not execute until the machine can install and run the official CLI.

## Where To Set Variables

- `cre/cre-workflows/.env` -> CRE workflow simulation secrets (mapped from `cre/cre-workflows/secrets.yaml`)
- shell env before running mock server -> mock bridge overrides
- `frontend/.env` or `frontend/.env.local` -> only if you run real API bridge handlers locally

---

## 1) Required for Hackathon Demo Simulations (Minimum)

Set these in `cre/cre-workflows/.env`:

| Variable | Required | Why |
|---|---|---|
| `CRE_ETH_PRIVATE_KEY` | Yes | CRE CLI account key for local workflow simulation/auth context |
| `KEEPR_API_KEY_VALUE` | Yes | Secret mapped to `KEEPR_API_KEY` in CRE workflows; used for Bearer auth |
| `KEEPR_API_BASE_URL_VALUE` | Yes | Secret mapped to `KEEPR_API_BASE_URL` (use mock API URL for demo) |
| `KEEPR_PRIVATE_KEY_VALUE` | Recommended | Needed by write-capable flows and parity with full setup |

Recommended local value for:
- `KEEPR_API_BASE_URL_VALUE=http://127.0.0.1:8789/api`

---

## 2) Mock Bridge Server Variables (Demo Path)

Used by `cre/scripts/hackathon/mock-cre-api-server.mjs`:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `CRE_MOCK_API_HOST` | No | `127.0.0.1` | Bind host |
| `CRE_MOCK_API_PORT` | No | `8789` | Bind port |
| `CRE_MOCK_API_KEY` | No | falls back to `KEEPR_API_KEY_VALUE` | If set, must match workflow Bearer token |
| `CRE_MOCK_SOLANA_STATUS` | No | `completed` | Optional solana reconcile behavior override |

---

## 3) Additional Secrets for Full Runtime-Orchestrator Paths

Only needed when you enable runtime sink/KV behavior (for example, `sinkEnabled=true` or `kvDisabled=false` in runtime orchestrator config):

Set in `cre/cre-workflows/.env`:

| Variable | Required when enabled | Why |
|---|---|---|
| `CRE_RUNTIME_WEBHOOK_HMAC_SECRET_VALUE` | Yes | Mapped HMAC secret for signed runtime bridge requests |
| `AWS_ACCESS_KEY_ID_VALUE` | Yes | Mapped AWS credential for S3 checkpoint reads/writes |
| `AWS_SECRET_ACCESS_KEY_VALUE` | Yes | Mapped AWS credential for S3 checkpoint reads/writes |

---

## 4) Real API Bridge Mode (Optional, Not Needed for Mock Demo)

If you use real frontend API handlers instead of the mock server, configure:

In `frontend/.env` or `frontend/.env.local`:

| Variable | Required | Why |
|---|---|---|
| `KEEPR_API_KEY` | Yes | Auth for `/api/cre/**` and `/api/keepr/**` endpoints |
| `CRE_RUNTIME_WEBHOOK_HMAC_SECRET` | Recommended | Runtime request signature validation |
| `CRE_RUNTIME_ENFORCE_HMAC` | Recommended (`true`) | Strict HMAC enforcement toggle |
| `CRE_RUNTIME_ALLOW_UNSIGNED_WHEN_HMAC_CONFIGURED` | Optional | Transitional compatibility only |
| `CRE_GATEWAY_URL` | Required for trigger endpoint | CRE gateway URL for `/api/cre/runtime/trigger` |
| `CRE_HTTP_TRIGGER_PRIVATE_KEY` (or `CRE_TRIGGER_SIGNER_PRIVATE_KEY`) | Required for trigger endpoint | Signing key for CRE trigger dispatch |
| `CRE_RUNTIME_ALLOWED_TRIGGER_WORKFLOW_IDS` | Optional | Comma-separated trigger allowlist |

---

## 5) Optional AI Provider Keys

Only needed if using real AI provider path (not required for mock AI response):

- `GROQ_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `ELIZA_LLM_PROVIDER_PRIORITY` (optional priority order)

---

## 6) Copy-Paste Template

`cre/cre-workflows/.env`:

```bash
CRE_ETH_PRIVATE_KEY=YOUR_CRE_ETH_PRIVATE_KEY_HEX_NO_0x
KEEPR_API_KEY_VALUE=YOUR_SHARED_KEEPR_API_KEY
KEEPR_API_BASE_URL_VALUE=http://127.0.0.1:8789/api
KEEPR_PRIVATE_KEY_VALUE=YOUR_KEEPER_PRIVATE_KEY_HEX_WITH_0x

# Enable only for full runtime sink/KV paths:
# CRE_RUNTIME_WEBHOOK_HMAC_SECRET_VALUE=YOUR_HMAC_SECRET
# AWS_ACCESS_KEY_ID_VALUE=YOUR_AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY_VALUE=YOUR_AWS_SECRET_ACCESS_KEY

# Optional AI providers:
# GROQ_API_KEY=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# OPENROUTER_API_KEY=
# ELIZA_LLM_PROVIDER_PRIORITY=Groq,OpenAI,Anthropic,OpenRouter
```

Optional mock server overrides:

```bash
# Optional
# export CRE_MOCK_API_HOST=127.0.0.1
# export CRE_MOCK_API_PORT=8789
# export CRE_MOCK_API_KEY=YOUR_SHARED_KEEPR_API_KEY
# export CRE_MOCK_SOLANA_STATUS=completed
```

---

## 7) Quick Preflight Check

From `cre/cre-workflows`:

```bash
set -a && source .env && set +a

for v in CRE_ETH_PRIVATE_KEY KEEPR_API_KEY_VALUE KEEPR_API_BASE_URL_VALUE; do
  if [ -z "${!v:-}" ]; then
    echo "missing: $v"
  else
    echo "ok: $v"
  fi
done
```

---

## 8) Security Notes

- Never commit `.env` files with real values.
- Never paste live secrets into docs, issues, or PR comments.
- Rotate secrets immediately if exposed.

