# creator-share-hook mainnet upgrade (relay_entries / settle_fees)

Operator runbook for upgrading the live Transfer Hook program from legacy instruction names (`drain_entries`, `flush_fees`) to canonical names (`relay_entries`, `settle_fees`).

Related: [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md) (B2 gating), [solana-share-mesh-budget-paths.md](./solana-share-mesh-budget-paths.md) (costs).

## Why this upgrade is required

| Layer | Live mainnet today (Feb 2026 `.so`) | Repo source (Mar 2026+) |
|-------|--------------------------------------|-------------------------|
| Relay ix | `global:drain_entries` (`69457b10…`) | `global:relay_entries` (`6334b6bb…`) |
| Settle ix | `global:flush_fees` (`40c9211a…`) | `global:settle_fees` (`3cdd82e5…`) |
| Config field | `flush_threshold` | `settlement_threshold` |
| Empty-buffer error | `NoPendingEntries` / “drain” copy | `NoEntriesToRelay` |

KPR keepers default to **canonical** discriminators (`SOLANA_HOOK_IX_SCHEMA=canonical`). They will **fail** against the current mainnet bytecode until this upgrade lands.

**Do not enable `relay_entries` on orchestrator until:** (1) hook upgraded, (2) share-mesh B2 mint + Meteora pool verified, (3) offline + live smoke pass.

## Constants

| Item | Value |
|------|-------|
| Program ID | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |
| ProgramData | `DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU` |
| Upgrade authority | Deployer from `SOLANA_PRIVATE_KEY` (`7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`) |
| Binary path | `programs/creator-share-hook/target/deploy/creator_share_hook.so` |
| IDL (post-build) | `programs/creator-share-hook/target/idl/creator_share_hook.json` |
| Orchestrator env | `/etc/4626/solana-keeper-orchestrator.env` on Solana ops host |

## Pre-flight (read-only)

Run from repo root on an operator machine with Solana CLI + paid RPC.

```bash
# 1. Offline repo gates (Rust unit tests + KPR vitest + discriminators)
pnpm -C frontend ops:pipe-b-devnet-rehearsal

# 2. Confirm live program still legacy (strings in deployed buffer)
solana program show EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU --url https://api.mainnet-beta.solana.com

strings programs/creator-share-hook/target/deploy/creator_share_hook.so | rg -i 'drain_entries|flush_fees|relay_entries|settle_fees'
# Expect drain/flush in committed .so until rebuild — that is the gap this runbook closes.
```

**Upgrade authority check:** `solana program show …` must list your deployer as upgrade authority.

**PDAs are unaffected:** `initialize_creator` PDAs (`CreatorConfig`, `PendingEntries`, `WinnerRecord`) survive program upgrades. No creator re-init required.

## Build fresh bytecode

The committed `.so` under `target/deploy/` is **not** tracked in git and may be stale. Rebuild before deploy.

### Toolchain requirement (edition 2024)

Anchor 1.0 / `solana-address` 2.6 pull host-side proc-macro deps (`wincode`, etc.) that use **Rust edition 2024**. Solana **platform-tools v1.51** bundles **Cargo 1.84**, which cannot parse those manifests.

**Minimum:** platform-tools **v1.52** (Cargo **1.89**). Use the repo build script — do not rely on bare `anchor build` until Anchor forwards `--tools-version`.

```bash
cd programs/creator-share-hook

# First time or after Cargo.toml dependency bumps:
bash scripts/pin-sbf-deps.sh

# Canonical SBF build (writes target/deploy/creator_share_hook.so)
bash scripts/build-sbf.sh

# Optional: regenerate IDL from source (host Anchor CLI)
cd ../.. && anchor idl build -p creator_share_hook \
  > programs/creator-share-hook/target/idl/creator_share_hook.json
```

Override platform-tools version: `SBF_TOOLS_VERSION=v1.54 bash scripts/build-sbf.sh`

From repo root via frontend script:

```bash
pnpm -C frontend ops:build-creator-share-hook
```

### Post-build verification (must pass before mainnet)

```bash
# Canonical ix strings present; legacy absent
strings target/deploy/creator_share_hook.so | rg 'relay_entries|settle_fees|drain_entries|flush_fees'

# Discriminator spot-check
node -e "
const c=require('crypto');
for (const n of ['global:relay_entries','global:settle_fees']) {
  console.log(n, c.createHash('sha256').update(n).digest().subarray(0,8).toString('hex'));
}
"
# relay_entries → 6334b6bb6b640527
# settle_fees   → 3cdd82e5b7ea069f

pnpm -C frontend ops:pipe-b-devnet-rehearsal
```

## Mainnet deploy

Follow AGENTS.md Solana upgrade procedure. Summary:

```bash
# 1. Decode SOLANA_PRIVATE_KEY (base58) → JSON keypair array for Solana CLI

solana config set --url https://api.mainnet-beta.solana.com --keypair /path/to/deployer-keypair.json

# 2. Check binary size vs ProgramData capacity (~372 KB with headroom)
ls -la programs/creator-share-hook/target/deploy/creator_share_hook.so

# 3. Extend if needed (example: +81920 bytes)
# solana program extend EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU <extra-bytes>

# 4. Upgrade (same program id — do NOT pass target/deploy/*-keypair.json as --program-id)
solana program deploy \
  programs/creator-share-hook/target/deploy/creator_share_hook.so \
  --program-id EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU
```

**Budget:** deployer needs enough SOL for the temporary buffer (~2.4 SOL for ~345 KB binary, refunded after upgrade) plus any extension rent.

**Do not** use `programs/creator-share-hook/target/deploy/creator_share_hook-keypair.json` as `--program-id` — it does not match the deployed program ID.

## Post-upgrade verification

### On-chain

```bash
solana program show EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU --url https://api.mainnet-beta.solana.com
# Note new Last Deployed In Slot / Data Length
```

Optional: fetch program buffer and confirm `relay_entries` / `settle_fees` strings (via explorer or `solana program dump`).

### Keeper / orchestrator

On Vultr `/etc/4626/solana-keeper-orchestrator.env`:

```bash
# Remove legacy rollback if present — canonical is default
unset SOLANA_HOOK_IX_SCHEMA
# or explicitly:
SOLANA_HOOK_IX_SCHEMA=canonical
```

Restart orchestrator:

```bash
sudo systemctl restart solana-keeper-orchestrator
curl -sS https://orchestrator.4626.fun/healthz
```

**Keep `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`** until B2 pool + hook mint path is verified per [lottery policy](./solana-share-mesh-lottery-policy.md).

### Smoke (devnet first, then mainnet B2 mint)

Devnet hook is **not** at mainnet program ID — use `COST_PROBE_HOOK_PROGRAM_KEYPAIR` for a devnet deploy, then:

```bash
pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --live-devnet
```

Mainnet B2 (after share-mesh pool exists):

1. `setup-creator-full` for the share-mesh Token-2022 mint  
2. Meteora pool buy → confirm `PendingEntries.count > 0`  
3. Dry-run orchestrator reconcile with `SOLANA_ORCHESTRATOR_EXECUTE=0`  
4. Enable `relay_entries` + `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1`  
5. Confirm Base `processLotteryEntryFromSolana` receipt  

## Rollback

If keepers fail immediately after upgrade:

1. **Software rollback (fast):** set `SOLANA_HOOK_IX_SCHEMA=legacy` on orchestrator + redeploy Vercel KPR env if needed — only works if you **reverted the on-chain program** to old bytecode OR if the failure is client-side only.
2. **On-chain rollback:** redeploy the previous `.so` artifact from secure backup (keep pre-upgrade `.so` + slot hash in change record).

There is no dual-schema on-chain — legacy env var matches **old bytecode only**.

## Change record template

| Field | Value |
|-------|-------|
| Date | |
| Operator | |
| Pre-upgrade slot | |
| Post-upgrade slot | |
| Binary SHA256 | |
| `anchor --version` / SBF toolchain | |
| Orchestrator env diff | |
| B2 mints enabled for relay | (list pubkeys) |

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `InstructionFallbackNotFound` / wrong discriminator | Keeper canonical, chain legacy (or reverse) | Align `SOLANA_HOOK_IX_SCHEMA` with deployed `.so` |
| Keeper parses zero entries despite on-chain count | Stale parser (header padding) | Ensure `PENDING_ENTRIES_HEADER_SIZE = 64` in `kpr/utils/pendingEntriesBuffer.ts` |
| `anchor build` edition2024 error | Cargo too old | See Build section |
| `relay_entries` enabled but no Base txs | Wrong mint grain (creator SPL not share mesh) | [lottery policy](./solana-share-mesh-lottery-policy.md) |
| settle_fees scans empty | Public RPC + Token-2022 `getProgramAccounts` limits | Use paid `SOLANA_RPC_URL` on orchestrator |
