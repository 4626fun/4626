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

## CLI (when `railway login` / `RAILWAY_TOKEN` is valid)

```bash
railway variables set \
  PROTOCOL_CSW_ADDRESS=0x793ca28123cba3ca3c20b9c6c67f37510c89c145 \
  PROTOCOL_CSW_OWNER_INDEX=2 \
  --project 52c8340d-5b65-458a-b1b4-d51d0ff04675 \
  --environment production \
  --service <eliza-service-id>
```

Then redeploy the Eliza service.
