# Akitai Pinata agent

Fresh OpenClaw agent for the **Akitai / Keepr** reply brain (`AKITAI_PINATA_*`).
This lane is used by `frontend/server/ai/chat.ts` when env is set. It does **not**
replace Railway Eliza as the XMTP transport.

**Do not commit gateway tokens.** Set secrets in Vercel / local `frontend/.env` only.

## Current production agent

| Field | Value |
| --- | --- |
| Agent ID | `xpm64dc3` |
| Name | Akitai |
| Gateway base | `https://xpm64dc3.agents.pinata.cloud` |
| Chat HTTP endpoint | `https://xpm64dc3.agents.pinata.cloud/v1/chat` |
| Created | 2026-07-06 (replaced retired Hermit agent `x6bk3ima`) |

Retrieve gateway token:

```bash
pinata agents get xpm64dc3
```

## Vercel / local env

```bash
AKITAI_PINATA_CHAT_ENDPOINT=https://xpm64dc3.agents.pinata.cloud/v1/chat
AKITAI_PINATA_BEARER_TOKEN=<gatewayToken from agents get>
# optional:
# AKITAI_PINATA_HTTP_TIMEOUT_MS=30000
```

Redeploy Vercel production after updating env.

## Attached secrets (Pinata agent)

Akitai only needs **model + optional IPFS** inside the container:

| Secret | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | OpenClaw model calls |
| `PINATA_JWT` | optional | `@pinata/api` skill only |
| `PRIVATE_KEY` | optional | Operator EOA `0x64c3Fb828bD2A8cDe9Cde14d0295D34916bb94e9` only — **not** the canonical CSW (`0xAb6d5…967b5`). Attach only if a skill explicitly needs EOA signing; keep chat replies read-only by default. |

**Do not attach** Hermit4626 / AlfaClub bridge secrets to this agent (`ALFACLUB_*`,
`CRON_SECRET`, `DATABASE_URL`, `SUPABASE_*`). Those stay on Vercel crons and the
Hermit creative lane — not inside Pinata Akitai.

Detach legacy copies (secret IDs from `pinata agents get xpm64dc3`):

```bash
pinata agents secrets detach xpm64dc3 <secret-id>
pinata agents restart xpm64dc3
```

Fresh create should attach only:

```bash
pinata agents create ... \
  --secret d0f32ac3-630f-4720-bd98-72e241bb38ec \  # OPENAI_API_KEY
  --secret 10020373-5863-462f-bf6e-4ea58ca9f210     # PINATA_JWT (optional)
```

## Workspace sync (repo → Pinata)

Repo mirror: `frontend/server/_lib/akita/workspace/`

```bash
export AKITAI_PINATA_BEARER_TOKEN=<gateway token>
bash frontend/scripts/akita-seed-sync.sh verify-workspace
bash frontend/scripts/akita-seed-sync.sh push-pinata
pinata agents restart xpm64dc3
```

## Model boot

Prefer **`openai/gpt-4.1-mini`** until the agent is stable. Change in Pinata UI
(Agents → Akitai → model) if CLI `agents config set` returns Zod errors.

## Plan limit

Pinata account allows **one agent**. Creating Akitai required deleting the old
Hermit agent (`x6bk3ima`). Hermit **creative** (`/hermit`, `/meme`) stays on
Vercel `POST /api/hermit/draft` — not this Pinata agent.

## Recreate from scratch

1. `pinata agents create` with Akitai metadata (see `akita-pinata-manifest.json`).
2. Attach **only** `OPENAI_API_KEY` (+ optional `PINATA_JWT`) — not Hermit/AlfaClub secrets.
3. Push workspace via `akita-seed-sync.sh push-pinata`.
4. Update `AKITAI_PINATA_*` everywhere the old agent ID appeared.
