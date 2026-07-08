# Railway protocol CSW cutover (4626-xmtp-primary)

Apply on the **4626-xmtp-primary** Railway project (`52c8340d-5b65-458a-b1b4-d51d0ff04675`), production environment, Eliza service.

## Required variables

```env
PROTOCOL_CSW_ADDRESS=0x793ca28123cba3ca3c20b9c6c67f37510c89c145
PROTOCOL_CSW_OWNER_INDEX=2
PROTOCOL_CSW_PRIVY_WALLET_ID=wyji2bc8j6sfcu5nilf4325h
# Optional if already set:
CANONICAL_CSW_PRIVY_WALLET_ID=wyji2bc8j6sfcu5nilf4325h
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
PRIVY_WALLET_AUTHORIZATION_KEY=...
AGENT_RUNTIME_ROLE=primary
AGENT_CONSUME_XMTP=true
XMTP_ENV=production
```

## Retire / do not use for agent sender

- Do **not** set `CANONICAL_CSW_ADDRESS` as the XMTP agent sender on Railway (that is the **operator** account).
- Retired: `XMTP_AGENT_CSW_*`, `VITE_AGENT_XMTP_ADDRESS`.

## Verify after redeploy

1. Startup logs show protocol CSW `0x793c…` (not `0xAb6d5…`).
2. `https://xmtp.chat/dm/0x793ca28123cba3ca3c20b9c6c67f37510c89c145` accepts DMs.
3. `/.well-known/agent-registration.json` XMTP endpoint matches protocol CSW.

## Service IDs (4626-xmtp-primary / production)

| Resource | ID |
|----------|-----|
| Project | `52c8340d-5b65-458a-b1b4-d51d0ff04675` |
| Environment | `1ba4dc4c-ae34-4002-9f0e-a969fe83465d` |
| Service (`4626-keepr-agent`) | `9c555f0f-fb94-4a89-8b32-197f3df73ddb` |

## CLI (when `railway login` / `RAILWAY_TOKEN` is valid)

```bash
railway variables set \
  PROTOCOL_CSW_ADDRESS=0x793ca28123cba3ca3c20b9c6c67f37510c89c145 \
  PROTOCOL_CSW_OWNER_INDEX=2 \
  PROTOCOL_CSW_PRIVY_WALLET_ID=wyji2bc8j6sfcu5nilf4325h \
  --project 52c8340d-5b65-458a-b1b4-d51d0ff04675 \
  --environment production \
  --service 4626-keepr-agent
```

If the CLI token is stale but `RAILWAY_TOKEN` in `frontend/.env` still works against GraphQL:

```bash
# Upsert vars
curl -sS https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation($input: VariableUpsertInput!){ variableUpsert(input:$input) }","variables":{"input":{"projectId":"52c8340d-5b65-458a-b1b4-d51d0ff04675","environmentId":"1ba4dc4c-ae34-4002-9f0e-a969fe83465d","serviceId":"9c555f0f-fb94-4a89-8b32-197f3df73ddb","name":"PROTOCOL_CSW_PRIVY_WALLET_ID","value":"wyji2bc8j6sfcu5nilf4325h"}}}'

# Redeploy
curl -sS https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation($serviceId:String!,$environmentId:String!){ serviceInstanceRedeploy(serviceId:$serviceId, environmentId:$environmentId) }","variables":{"serviceId":"9c555f0f-fb94-4a89-8b32-197f3df73ddb","environmentId":"1ba4dc4c-ae34-4002-9f0e-a969fe83465d"}}'
```

Local doctor check:

```bash
pnpm -C frontend exec tsx --env-file=.env scripts/agent/eliza-doctor.ts
# Expect: Protocol CSW signer config address=0x793c…
```

Full cutover smoke (on-chain + static mirror + Railway):

```bash
pnpm -C frontend exec tsx --env-file=.env scripts/ops/verify-protocol-csw-cutover.ts
```
