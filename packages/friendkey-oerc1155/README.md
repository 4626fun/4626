# FriendKey OERC1155 — deploy kit

Self-contained package to deploy and operate **AlfaClub FriendKey** as a multi-id omnichain ERC-1155 (LayerZero OApp) with Across buy/sell adapters on Base.

This is the public deployable unit. Live address pins also exist at the repo root under `contracts/other/alfaclub/` and `deployments/{base,robinhood}/`.

Design / status (do not duplicate here):

- [`docs/designs/friendkey-cross-chain-acquisition.md`](../../docs/designs/friendkey-cross-chain-acquisition.md)
- [`docs/designs/friendkey-cross-chain-acquisition-status.md`](../../docs/designs/friendkey-cross-chain-acquisition-status.md)

## What this is

| Piece | Role |
|-------|------|
| `FriendKeyOERC1155` | CREATE2-parity wrap: Base hub escrows allowlisted underlying ids; spokes mint/burn representation |
| Across BuyExecutor | USDG→USDC fill on Base → buy FriendKey → LZ send to Robinhood |
| SellExecutor + SellSinkFactory | Seamless sell: unlock into per-user sink → curve sell → Across USDC→USDG |
| Metadata | Token `#1659` + collection JSON + IPFS CIDs |
| Ops scripts | Pin metadata, configure ULN, Across buy, seamless-sell helper |

Seed allowlisted id: **1659** (`AKITA FriendKey #1659`).

## Live reference addresses

| Component | Address | Chain |
|-----------|---------|-------|
| Wrap (CREATE2) | `0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155` | Base + Robinhood |
| BuyExecutor | `0x157aFfd665C81a72579762EaEEe00070B1327Ab4` | Base |
| SellExecutor | `0x08FCB9E40fa042B27C9b680d2e359E76Eebf7b4f` | Base |
| SellSinkFactory | `0x61De09Cb8CcAa249E6273Baeb904EAfA78CDAC70` | Base |
| Underlying FriendKey | `0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F` | Base |
| Registry4626 | `0x777968CB7F302f3d02C094b119a67DCA9E0b4626` | Base + Robinhood |
| Bytecode store | `0x75FA60e7e01CACda736952E9AC8D5c30B61F117E` | Base + Robinhood |
| CREATE2 deployer | `0x7E3898Eb0Aee0DCAC5C0ccCd88ab94575f48a2D6` | Base + Robinhood |
| Across SpokePool | `0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64` | Base |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Robinhood |

Pins: `deployments/base.friendkey-oerc1155.json`, `deployments/robinhood.friendkey-oerc1155.json`.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- Node.js 20+ and `pnpm` or `npm`
- RPC URLs for Base and Robinhood
- Owner key matching `OWNER` (deploy + ULN `setConfig` via endpoint delegate)
- CREATE2 infra already on both chains (bytecode store + deployer), **or** deploy the contracts in `contracts/shared/` yourself and update env

## Install

```bash
cd packages/friendkey-oerc1155   # or extract the release tarball
pnpm i                          # or: npm i
pnpm build                      # forge build
```

If LayerZero npm resolution fails, install peers explicitly then rebuild:

```bash
pnpm add @layerzerolabs/oapp-evm@^0.4.1 @layerzerolabs/lz-evm-protocol-v2@^3.0.159 \
  @layerzerolabs/lz-evm-messagelib-v2@^3.0.159 @openzeppelin/contracts@^5.4.0 \
  forge-std@github:foundry-rs/forge-std#v1.9.4
pnpm build
```

Copy `.env.example` → `.env` and fill secrets locally (never commit).

## Ordered deploy steps

Use the live salt/initCodeHash only to **replay** the same vanity address. Third parties who want a different vanity must grind their own salt against the same `initCodeHash` + CREATE2 deployer.

1. **Compute initCodeHash** (optional sanity check)

   ```bash
   pnpm compute-initcode
   ```

2. **CREATE2 deploy wrap on Base** — seed bytecode if missing, do **not** set hub yet if you prefer a pure deploy pass:

   ```bash
   SEED_BYTECODE=1 SET_HUB=0 \
     forge script script/DeployFriendKeyOERC1155.s.sol --rpc-url $BASE_RPC_URL --broadcast
   ```

3. **CREATE2 deploy wrap on Robinhood** (same salt + constructor args → same address):

   ```bash
   SEED_BYTECODE=1 SET_HUB=0 \
     forge script script/DeployFriendKeyOERC1155.s.sol --rpc-url $ROBINHOOD_RPC_URL --broadcast
   ```

4. **Set metadata URIs** on both chains (`TOKEN_URI`, `CONTRACT_URI` from `metadata/ipfs.json`).

5. **Set peers (left-pad)** — peer bytes32 is `bytes32(uint256(uint160(wrap)))`, **not** a raw 20-byte address:

   ```text
   0x000000000000000000000000a1fac792d1643f9178fcaff61b5e08b3eae01155
   ```

   Base → Robinhood eid `30416`; Robinhood → Base eid `30184`.

6. **Configure ULN** (conf 15 both directions; RH five DVNs: LZ Labs, Nethermind, Horizen, P2P, BitGo):

   ```bash
   pnpm configure-uln
   pnpm configure-uln -- --execute
   ```

7. **Allowlist** seed token id `1659` on the hub; `setHub` + deploy Buy/Sell executors once on Base:

   ```bash
   SET_HUB=1 SPOKE_POOL_BASE=0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64 \
     forge script script/DeployFriendKeyOERC1155.s.sol --rpc-url $BASE_RPC_URL --broadcast
   ```

8. **defaultLzOptions** (if your ops path sets enforced options on the OApp) — match live mesh practice for Base↔RH.

9. **ETH float** on BuyExecutor (pays LZ fees on purchase) — live reference ~0.001 ETH.

10. **Verify buy** (dry-run then execute):

    ```bash
    pnpm buy -- --dry-run
    pnpm buy -- --execute --confirm=FRIENDKEY-ACROSS-DEPOSIT
    ```

## Metadata pin

```bash
pnpm pin-metadata
# optional image re-pin:
pnpm pin-metadata -- --token-image=./1659.png --collection-image=./collection.png
```

Writes public CIDs to `metadata/ipfs.json` (no private storage URLs). Then `setURI` / `setContractURI` on-chain.

## Peer encoding warning

LayerZero `setPeer(eid, peer)` expects a **left-padded** `bytes32`. Truncating or right-padding will brick messaging. See deployment JSON `peers.*.peer` fields.

## Vanity / salt note

Replaying `0xA1Fa…1155` requires the **same** `WRAP_SALT`, constructor args (registry, owner, underlying), creation bytecode, and CREATE2 deployer. Third parties should grind their own vanity or treat the live pin as a reference only — this kit does **not** ship grind binaries.

## Package layout

```
packages/friendkey-oerc1155/
  contracts/     wrap, Across adapters, minimal registry + CREATE2 infra
  script/        forge deploy + initCodeHash
  metadata/      1659.json, collection.json, ipfs.json
  deployments/   live Base/RH pins + example.env.json
  scripts/       pin, ULN, Across buy, seamless sell
```

## npm scripts

| Script | Purpose |
|--------|---------|
| `pnpm build` | `forge build` |
| `pnpm compute-initcode` | Print CREATE2 initCodeHash |
| `pnpm pin-metadata` | Pinata pin → `metadata/ipfs.json` |
| `pnpm configure-uln` | Base↔RH ULN dry-run / `--execute` |
| `pnpm buy` | Robinhood Across deposit → BuyExecutor |
| `pnpm sell` | Print sink address + sell ops for wrap `0xA1Fa…1155` |
