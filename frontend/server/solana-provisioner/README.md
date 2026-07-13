# Solana Provisioner

Minimal external service for Solana-side helpers used by 4626 deploy/ops.

## Why this exists

This service supports:

- `GET /healthz` readiness
- `POST /meteora-ixs` (legacy Alpha Vault ix payloads when that lane still applies)
- optional extended endpoints (`/setup-creator`, `/create-pool`) when enabled

Share-mesh creator wiring uses LayerZero OFT store + mint provisioning and
`Registry4626.setRemoteOFTPeerBytes32` — see
`docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md`
and `docs/_internal/operations/solana/solana-share-mesh-budget-paths.md`.

For Meteora auto-deposit payloads, point `METEORA_IX_PROVISIONER_URL` to `/meteora-ixs`.

## Endpoints

- `GET /healthz`
  - Bearer-authenticated
  - Returns coarse runtime readiness (`secretSet`, payer readiness, RPC configuration)
  - Detailed payer/source diagnostics are returned only when `PROVISIONER_HEALTH_DEBUG=1`
- `POST /meteora-ixs`
  - Bearer-authenticated
  - Builds an `Ix[]` payload for Meteora Alpha Vault `deposit(max_amount)`
  - Returns `meteoraAlphaVault` (`bytes32`) + serialized `solanaIxs`

## Request contract (`POST /meteora-ixs`)

```json
{
  "creatorToken": "0x...",
  "meteoraAlphaVault": "<base58 pubkey>",
  "alphaVaultProgramId": "<base58 pubkey>",
  "expectedRemoteAmount": "1000000000",
  "depositAccounts": [
    { "pubkey": "<base58 pubkey>", "isSigner": false, "isWritable": true }
  ]
}
```

## Response contract (`POST /meteora-ixs`, success)

```json
{
  "success": true,
  "data": {
    "creatorToken": "0x...",
    "meteoraAlphaVault": "0x...",
    "expectedRemoteAmount": "1000000000",
    "solanaIxs": [
      {
        "programId": "0x...",
        "serializedAccounts": ["0x..."],
        "data": "0x..."
      }
    ]
  }
}
```


## Run locally

From `frontend/`:

1. Copy env:
   - `cp server/solana-provisioner/.env.example server/solana-provisioner/.env`
2. Update values, especially `PROVISIONER_BEARER_TOKEN` and the Solana payer/RPC settings.
3. Start:
   - `pnpm solana-provisioner:start`

## Wire app runtime

In the app server env (Vercel or otherwise):

- `SOLANA_PROVISIONER_HEALTH_URL=https://<host>/healthz`
- `SOLANA_HOOK_PROVISIONER_URL=https://<host>/setup-creator`
- `SOLANA_HOOK_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>`
- `SOLANA_METEORA_POOL_PROVISIONER_URL=https://<host>/create-pool`
- `SOLANA_METEORA_POOL_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>`
- `METEORA_IX_PROVISIONER_URL=https://<host>/meteora-ixs`
- `METEORA_IX_PROVISIONER_URLS=https://<host-a>/meteora-ixs,https://<host-b>/meteora-ixs` (optional failover list; tried in order)
- `METEORA_IX_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>`

Optional but recommended:

- `SOLANA_STRICT_SOL_PAIR=1` (enforce SOL-only quote mint; blocks helper-token pool paths)
- `PROVISIONER_MIN_PAYER_SOL=0.05` (health guardrail; `/healthz` reports payer readiness)
- Provisioner requests are capped at 64 KB per request body
- `PROVISIONER_HEALTH_DEBUG=0` (set to `1` only for temporary diagnostics)
- `PROVISIONER_EXTENDED_ENDPOINTS=0` (leave disabled unless you intentionally need `/setup-creator` or `/create-pool`)

When `SOLANA_STRICT_SOL_PAIR=1`, `SOLANA_POOL_QUOTE_MINT` overrides are ignored and the
provisioner always uses wrapped SOL (`So11111111111111111111111111111111111111112`) as quote mint.

## Security notes

- Always set `PROVISIONER_BEARER_TOKEN` to a long random value.
- Keep bearer secret values synchronized:
  - provisioner `PROVISIONER_BEARER_TOKEN`
  - app `SOLANA_HOOK_PROVISIONER_SECRET`
  - app `SOLANA_METEORA_POOL_PROVISIONER_SECRET`
  - app `METEORA_IX_PROVISIONER_SECRET`
- Keep the provisioner bound to loopback unless you are intentionally placing it behind a reverse proxy.
- Restrict inbound access at network layer (allowlist app egress IPs / private network).
- Do not expose shell access; this service only executes fixed CLI command paths with validated arguments.
