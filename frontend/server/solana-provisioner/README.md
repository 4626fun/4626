# Solana Dynamic Route Provisioner

Minimal external service for dynamic bridge-token -> Solana route provisioning.

This service is designed for VM/container runtimes where the bridge CLI is available on disk.

## Why this exists

`/api/deploy/setupSolanaOvaultMesh` in the app can auto-register Solana bridge tokens, but on serverless runtimes it cannot execute local bridge CLI paths.

Point `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL` to this service's `/provision` endpoint.
For Meteora auto-deposit payloads, point `METEORA_IX_PROVISIONER_URL` to `/meteora-ixs`
(or rely on automatic `/meteora-ixs` derivation from the dynamic-route URL).

Default 4626 Solana stack is **Meteora DLMM + Alpha Vault**.

## Endpoints

- `GET /healthz`
  - Returns runtime readiness (`cliExists`, `secretSet`, etc.)
- `POST /provision`
  - Bearer-authenticated
  - Runs `cli sol bridge wrap-token`
  - Verifies route scalar on Base
  - Returns `mintBytes32` (both top-level and inside `data`)
- `POST /meteora-ixs`
  - Bearer-authenticated
  - Builds Base bridge `Ix[]` payload for Meteora Alpha Vault `deposit(max_amount)`
  - Returns `meteoraAlphaVault` (`bytes32`) + serialized `solanaIxs`

## Request contract (`POST /provision`)

```json
{
  "bridgeToken": "0x...",
  "deployEnv": "mainnet",
  "solanaDecimals": 9,
  "tokenName": "CreatorShare-1234",
  "tokenSymbol": "CS1234",
  "tokenSymbolFallback": "CS1234",
  "scalerExponent": 9,
  "payerKp": "config",
  "payForRelay": true
}
```

## Response contract (success)

```json
{
  "success": true,
  "mintBytes32": "0x...",
  "data": {
    "bridgeToken": "0x...",
    "mintPubkey": "...",
    "mintBytes32": "0x...",
    "routeScalar": "1"
  }
}
```

## Request contract (`POST /meteora-ixs`)

```json
{
  "creatorToken": "0x...",
  "bridgeToken": "0x...",
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
    "bridgeToken": "0x...",
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
2. Update values (especially `PROVISIONER_BEARER_TOKEN` and `SOLANA_BRIDGE_CLI_DIR`)
3. Start:
   - `pnpm solana-provisioner:start`

## Run from your workstation + Cloudflare Tunnel

Use this flow when the bridge CLI only exists on your own machine (for example
`/home/akitav2/projects/tools/base-bridge/scripts`) and not in a cloud VM.

1. Install `cloudflared`:

   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
     -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
   ```

2. Authenticate your Cloudflare account (opens browser):

   ```bash
   cloudflared tunnel login
   ```

3. Create the tunnel and DNS route:

   ```bash
   cloudflared tunnel create provisioner
   cloudflared tunnel route dns provisioner provisioner.4626.fun
   ```

4. Start provisioner on your workstation (terminal 1):

   ```bash
   cd ~/projects/4626/frontend
   PROVISIONER_BEARER_TOKEN=<set-long-random-token> \
   SOLANA_BRIDGE_CLI_DIR=/home/akitav2/projects/tools/base-bridge/scripts \
   BASE_RPC_URL=https://mainnet.base.org \
   npx tsx server/solana-provisioner/index.ts
   ```

5. Start the tunnel (terminal 2):

   ```bash
   cloudflared tunnel --url http://localhost:8788 run provisioner
   ```

Then set app runtime envs to your tunnel hostname:

- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL=https://provisioner.4626.fun/provision`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET=<same PROVISIONER_BEARER_TOKEN>`
- `METEORA_IX_PROVISIONER_URL=https://provisioner.4626.fun/meteora-ixs` (optional)
- `METEORA_IX_PROVISIONER_SECRET=<same PROVISIONER_BEARER_TOKEN>` (optional)

## Deploy on VM (systemd)

Pre-reqs:

- `pnpm` + Node installed on host
- bridge CLI repo available on disk
- this repo checked out on host (example: `/opt/4626`)

Deploy assets are under:

- `server/solana-provisioner/deploy/solana-route-provisioner.service`
- `server/solana-provisioner/deploy/solana-provisioner.env.example`
- `server/solana-provisioner/deploy/install-systemd.sh`

Install:

```bash
cd /opt/4626/frontend/server/solana-provisioner/deploy
sudo bash ./install-systemd.sh --repo-root /opt/4626 --service-user <repo-access-user> --env-dir /etc/4626
sudo editor /etc/4626/solana-provisioner.env
sudo systemctl restart solana-route-provisioner
sudo systemctl status solana-route-provisioner --no-pager
curl -fsS http://127.0.0.1:8788/healthz
```

Important:

- `--service-user` must be able to traverse/read your repo path.
- If repo is under `/home/<you>/...` and home perms are `750`, use your own user (for example `--service-user akitav2`) unless you changed ACLs.

## Reverse proxy examples

- Caddy template: `server/solana-provisioner/deploy/Caddyfile.example`
- Nginx template: `server/solana-provisioner/deploy/nginx.provisioner.conf.example`

Route only:

- `GET /healthz`
- `POST /provision`
- `POST /meteora-ixs`

## Wire app runtime

In the app server env (Vercel or otherwise):

- `SOLANA_DYNAMIC_ROUTE_ENABLED=1`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL=https://<host>/provision`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>`
- `METEORA_IX_PROVISIONER_URL=https://<host>/meteora-ixs` (optional; defaults from dynamic route URL)
- `METEORA_IX_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>` (optional)
- `DEPLOY_SOLANA_REGISTRATION_ORIGINS=https://4626.fun,https://<host-origin>` (optional for mixed Vercel + VM)
- `DEPLOY_SOLANA_REGISTRATION_SECRET=<shared-internal-secret>` (optional machine-to-machine auth)

Optional but recommended:

- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL=https://<host>/healthz` (for your external monitoring)
- `SOLANA_DEFAULT_BRIDGE_TOKEN=0x...` (enables scalar(route) validation in `/api/deploy/solanaInfraStatus`)
- `SOLANA_STRICT_SOL_PAIR=1` (enforce SOL-only quote mint; blocks helper-token pool paths)
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_RETRY_ATTEMPTS=3`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_RETRY_DELAY_MS=1200`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_TIMEOUT_MS=90000`
- `SOLANA_BRIDGE_WRAP_SYMBOL_MODE=auto` (`auto` | `unicode` | `ascii`)
- `PROVISIONER_MIN_PAYER_SOL=0.05` (health guardrail; `/healthz` reports payer readiness)

When `SOLANA_STRICT_SOL_PAIR=1`, `SOLANA_POOL_QUOTE_MINT` overrides are ignored and the
provisioner always uses wrapped SOL (`So11111111111111111111111111111111111111112`) as quote mint.

In the provisioner runtime (`server/solana-provisioner/.env`), enable retry for transient Solana RPC simulation failures:

- `PROVISIONER_WRAP_RETRY_ATTEMPTS=3`
- `PROVISIONER_WRAP_RETRY_DELAY_MS=1200`

## Security notes

- Always set `PROVISIONER_BEARER_TOKEN` to a long random value.
- Keep bearer secret values synchronized:
  - provisioner `PROVISIONER_BEARER_TOKEN`
  - app `SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET`
  - app `METEORA_IX_PROVISIONER_SECRET`
- Restrict inbound access at network layer (allowlist app egress IPs / private network).
- Do not expose shell access; this service only executes fixed CLI command paths with validated arguments.
