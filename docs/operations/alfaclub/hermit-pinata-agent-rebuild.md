# Hermit Pinata agent — delete and rebuild

Use this when Agent Hermit is stuck on `starting` with `Failed to load agent model` and
CLI `pinata agents config set` returns **Agent is not responding**.

**Do not commit secrets.** Attach secrets by ID in Pinata UI or CLI; manifest lists names only.

## 1. Save this as `manifest.json` (upload to `/home/node/clawd/manifest.json` after create, or paste in Pinata UI)

```json
{
  "$schema": "https://agents.pinata.cloud/schemas/manifest.v1.json",
  "version": 1,
  "agent": {
    "name": "Agent Hermit",
    "description": "A read-only AlfaChat creative companion for meme copy, image prompts, announcements, quest/reward text, and tone rewrites. It must not execute wallet, trading, deploy, or filesystem mutation tasks.",
    "vibe": "Hermit is a playful crypto-native meme copywriter for AlfaChat: concise, funny, JSON-friendly, and safely read-only.",
    "emoji": "🐈‍⬛"
  },
  "model": {
    "primary": "openai/gpt-4.1-mini"
  },
  "skills": [
    { "cid": "bafybeigfukjsrtuuuwbshp5nr5qme5ndvc7t7e54dixuzeobxyyaycwifu", "name": "memory-salience" },
    { "cid": "bafybeieerrctaycitdctw57t4ov5welowxt3idxojpy6qnq23wlbyqgyou", "name": "@pinata/api" },
    { "cid": "bafybeigum5juaj7faldszh7fpc6j2w23susjajvtzh6nh7vgi2eoiyvzf4", "name": "@pinata/erc-8004" },
    { "cid": "bafybeiergfzuvxxlozrmtuh6vddst6pn7ffsjfl6khwaclyvlg6sokfjp4", "name": "paraspace" },
    { "cid": "bafybeicglyjdb6wrrcbfyu6i2fe4lpxdxgvfvlht7yzdim7cvwt656whue", "name": "@pinata/platform" },
    { "cid": "bafybeifav7f7oaaispwrim74jseeyc6hlwoz6wtnn4fhkepayfedg6qj64", "name": "pinata-sqlite-sync" },
    { "clawhub_slug": "self-improving-agent", "name": "self-improving-agent" }
  ],
  "secrets": [
    { "name": "OPENAI_API_KEY", "required": true },
    { "name": "ALFACLUB_API_KEY", "required": false },
    { "name": "ALFACLUB_CHAT_API_BASE_URL", "required": false },
    { "name": "ALFACLUB_CHAT_API_PROXY_SECRET", "required": false },
    { "name": "ALFACLUB_CHAT_API_PROXY_URL", "required": false },
    { "name": "ALFACLUB_CHAT_BRIDGE_ENABLED", "required": false },
    { "name": "ALFACLUB_CHAT_ROOM_ID", "required": false },
    { "name": "CRON_SECRET", "required": false },
    { "name": "DATABASE_URL", "required": false },
    { "name": "PINATA_GATEWAY", "required": false },
    { "name": "PINATA_GATEWAY_URL", "required": false },
    { "name": "PINATA_JWT", "required": false },
    { "name": "SUPABASE_SERVICE_ROLE_KEY", "required": false },
    { "name": "SUPABASE_URL", "required": false }
  ],
  "channels": {
    "telegram": {
      "enabled": true
    }
  }
}
```

After status is **`running`**, change model to `openai/gpt-5.3` in Pinata UI only if boot succeeds.

## 2. Create agent (CLI)

From repo root, with Pinata CLI authenticated (`pinata auth <JWT>`):

```bash
PINATA=/home/akitav2/.local/share/pinata/pinata

$PINATA agents create \
  --name "Agent Hermit" \
  --description "A read-only AlfaChat creative companion for meme copy, image prompts, announcements, quest/reward text, and tone rewrites. It must not execute wallet, trading, deploy, or filesystem mutation tasks." \
  --vibe "Hermit is a playful crypto-native meme copywriter for AlfaChat: concise, funny, JSON-friendly, and safely read-only." \
  --emoji "🐈‍⬛" \
  --skill bafybeigfukjsrtuuuwbshp5nr5qme5ndvc7t7e54dixuzeobxyyaycwifu \
  --skill bafybeieerrctaycitdctw57t4ov5welowxt3idxojpy6qnq23wlbyqgyou \
  --skill bafybeigum5juaj7faldszh7fpc6j2w23susjajvtzh6nh7vgi2eoiyvzf4 \
  --skill bafybeiergfzuvxxlozrmtuh6vddst6pn7ffsjfl6khwaclyvlg6sokfjp4 \
  --skill bafybeicglyjdb6wrrcbfyu6i2fe4lpxdxgvfvlht7yzdim7cvwt656whue \
  --skill bafybeifav7f7oaaispwrim74jseeyc6hlwoz6wtnn4fhkepayfedg6qj64 \
  --secret 543b5319-3608-4738-a7bd-950f45c9d3c6 \
  --secret 02fb8f9b-4047-4f2a-bb84-f722e9daa98d \
  --secret b086b4c7-4710-4d33-9eb7-007b7b7a913b \
  --secret 2fbe9f63-4eed-4f94-b108-27414976e59d \
  --secret ba5946c5-f947-402e-9e35-26b7e7dae530 \
  --secret 6f4b8a3d-de90-46c0-ba29-4496e701b11c \
  --secret 9a1b6c99-4b15-43e7-8988-47806fa0ea47 \
  --secret 578205ae-6360-4ef0-a100-31263e36e8b1 \
  --secret 43a5b69e-fe81-41d4-af83-fc5232ac6e0f \
  --secret 79a2c94f-3a1b-4451-8789-30dd45ae00e7 \
  --secret cfaaffa8-bce2-4cd7-9983-073fb3f6f210 \
  --secret 10020373-5863-462f-bf6e-4ea58ca9f210 \
  --secret b6feb22f-2ab3-41e8-88a4-471e235169ee \
  --secret 1fae1a03-df4b-474f-b7ad-920dfe6d42b1
```

Note the old agent had `self-improving-agent` attached via ClawHub slug, not a CID. After create:

```bash
$PINATA agents clawhub install self-improving-agent
# then attach to the new agent ID via UI or agents skills attach
```

Or install from the agent page in [agents.pinata.cloud](https://agents.pinata.cloud).

## 3. Wire 4626 after create

```bash
$PINATA agents get <NEW_AGENT_ID>
```

Copy **gateway token** and base URL (`https://<id>.agents.pinata.cloud`), then set in `frontend/.env` (and Vercel):

- `HERMIT_PINATA_CHAT_ENDPOINT` — chat URL from Pinata (agent settings)
- `HERMIT_PINATA_BEARER_TOKEN` — gateway token from `agents get`

Redeploy or restart the API surface that runs `skillRouter`.

## 4. Restore workspace seeds

```bash
bash frontend/scripts/hermit-seed-sync.sh verify-local
bash frontend/scripts/hermit-seed-sync.sh tar /tmp/hermit-seed.tar.gz
```

Upload/extract into `/home/node/clawd/workspace/` on the new agent, then **Restart Gateway**.

See also: [`hermit-pinata-spanish.md`](hermit-pinata-spanish.md), [`alfaclub-creative-architecture.md`](alfaclub-creative-architecture.md).

## 5. Delete old agent (optional)

**Done (2026-06-14):** replaced `x7lmjaxx` with **`x6bk3ima`** (`https://x6bk3ima.agents.pinata.cloud`) during a single-agent-plan destructive rebuild. Update Vercel `HERMIT_PINATA_*` + `GATEWAY_TOKEN` to match `pinata agents get x6bk3ima` if production still points at the old id.
