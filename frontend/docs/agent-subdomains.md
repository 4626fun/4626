# Agent Subdomains (4626.wei + *.4626.fun)

## What is implemented

- `POST /api/agents/subdomains/upsert`
  - Authenticated write endpoint (session/SIWA) or indexer write (`Bearer SUBDOMAIN_INDEXER_SECRET`)
  - Stores Grove metadata pointers + Lens identity hints
- `GET /api/agents/subdomains/resolve`
  - Resolves by `label`, `host`, or current request host
- `scripts/subdomain-indexer.ts`
  - Polls configured chain for `SubdomainRegistered` events
  - Calls `/api/agents/subdomains/upsert`
  - Persists cursor in Postgres (`agent_subdomain_indexer_state`)

## Required env

- `SUBDOMAIN_INDEXER_SECRET`
- `SUBDOMAIN_REGISTRAR_ADDRESS`
  - For 4626.wei registrar: `0x0000000000dd72ef1df17f527e719aee5ef71e64`
- `SUBDOMAIN_PARENT_ID` (default `0`)
- `SUBDOMAIN_PARENT_DOMAIN` (default `4626.wei`)
- `AGENT_SUBDOMAIN_WEB_APEXES` (default `4626.fun,app.4626.fun`)
- `AGENT_SUBDOMAIN_RESERVED_LABELS` (default `www,app,api`)

Indexer-specific:

- `SUBDOMAIN_INDEXER_API_URL` (default `https://app.4626.fun/api/agents/subdomains/upsert`)
- `SUBDOMAIN_CHAIN_ID` (default `1`)
- `SUBDOMAIN_START_BLOCK` (default `0`, bootstrap at current block)
- `SUBDOMAIN_INDEXER_POLL_MS` (default `12000`)
- `SUBDOMAIN_INDEXER_CHUNK_SIZE` (default `2000`)
- `SUBDOMAIN_RPC_URL` (optional explicit override)
- Chain defaults:
  - chainId `1` -> `ETH_LOGS_RPC_URL` or `ETH_RPC_URL` or `https://ethereum-rpc.publicnode.com`
  - chainId `8453` -> `BASE_LOGS_RPC_URL` or `BASE_RPC_URL` or `https://mainnet.base.org`
- `DATABASE_URL` / `POSTGRES_URL`

## Run indexer

From `frontend/`:

```bash
pnpm subdomains:indexer
```

## DNS + Vercel

Wildcard domain is attached to the `4626` project.

Cloudflare still needs:

```txt
Type: A
Name: *
Value: 76.76.21.21
Proxy: DNS only (initially, until verified)
```

After propagation, `*.4626.fun` will resolve to Vercel and the app can map host -> subdomain record via `/api/agents/subdomains/resolve`.
