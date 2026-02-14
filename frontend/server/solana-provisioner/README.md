# Solana Dynamic Route Provisioner

Minimal external service for dynamic ShareOFT -> Solana route provisioning.

This service is designed for VM/container runtimes where the bridge CLI is available on disk.

## Why this exists

`/api/deploy/registerShareOft` in the app can auto-register ShareOFTs, but on serverless runtimes it cannot execute local bridge CLI paths.

Point `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL` to this service's `/provision` endpoint.

## Endpoints

- `GET /healthz`
  - Returns runtime readiness (`cliExists`, `secretSet`, etc.)
- `POST /provision`
  - Bearer-authenticated
  - Runs `cli sol bridge wrap-token`
  - Verifies route scalar on Base
  - Returns `mintBytes32` (both top-level and inside `data`)

## Request contract (`POST /provision`)

```json
{
  "shareOft": "0x...",
  "deployEnv": "mainnet",
  "solanaDecimals": 9,
  "tokenName": "CreatorShare-1234",
  "tokenSymbol": "CS1234",
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
    "shareOft": "0x...",
    "mintPubkey": "...",
    "mintBytes32": "0x...",
    "routeScalar": "1"
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

## Deploy on VM (systemd)

Pre-reqs:

- `pnpm` + Node installed on host
- bridge CLI repo available on disk
- this repo checked out on host (example: `/opt/creatorvault`)

Deploy assets are under:

- `server/solana-provisioner/deploy/solana-route-provisioner.service`
- `server/solana-provisioner/deploy/solana-provisioner.env.example`
- `server/solana-provisioner/deploy/install-systemd.sh`

Install:

```bash
cd /opt/creatorvault/frontend/server/solana-provisioner/deploy
sudo bash ./install-systemd.sh --repo-root /opt/creatorvault --service-user creatorvault
sudo editor /etc/creatorvault/solana-provisioner.env
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

## Wire app runtime

In the app server env (Vercel or otherwise):

- `SOLANA_DYNAMIC_ROUTE_ENABLED=1`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL=https://<host>/provision`
- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>`

Optional but recommended:

- `SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL=https://<host>/healthz` (for your external monitoring)
- `SOLANA_DEFAULT_SHARE_OFT=0x...` (enables scalar(route) validation in `/api/deploy/solanaInfraStatus`)

## Security notes

- Always set `PROVISIONER_BEARER_TOKEN` to a long random value.
- Restrict inbound access at network layer (allowlist app egress IPs / private network).
- Do not expose shell access; this service only executes fixed CLI command paths with validated arguments.
