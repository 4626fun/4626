---
title: Legacy Twin Bridge Naming Invariant
sidebar_position: 6
---

:::info Canonical address source
This document narrates the historical migration of the
`SolanaBridgeAdapter` contract and contains the addresses that were
current at each point in time. For the **current canonical deployment
addresses**, always consult
[`docs/reference/addresses.md`](/reference/addresses) — it is the
single source of truth and is updated on every release. Addresses
below (e.g. `0x653326dD…`) are preserved for historical context only.
:::

# Legacy Twin bridge naming invariant

Historical reference for how creator coins' Solana-side display identity
(bridge-wrapped Token-2022 mint `name` and `symbol`) is derived and
enforced across the 4626 deploy pipeline.

## Scope — bridge-wrapped creator SPL vs share mesh

This document covers **bridge-wrapped creator SPL** mints registered on
`SolanaBridgeAdapter`, `POST /provision`, and legacy Meteora-on-creator-SPL
lanes. That grain is **deprecated for greenfield vault lottery/trading** —
do not treat it as a third parallel product lane alongside share mesh.

It does **not** define the **LayerZero share-mesh OFT** mint used for
user lottery / Pipe A. For that, read:

- [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md)
- [solana-share-mesh-budget-paths.md](../../solana/solana-share-mesh-budget-paths.md)
- [solana-share-mesh-creator-provisioning.md](./solana-share-mesh-creator-provisioning.md)

For active v1.19.0 launches, provision a distinct LZ OFT store/mint, seed
`Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, peer)` before
finalize, and create Meteora against that LZ mint. The batcher
`0x02D7abC547F8B1e7E2D7a919D8D1005918361750` stores destination + OVault
runtime only. Never add adapter or batcher-global-peer operations to the
unsigned 11-operation registration Safe packet.

Do not point share-mesh Meteora pools or `relay_entries` at the creator
SPL mint derived here (e.g. AKITA `9JWh…`) unless product explicitly
chooses the legacy grain.

## The invariant

Every creator coin's Solana bridge-wrapped mint has:

1. `tokenMetadata.name` == `lowercase(creatorCoin.name())`
2. `tokenMetadata.symbol` == `lowercase(creatorCoin.symbol())`
3. Mint pubkey is the deterministic PDA of those lowercase values (see
   [Derivation](#derivation) below)
4. `SolanaBridgeAdapter.tokenToSolanaMint[creatorCoin]` is that same PDA
5. `SolanaBridgeAdapter.tokenToSolanaDecimals[creatorCoin]` == 9

These five layers must agree exactly within the legacy Twin grain.

## Why lowercase

The Coinbase `base/bridge` Solana program (mainnet
`HNCne2FkVaNghhjKXapxJzPaBvAKDG1Ge3gqhZyfVWLM`) has no
`update_wrapped_token_metadata` instruction — the
[Token-2022 metadata extension's](https://spl.solana.com/token-2022/extensions#metadata-extension)
`updateAuthority` is set to the mint PDA itself, and the bridge program
doesn't expose an admin handler that CPI-signs for it. Metadata is
therefore **immutable post-wrap by design**.

Given immutability, we lock in a single canonical casing rule rather
than mirroring whatever case the creator happened to put in their Base
ERC-20 `name()` / `symbol()`. Lowercase is the choice, applied uniformly
via the historical `normalizeWrapTokenName` / `normalizeWrapTokenSymbol`
implementation that lived at
`frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts`.

## Derivation

The mint pubkey is a Solana Program Derived Address of the bridge
program with seeds bound to the metadata:

```
metadataBytes = u64_le(len(name)) || name
             || u64_le(len(symbol)) || symbol
             || remoteToken           // 20 Ethereum address bytes
             || u8(scalerExponent)
metadataHash  = keccak256(metadataBytes)
mintPubkey    = findProgramAddress(
                  seeds   = ["wrapped_token", u8(decimals), metadataHash],
                  program = BRIDGE_PROGRAM
                )
```

Byte-for-byte identical to the
[`base/bridge` wrap-token handler](https://github.com/base/bridge/blob/main/scripts/src/commands/sol/bridge/solana-to-base/wrap-token.handler.ts).

The retired implementation lived at
`frontend/server/_lib/onchain/solanaWrappedMintPda.ts` as
`deriveWrappedMintPda(input)`. Its tests had golden fixtures for the two AKITA
mappings pinned against live mainnet state.

## Historical Twin end-to-end flow

```
Creator deploys ERC-20 "MyCoin" / "MTK" on Base
                        |
                        v
  frontend provisioner reads MyCoin.name(), MyCoin.symbol() via viem
                        |
                        v
  normalizeWrapTokenName("MyCoin") -> "mycoin"
  normalizeWrapTokenSymbol("MTK")  -> "mtk"
                        |
                        v
  wrap-token --name mycoin --symbol mtk \
             --remote-token 0x<mycoin> --decimals 9 \
             --scaler-exponent 9 --deploy-env mainnet --pay-for-relay
                        |
                        v
  bridge program derives mint PDA from lowercase seeds,
  creates Token-2022 mint with tokenMetadata.{name,symbol} = mycoin/mtk
                        |
                        v
  /api/deploy/registerSolanaBridgeToken calls
    SolanaBridgeAdapter.registerToken(mycoin, mintBytes32, 9)
                        |
                        v
  Phase 3 of the creator's vault deploy constructs
    SolanaStrategy(vault, mycoin, bridgeAddress = adapter)
                        |
                        v
  Solana explorers, Meteora, DexScreener, wallets: "mycoin" / "mtk"
```

This was the retired Twin automation flow; it is not the greenfield launch
plane. Its naming policy was locked at four
enforcement points:

| Layer | What enforces it |
|---|---|
| Type | `ProvisionBody` in `frontend/server/solana-provisioner/index.ts` has no `tokenName` / `tokenSymbol` override fields |
| Runtime | `normalizeWrapTokenName` / `normalizeWrapTokenSymbol` apply `.toLowerCase()` and fail-close on null-byte / oversized inputs (pre- and post-fold byte-length check for Unicode case folding like Turkish dotted I) |
| Cryptographic | Mint PDA is seed-bound; any metadata drift produces a different mint that the Base bridge's scalar doesn't recognize |
| Tests | Historical `solanaWrappedMintPda.test.ts`, `solanaBridgeTokenMetadata.test.ts`, `verifyCreatorSolanaMintParity.test.ts`, and `deployRegisterSolanaBridgeToken.test.ts` |

## Legacy parity verification

Operators can verify any creator's parity state at any time with the
read-only script:

```bash
pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
  --creator 0x<creator-base-erc20>
```

Defaults to the configured legacy adapter from `VITE_SOLANA_BRIDGE_ADAPTER`
and mainnet bridge program. This does not verify the active LZ share-mesh
route. It outputs a human-readable report with exit
code 0 (parity) or 2 (drift + details of which invariant failed).

For machine-readable output pass `--json`:

```bash
pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
  --creator 0x5b67... --json
```

The retired programmatic entry point was `verifyCreatorSolanaMintParity` in
`frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts`.
It returns a structured result with a `matched: boolean` and a `drift:
string[]` array naming each invariant that failed. Callable from any
Node context; inject a Solana RPC metadata fetcher via
`createSolanaRpcMintMetadataFetcher(url)`.

## Drift response runbook

When `verifyCreatorSolanaMintParity` reports drift for a creator, match
the `drift` entry to a response:

| Drift entry | Cause | Response |
|---|---|---|
| `base_erc20_read_failed` | Base RPC issue or creator coin not yet deployed | Retry with a healthy RPC; verify creator coin contract exists at that address |
| `base_name_fails_normalization` / `base_symbol_fails_normalization` | Creator's `name()` / `symbol()` is empty, contains null bytes, or exceeds 32/12 UTF-8 bytes after lowercasing | Creator must redeploy their ERC-20 with compliant metadata; there is no runtime workaround because the bridge program rejects non-normalized inputs |
| `adapter_read_failed` | Base RPC issue on adapter reads | Retry |
| `adapter_not_registered` | `registerToken` was never called for this creator | Call `registerToken(creator, expectedMintBytes32, 9)` from the adapter's owner |
| `adapter_mint_mismatch` | Adapter registered the creator to a different mint than the strict-parity derivation expects | The `SolanaBridgeAdapter.registerToken` function has `require(tokenToSolanaMint[token] == 0)` — in-place fix is impossible. See [Migration history](#migration-history-akita-v1-to-v2) for the adapter-swap pattern |
| `adapter_decimals_mismatch` | Adapter has wrong decimals stored for this creator | Same constraint as above: registerToken is one-shot; requires a new adapter if decimals need to change |
| `solana_mint_missing_tokenMetadata_extension` | The mint exists but without the Token-2022 metadata extension | Mint was created outside the base/bridge `wrap-token` path; re-run `wrap-token` for a fresh PDA with the extension initialized |
| `solana_mint_name_mismatch` / `solana_mint_symbol_mismatch` | The Solana mint was wrapped with different (e.g. upper-case) metadata than what we expect | Same one-shot constraint — metadata is immutable on the PDA. Resolve by wrapping a new mint with correct lowercase metadata and registering it on a new adapter |
| `solana_metadata_read_failed` | Solana RPC issue | Retry |

## Migration history (AKITA v1 to v2)

AKITA was wrapped on 2026-02-28, before the strict-parity / lowercase
logic landed. The `base/bridge` `wrap-token` CLI at that time defaulted
to `"Zora Creator Coin"` / `"ZORA"`, which produced mint
[`HuY4cQk5wJBfdaduUFnLJUiqhDXKyMR7mgSUHpZN9ouR`](https://explorer.solana.com/address/HuY4cQk5wJBfdaduUFnLJUiqhDXKyMR7mgSUHpZN9ouR).
That mint is permanently labeled `"Zora Creator Coin"` / `"ZORA"`
because the bridge program has no metadata update instruction.

On 2026-04-19, to get AKITA to the strict-parity state, we performed an
adapter-swap migration:

1. A new Solana mint
   [`9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp`](https://explorer.solana.com/address/9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp)
   was wrapped with `name = "akita"`, `symbol = "akita"`. Token-2022
   metadata extension set at creation, immutable thereafter.
2. A fresh `SolanaBridgeAdapter` was deployed to Base at
   [`0x653326dD0145656eC3b598943C0E84d7405aE6Ae`](https://basescan.org/address/0x653326dD0145656eC3b598943C0E84d7405aE6Ae)
   (tx `0xfe49c9e2b9900533fedc60f257cb3b96234b81e3540a514181b2a88dee4dfd5e`).
   Byte-identical source to the v1 adapter — "deploy fresh, swap the
   default" is the migration strategy because the adapter is plain
   `Ownable` (not upgradeable) and `registerToken` hard-reverts on a
   pre-existing mapping.
3. `registerToken(AKITA, 0x7b59f36c…3a33, 9)` was called on the new
   adapter (tx `0x808cd54da1243bf81156c368af6ae898a6b61147638235fbee82efce39424fe7`).
4. `BASE_DEFAULTS.solanaBridgeAdapter` in the historical
   `frontend/src/config/contracts.defaults.ts` updated from v1 to v2.
5. `VITE_SOLANA_BRIDGE_ADAPTER` and `SOLANA_BRIDGE_ADAPTER` env examples
   updated.
6. `creator_meteora_alpha_vaults` DB row for AKITA marked
   `enabled=false` with `supersededReason = v2-adapter-migration-2026-04-19`;
   legacy Meteora DLMM pool and Alpha Vault left intact but
   unreferenced.

After this migration, the v1 adapter stays onchain with its historical
AKITA→ZORA mapping but is not referenced by any live code path. Any
creator deployed after commit `27d7ec4f` (which landed the frontend
config update) gets their SolanaStrategy constructed with
`bridgeAddress = v2 adapter`.

For historical Twin deployments only, the adapter-swap pattern explains how
that immutable mapping was remediated. Do not apply it to a greenfield creator;
use the per-creator LZ OFT runbook instead.

### Last canonical adapter for the legacy grain

The last canonical Twin grain used
**`0x700b4BBAf965c013123bAd02a6562FBa487aC0f1`**
(see [`docs/reference/addresses.md`](/reference/addresses)). It is not part of
the active v1.19.0 registration or per-creator share-mesh plane. The
`0x653326dD…` deployment above is historical context for the AKITA
strict-parity migration; do not treat it as the active default.

## Meteora integration runbook

Historically, Twin bridging and depositing the wrapped creator SPL into a
Meteora DLMM / Alpha Vault were separate. The retired bridge was set up via
`wrap-token` + `SolanaBridgeAdapter.registerToken`; Meteora was an operator
step handled by KPR launch scripts plus a DB row.

This runbook targets **legacy bridge-wrapped creator SPL** (+ optional Alpha
Vault). For **share-mesh** Meteora pools, use the active command documented in
the budget-path runbook with the LZ share mint as `TOKEN_MINT_X` — see
[solana-share-mesh-budget-paths.md](../../solana/solana-share-mesh-budget-paths.md).

### When to do it

Only use the steps below when maintaining an explicitly grandfathered Twin
creator-SPL deployment. For active launches, use the LZ share-mesh budget and
creator-provisioning runbooks linked above.

Create new Meteora infra for a creator when:

- The vault activation flow should seed a starting DLMM position on
  Solana (handled by `bridgeToSolanaWithIxs` at activation), OR
- Keeper-driven ongoing rebalance from Base should park into a DLMM
  position rather than a custody wallet (handled by the
  `keepr-solana-rebalance` workflow when it's moved out of stub state).

Creators who don't need either can ship without Meteora. The bridge
itself works regardless — tokens just land in a Solana custody wallet
instead of an Alpha Vault.

### Cost and access

- ~1.5 SOL for DLMM pool creation + bin array rent
- ~1.5 SOL for Alpha Vault creation
- Needs the Solana keeper keypair at `SOLANA_PRIVATE_KEY` (base58)
- Needs `SOLANA_RPC_URL` pointing at a working mainnet RPC

Total ≈ 3.5 SOL per creator who opts into Meteora.

### Commands

```bash
# 0. Source env so KPR scripts pick up keys and RPC
export $(grep -E '^(SOLANA_RPC_URL|SOLANA_PRIVATE_KEY|BASE_RPC_URL)=' \
  /path/to/repo/frontend/.env | xargs)

# 1. Derive the creator's strict-parity Solana mint address and
#    confirm it already exists on-chain (wrap-token was already run at
#    creator coin launch time).
pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
  --creator 0x<creator-base-erc20> --json
# Note the derived mint pubkey from output — use as TOKEN_MINT_X below.

# 2. Create the Meteora DLMM pool (legacy creator-SPL + Alpha Vault lane)
TOKEN_MINT_X=<creator_spl_mint_pubkey> \
TOKEN_MINT_Y=So11111111111111111111111111111111111111112 \
METEORA_HAS_ALPHA_VAULT=1 \
ACTIVATION_DELAY_SECONDS=604800 \
pnpm -C kpr solana:create-dlmm-pool

# 3. Create the Meteora Alpha Vault on top of the pool.
pnpm -C kpr exec tsx scripts/solana/launch/create-alpha-vault.ts

# 4. Register the mapping in the DB so the deploy-session flow and
#    `keepr-solana-rebalance` workflow can find it.
pnpm -C kpr exec tsx scripts/solana/launch/register-meteora-vault.ts \
  --creator-token 0x<creator-base-erc20> \
  --meteora-alpha-vault <vault-pubkey> \
  --alpha-vault-program-id vaU6kP7iNEGkbmPkLmZfGwiGxd4Mob24QQCie5R9kd2

# 5. Verify end-to-end parity.
pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
  --creator 0x<creator-base-erc20>
```

Or run `pnpm -C kpr run solana:bootstrap-side` which chains route
registration + Meteora upsert + Phase-2 ix smoke-build (see script
header for required env).

### When NOT to run this runbook

- If the creator's Base ERC-20 doesn't pass strict-parity
  normalization (name > 32 bytes, symbol > 12 bytes, null bytes, empty
  after lowercasing). Fix the creator coin first.
- If the creator's mint was wrapped under legacy (non-lowercase)
  metadata. That mint is immutable; the DLMM pool + Alpha Vault have
  to be created against the lowercase-parity mint, and the
  `SolanaBridgeAdapter` registration has to point at that same mint.
  The AKITA v1→v2 migration is the canonical example.
- If the `creator_meteora_alpha_vaults` row for this creator is
  already `enabled=true`. Re-running destroys existing liquidity; migrate
  an existing pool with a dedicated LP migration script instead.

### Historical AKITA Twin state

AKITA's Meteora row is `enabled=false` with `supersededReason =
v2-adapter-migration-2026-04-19`. The historical re-enable procedure was:

1. Fund the Solana keeper `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY`
   with ~4 SOL.
2. Run steps 2-4 above against the AKITA creator token
   `0x5b674196812451b7cec024fe9d22d2c0b172fa75`.
3. Update the existing row's `enabled=true` and point it at the new
   Meteora pool/vault pubkeys.

Do not run that historical procedure for the active launch plane. AKITA's
current Solana trading path uses its LZ share-mesh mint and the canonical
Meteora runbook.

## Legacy-grain invariants summary

Put these on the wall:

- **Base ERC-20 `name()` / `symbol()` is the single source of truth.**
  Never override in config, never hardcode defaults in handlers.
- **Lowercase is applied deterministically.** Never case-preserve,
  never Unicode-fold to anything other than `.toLowerCase()`.
- **Bridge mints are immutable.** `wrap-token` is one-shot per
  metadata; any rebrand is a new mint at a new PDA.
- **Adapters are one-shot per (token, mint) pair.** Re-registering the
  same creator on the same adapter will revert. Rebrand = new adapter.
- **The legacy SolanaStrategy contract stores `bridgeAddress` at construction
  and has no setter.** This explains historical immutability; do not add the
  adapter back to greenfield deployment.

## Historical code inventory

- `frontend/server/_lib/onchain/solanaWrappedMintPda.ts` — retired PDA derivation
- `frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts` — retired lowercase normalizers
- `frontend/server/_lib/onchain/verifyCreatorSolanaMintParity.ts` — retired parity verification
- `frontend/scripts/verify-solana-mint-parity.ts` — retired operator CLI
- `contracts/utilities/bridge/SolanaBridgeAdapter.sol` — retired adapter contract
- `contracts/vault/strategies/SolanaStrategy.sol` — retired creator-vault strategy
- `frontend/server/solana-provisioner/index.ts` — legacy provisioner host
- `frontend/scripts/mine-solana-mint-vanity.ts` — retired dev tool
- `kpr/actions/keepr-solana-rebalance.action.ts` — retired adapter-grain keeper action
- `kpr/scripts/solana/launch/create-dlmm-pool.ts`, `create-alpha-vault.ts`, and
  `register-meteora-vault.ts` — historical creator-SPL Meteora setup
- `kpr/scripts/solana/launch/bootstrap-solana-side.ts` — retired route helper
- [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md) — active share-mesh policy
