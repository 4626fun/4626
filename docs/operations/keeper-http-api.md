# Keeper HTTP API (post-CRE)

Legacy **`/api/cre/*`** routes and **`CRE_*`** rate-limit bucket names were removed in favor of:

| Surface | Prefix |
|--------|--------|
| Vault keeper triggers | `/api/keeper/*` |
| Keepr action queue | `/api/keepr/actions/*` |
| Job coordination | `/api/keeper/jobs/*` |
| Solana control plane | `/api/keeper/solana/reconcile` |

`keeper_jobs` `internal_api` payloads must use paths under those prefixes only. The worker rejects `/api/cre/*` with `internal_api_path_not_allowed`.

Rate limits (see `frontend/server/_lib/infra/rateLimit.ts`):

- `keeperTriggerWrite` — sweep, tend, report, solana reconcile, etc.
- `keeperDecisionsWrite` — jobs claim/complete, keepr actions
- `keeperIngestRead` / `keeperIngestWrite` — reserved for future ingest lanes

Env: use **`KPR_*`** in `kpr/secrets.example.env` and `kpr/kpr-workflows/.env.example`. Do not reintroduce `CRE_ETH_PRIVATE_KEY`, `CRE_ERC4337_*`, or `/api/cre/keeper/...` enqueue paths.
