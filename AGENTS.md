# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

4626 (4626.fun) is a monorepo with two primary dev loops:

| Component | Directory | Toolchain | Dev command |
|-----------|-----------|-----------|-------------|
| **Frontend SPA + Vercel API** | `frontend/` | Vite 7 + React 19 + TypeScript | `pnpm -C frontend dev` |
| **Solidity contracts** | `contracts/` (root) | Foundry (forge) | `forge build` / `forge test` |

Optional components: XMTP Keepr Agent (`frontend/server/agent/eliza/`), CRE automation (`cre/`), Docs site (`apps/docs-site/`), Solana program (`programs/creator-share-hook/`).

### Running services

- **Frontend**: `cd frontend && pnpm dev` starts Vite at `http://localhost:5173/`. Hot-reloads on file changes. The app is in waitlist mode by default — unauthenticated routes redirect to `/` or show the waitlist modal.
- **Contracts**: `forge build` to compile, `forge test` to run all 72+ Solidity unit tests. Foundry must be on PATH (`$HOME/.foundry/bin`).

### Lint / test / typecheck

Standard commands are documented in `frontend/package.json` scripts:

- `pnpm -C frontend lint` — ESLint (clean — 0 warnings, 0 errors)
- `pnpm -C frontend typecheck` — TypeScript (clean — 0 errors)
- `pnpm -C frontend test` — Vitest (289 tests, all passing)
- `forge test` — Foundry unit tests (72 tests, all passing)

### Non-obvious caveats

- **Git submodules are required** for Foundry compilation. Run `git submodule update --init --recursive` after cloning. The submodule tree is deep (Uniswap CCA/Liquidity Launcher pull in many transitive submodules) and takes ~2 minutes.
- **Two separate pnpm lockfiles**: root `pnpm-lock.yaml` (Solidity deps like OpenZeppelin, LayerZero) and `frontend/pnpm-lock.yaml` (frontend deps). Install both: `pnpm install` at root, then `pnpm -C frontend install`.
- **Foundry path**: After installing via `foundryup`, binaries are at `$HOME/.foundry/bin`. Add to PATH or invoke directly.
- **`.env` files**: Copy `.env.example` at root and `frontend/.env.example` for local dev. Most env vars are optional for basic frontend dev — the app runs without external service credentials but wallet/auth features require Privy, Supabase, etc.
- **API routing**: Vercel API routes go through `frontend/api/[...path].ts` dispatching to `frontend/api/_handlers/_routes.ts`. New endpoints must be registered in the static route map (no dynamic imports).
- **`pnpm.onlyBuiltDependencies`** is configured in `frontend/package.json` to avoid interactive `pnpm approve-builds` prompts.
- **Waitlist/marketing page on localhost**: By default, `localhost` is treated as the "app" domain and redirects unauthenticated users to `4626.fun`. To test the waitlist/marketing page locally, set `VITE_HOST_MODE_OVERRIDE=marketing` and `VITE_MARKETING_ORIGIN=http://localhost:5173` in `frontend/.env`. This is already configured in the Cloud Agent `.env`.

### Solana program deployment

The `creator-share-hook` Anchor program lives at `programs/creator-share-hook/`. It is deployed to Solana **mainnet**.

| Detail | Value |
|--------|-------|
| Program ID | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |
| Upgrade authority | `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY` (from `SOLANA_PRIVATE_KEY` secret) |
| ProgramData | `DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU` |
| Binary | `programs/creator-share-hook/target/deploy/creator_share_hook.so` |
| Data capacity | 372,488 bytes (extended with 80KB headroom beyond current 345KB binary) |
| Anchor.toml cluster | `mainnet` (see `[provider]` section) |

**Upgrade procedure:**
1. Decode `SOLANA_PRIVATE_KEY` (base58) to a Solana CLI JSON keypair file (64-byte secret key array).
2. `solana config set --url https://api.mainnet-beta.solana.com --keypair <deployer-keypair.json>`
3. If the new `.so` is larger than the current program data, run `solana program extend EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU <extra-bytes>` first.
4. `solana program deploy programs/creator-share-hook/target/deploy/creator_share_hook.so --program-id EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`
5. The deployer wallet needs enough SOL for the temporary buffer (~2.4 SOL for a ~345KB binary, refunded after upgrade) plus any extension rent.

**Non-obvious caveats:**
- `SOLANA_PRIVATE_KEY` is a **base58-encoded** secret key, not a JSON array. Convert before use with Solana CLI (the CLI expects `[u8; 64]` JSON array format).
- The program keypair at `target/deploy/creator_share_hook-keypair.json` does **not** match the deployed program ID — do not pass it as `--program-id`. The deployed program ID is hardcoded in `declare_id!()` in `src/lib.rs`.
- Solana CLI 3.x is installed at `~/.local/share/solana/install/active_release/bin/solana`; Anchor CLI 0.31.1 is at `/usr/local/cargo/bin/anchor`.
- The Anchor IDL is at `target/idl/creator_share_hook.json`. Regenerate with `cd programs/creator-share-hook && anchor idl build > ../../target/idl/creator_share_hook.json`.

### Solana bridge on-chain config (Base mainnet)

The deployment batcher is configured for Solana bridging:

| Contract | Config | Value |
|----------|--------|-------|
| Batcher (`0xB87CBb...c84`) | `solanaBridgeAdapter` | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` |
| | `solanaDestination` | `0x5f38e34e...d4d1` |
| SolanaBridgeAdapter (`0x2414b5...e8`) | `owner` | `0xB05Cf0...FdD` (= `PRIVATE_KEY` secret) |
| Protocol treasury (Safe 1-of-2) | address | `0x7d429e...f2d3` |
| | owners | `0xB05Cf0...` (`PRIVATE_KEY`), `0x2C1Af6B...` |

**Key access:** `PRIVATE_KEY` secret is owner of both the adapter and the treasury Safe. To call `setSolanaConfig` on the batcher, execute via the Safe (threshold=1, so single-owner signature suffices). See git history for the `cast send` pattern used.

**Deploy behavior (current):** Solana transfer setup is handled out-of-band. `finalizePhase2` does not require `meteoraAlphaVault`/`solanaIxs`, and deployment flow should pass `bytes32(0)` + empty ixs for those fields.

**Out-of-band Solana path:** Route provisioning, token registration, and Meteora ix payload generation run via the provisioner and `/api/deploy/registerSolanaBridgeToken`, separate from phase-2 finalize.

**Planned model:** treat Solana allocation as strategy-stage orchestration (alongside Charm/Ajna) rather than phase-2 finalize logic.

### Provisioner VM (Vultr)

The Solana route provisioner runs on a Vultr VPS at `provisioner.4626.fun` (IP: `45.63.52.50`).

- **SSH:** `ssh root@45.63.52.50`
- **Service:** `systemctl {status|restart} solana-provisioner`
- **Env:** `/etc/4626/solana-provisioner.env`
- **Repo:** `/opt/4626`
- **Nginx:** reverse proxy 80/443 → 8788, Let's Encrypt cert (auto-renew)
- **Bridge CLI:** installed at `/opt/base-bridge/scripts` on the VM. Provisioner healthz reports `ok:true, cliExists:true`.
- **Auto-pool:** `SOLANA_AUTO_POOL=1` is set — provisioner auto-creates DLMM pool + Alpha Vault after `wrap-token`.

### Solana integration: per-creator setup

The Solana route provisioner (`frontend/server/solana-provisioner/`) handles the full Solana-side setup via HTTP endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /provision` | Creates bridge route via `wrap-token` CLI; with `SOLANA_AUTO_POOL=1`, also creates DLMM pool + Alpha Vault |
| `POST /setup-creator` | Creates Token-2022 mint with Transfer Hook + TransferFeeConfig, initializes PDAs |
| `POST /create-pool` | Creates Meteora DLMM pool for the creator's share token |
| `POST /meteora-ixs` | Builds Meteora Alpha Vault deposit instructions |

**Single-token architecture:** Meteora DLMM rejects Token-2022 mints with TransferHook extension (`UnsupportedMintExtension`). The deploy uses only the bridge-wrapped standard SPL token (created by `wrap-token`) for DLMM pools, Alpha Vault deposits, and trading. Transfer Hook functionality (lottery entries, fees) requires a separate Token-2022 mint if needed.

**Full per-creator Solana setup sequence (with `SOLANA_AUTO_POOL=1`):**
1. `POST /provision` — creates bridge-wrapped SPL token + route, then auto-creates DLMM pool + Alpha Vault
2. (Optional) `POST /setup-creator` — creates Token-2022 mint with Transfer Hook, inits CreatorConfig/PendingEntries/WinnerRecord PDAs
3. Register Meteora vault config in DB or `METEORA_CREATOR_ALPHA_VAULT_MAP_JSON` env

**Meteora vault config** is resolved via `frontend/server/_lib/meteoraAlphaVaultConfig.ts`:
- Priority 1: DB table `creator_meteora_alpha_vaults` (auto-created on first query)
- Priority 2: `METEORA_CREATOR_ALPHA_VAULT_MAP_JSON` env var (JSON map keyed by creator token address)

### CRE keeper bots

Keeper bots in `cre/` relay data between Solana and Base. Install: `cd cre && npm ci`.

**Solana-specific workflows:**
- `keepr-solana-entry-relay` — drains lottery entries from Solana → relays to Base (every 30s)
- `keepr-solana-fee-flush` — harvests Solana fees → bridges to Base gauge (every 5min)
- `keepr-solana-winner-relay` — relays Base lottery wins → records on Solana
- `keepr-solana-price-monitor` — monitors Solana vs Base price deviation

**Start:** `cd cre && tsx runner.ts` (runs all workflows). Dry-run: `DRY_RUN=true tsx runner.ts`.

**Required secrets** (see `cre/secrets.example.env`):
- `KEEPR_PRIVATE_KEY` — Base signer (EOA or ERC-4337 owner)
- `SOLANA_KEEPER_KEYPAIR` — Solana payer/authority (base58)
- `SOLANA_RPC_URL`, `BASE_RPC_URL` — RPC endpoints
- `SOLANA_BRIDGE_ADAPTER` — Base bridge adapter address
- `SOLANA_CREATOR_MINTS` — comma-separated Solana mints to monitor
- `SOLANA_SHARE_OFT_MAPPING` — JSON: Solana mint → Base ShareOFT
- `SOLANA_CREATOR_COIN_TO_MINT_MAPPING` — JSON: Base creator coin → Solana mint
- `SOLANA_TWIN_TO_PUBKEY_MAPPING` — JSON: Base Twin contract → Solana pubkey

**CRE has pre-existing TS errors** (4 errors in actions/utils); runtime is unaffected since `tsx` skips type checks.
