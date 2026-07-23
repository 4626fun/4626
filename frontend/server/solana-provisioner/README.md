# Solana Provisioner

Minimal external service for Solana-side helpers used by 4626 deploy/ops.

## Why this exists

This service supports:

- `GET /healthz` readiness
- `POST /meteora-ixs` (legacy Alpha Vault ix payloads when that lane still applies)
- optional extended endpoints (`/setup-creator`, `/create-pool`,
  `/send-lottery-oapp`, `/record-lottery-winner`) when enabled

Share-mesh creator wiring uses LayerZero OFT store + mint provisioning and
`Registry4626.setRemoteOFTPeerBytes32` — see
`docs/_internal/operations/operations/solana/solana-share-mesh-creator-provisioning.md`
and `docs/_internal/operations/solana/solana-share-mesh-budget-paths.md`.

For Meteora auto-deposit payloads, point `METEORA_IX_PROVISIONER_URL` to `/meteora-ixs`.

## Endpoints

- `GET /healthz`
  - Bearer-authenticated
  - Returns coarse runtime readiness (`secretSet`, payer readiness, RPC configuration,
    and whether extended mutation endpoints are enabled)
  - Detailed payer/source diagnostics are returned only when `PROVISIONER_HEALTH_DEBUG=1`
- `POST /meteora-ixs`
  - Bearer-authenticated
  - Builds an `Ix[]` payload for Meteora Alpha Vault `deposit(max_amount)`
  - Returns `meteoraAlphaVault` (`bytes32`) + serialized `solanaIxs`
- `POST /create-pool`
  - Bearer-authenticated and extended-endpoint gated
  - Requires an explicit `mode`: `b1` verifies a standard SPL share-mesh mint
    whose mint authority is owned by the regular OFT Store (lottery remains on
    Base); `b2` verifies the canonical Token-2022 TransferHook mint with zero
    transfer fee, the finalized Meteora admin `token_badge`, and all four
    finalized hook PDAs at canonical sizes before invoking the pool creator.
    `tokenMintY` must be the approved quote mint (WSOL by default). Missing or
    unknown modes fail closed as B2.
- `POST /send-lottery-oapp`
  - Bearer-authenticated and independently gated by
    `SOLANA_LOTTERY_OAPP_SEND_ENABLED=1`
  - Requires `Idempotency-Key` to equal the request's source-event digest
  - Verifies the deployed program, Store/peer ownership, exact on-chain Base
    peer, authorized Store operator/payer, request payload hash, and canonical
    LotteryManager bytes32
  - Quotes Endpoint V2, sends the raw V3 payload through the in-repo send-only
    OApp, finalizes the Solana transaction, and returns its LayerZero GUID
- `POST /record-lottery-winner`
  - separately gated by `SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED=1`
  - records the Base-authoritative result in the hook's one-shot WinId PDA and
    verifies finalized readback; an identical retry is idempotent and a
    conflicting replay fails closed

`POST /setup-creator` accepts `mint`, `hubCreatorCoin`, and `hubShareToken`.
The mint must already exist, be Token-2022 with the canonical TransferHook and
zero transfer fee, and still be controlled by the provisioner payer. The
script never creates a replacement mint; it either initializes the exact
mapped mint or returns an idempotent verified result.
Fresh setup also allowlists the canonical Meteora DLMM program (or the
explicit `SOLANA_METEORA_DLMM_PROGRAM_ID` override); an existing setup whose
allowlist does not contain that program fails closed rather than reporting a
buy-ready hook. Caller-supplied `ammPrograms` values are rejected unless they
resolve to that exact configured program.

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
- `SOLANA_METEORA_POOL_PROVISIONING_STALE_MS=330000` (optional; concurrent
  creation claim expiry, never honored below request timeout + 30 seconds)
- `METEORA_IX_PROVISIONER_URL=https://<host>/meteora-ixs`
- `METEORA_IX_PROVISIONER_URLS=https://<host-a>/meteora-ixs,https://<host-b>/meteora-ixs` (optional failover list; tried in order)
- `METEORA_IX_PROVISIONER_SECRET=<same as PROVISIONER_BEARER_TOKEN>`
- `SOLANA_HOOK_PROVISIONING_STALE_MS=330000` (optional; concurrent setup claim
  expiry, never honored below request timeout + 30 seconds)

The machine-auth provisioning endpoint atomically claims the creator hook row
and exact mint/quote pool row before calling a mutating provisioner endpoint.
A concurrent request returns `in_progress` and sends no duplicate mutation;
only an attempt older than the bounded timeout plus safety margin can be
reclaimed.

Optional but recommended:

- `SOLANA_STRICT_SOL_PAIR=1` (enforce SOL-only quote mint; blocks helper-token pool paths)
- `PROVISIONER_MIN_PAYER_SOL=0.05` (health guardrail; `/healthz` reports payer readiness)
- Provisioner requests are capped at 64 KB per request body
- `PROVISIONER_HEALTH_DEBUG=0` (set to `1` only for temporary diagnostics)
- `PROVISIONER_EXTENDED_ENDPOINTS=0` (leave disabled unless you intentionally need the B2 setup, pool, OApp-send, or winner-settlement endpoints)
- `SOLANA_LOTTERY_OAPP_SEND_ENABLED=0` (separate mutation gate; leave off until
  the B2 canary change window)
- `SOLANA_LOTTERY_OAPP_PROGRAM_ID=<reviewed deployed program>` (an env value is
  not readiness; the client verifies executable bytecode plus Store/peer PDAs)
- `SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY=<provisioner payer pubkey>`; the OApp
  rejects every send signer except this admin-controlled on-chain operator
- `SOLANA_OFT_PROGRAM_ID=<regular LayerZero OFT program>`; `/create-pool` refuses
  to mutate until the mapped mint authority is owned by this program
- `SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED=0` (separate mutation gate)

### Vultr deployment gate

The B2 API refuses to call a provisioner unless authenticated `/healthz`
reports `extendedEndpointsEnabled=true`. On the Vultr host, inspect the unit
with `systemctl cat solana-provisioner` and update the `EnvironmentFile` that
the active unit actually uses (some existing hosts use
`/opt/4626/provisioner.env`, while the clean install template uses
`/etc/4626/solana-provisioner.env`). The file must contain:

```text
PROVISIONER_EXTENDED_ENDPOINTS=1
SOLANA_LOTTERY_OAPP_SEND_ENABLED=0
SOLANA_LOTTERY_WINNER_SETTLEMENT_ENABLED=0
```

Deploy the reviewed source and restart only in an approved change window.
After the restart, run `pnpm -C frontend ops:preflight-solana-provisioner`;
an older health payload or a missing extended-endpoint field is a failed B2
gate, even when `payerHealthy=true`.

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

`POST /send-lottery-oapp` is an on-chain mutation. Enabling it is not part of a
read-only preflight. Before a devnet or mainnet call, record the payload digest,
quoted native fee, payer, OApp Store, Base peer, expected GUID/receipt, and the
rollback (`SOLANA_LOTTERY_OAPP_SEND_ENABLED=0`, submit worker off, creator relay
row disabled). Mainnet additionally requires the funded-canary approval in
`docs/operations/solana-b2-production-gates.md`.
