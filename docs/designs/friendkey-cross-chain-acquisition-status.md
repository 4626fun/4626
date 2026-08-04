# AlfaClub FriendKey — Cross-Chain Acquisition Status

**Status:** Live — Base hub + Robinhood spoke; buy + seamless sell  
**Design:** [FriendKey Cross-Chain Acquisition](./friendkey-cross-chain-acquisition.md)  
**Collection:** AlfaClub FriendKey  
**Seed room:** FriendKey token id **1659** (`AKITA FriendKey #1659`)

This page is the live address and role pin. The design brief remains the narrative; verify contracts on explorers before relying on any secondary copy.

Bridging rails (Across fills, LayerZero delivery) complete asynchronously after the user’s Robinhood transaction. On Base, buy+wrap in the Across destination handler and sink receive → sell are atomic units that revert together on failure.

## Live addresses

| Component | Address | Chain |
|-----------|---------|-------|
| Omnichain wrap (CREATE2 parity) | [`0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155`](https://basescan.org/address/0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155) | Base + [Robinhood](https://robinhoodchain.blockscout.com/address/0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155) |
| BuyExecutor | [`0x157aFfd665C81a72579762EaEEe00070B1327Ab4`](https://basescan.org/address/0x157aFfd665C81a72579762EaEEe00070B1327Ab4) | Base |
| SellExecutor | [`0x08FCB9E40fa042B27C9b680d2e359E76Eebf7b4f`](https://basescan.org/address/0x08FCB9E40fa042B27C9b680d2e359E76Eebf7b4f) | Base |
| SellSinkFactory | [`0x61De09Cb8CcAa249E6273Baeb904EAfA78CDAC70`](https://basescan.org/address/0x61De09Cb8CcAa249E6273Baeb904EAfA78CDAC70) | Base |
| FriendKey ERC-1155 (underlying) | [`0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F`](https://basescan.org/address/0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F) | Base |
| USDC | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) | Base |
| USDG | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) | Robinhood |
| Registry4626 | [`0x777968CB7F302f3d02C094b119a67DCA9E0b4626`](https://basescan.org/address/0x777968CB7F302f3d02C094b119a67DCA9E0b4626) | Base + Robinhood |
| Across SpokePool | [`0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64`](https://basescan.org/address/0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64) | Base |
| LayerZero EndpointV2 | [`0x1a44076050125825900e736c501f859c50fE728c`](https://basescan.org/address/0x1a44076050125825900e736c501f859c50fE728c) (eid `30184`) | Base |
| LayerZero EndpointV2 | [`0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`](https://robinhoodchain.blockscout.com/address/0x6F475642a6e85809B1c36Fa62763669b1b48DD5B) (eid `30416`) | Robinhood |

Chain ids: Base `8453`, Robinhood `4663`.

### Migration-only (previous single-id wrap)

| Component | Address | Notes |
|-----------|---------|-------|
| Legacy wrap | [`0xa1fa929f4d925bf1881657389b2ed7817ef31659`](https://basescan.org/address/0xa1fa929f4d925bf1881657389b2ed7817ef31659) | Prior `#1659`-only wrap. Holders redeem to Base, then re-wrap on the live collection address above. |

## Collection model

| Field | Value |
|-------|--------|
| Collection (`contractURI`) | **AlfaClub FriendKey** |
| Token name (seed) | **AKITA FriendKey #1659** |
| Naming template | `{RoomName} FriendKey #{id}` |
| Wrap model | One multi-id LayerZero ERC-1155; Base hub escrows underlying FriendKey; owner allowlists token ids (seed `1659`) |
| Canonical link to underlying | On-chain `underlying()` → `0xAF0B…FA9F` (same token ids) |

Robinhood is the **first spoke and USDG payment lane**. The wrap itself is omnichain: additional non-Base chains can be peered later for hold / redeem / bridge without a new collection contract. Buy/sell with USDG remains a Robinhood Across adapter.

## Roles

| Role | Where | Responsibility |
|------|-------|----------------|
| Hub wrap | Base | Escrows allowlisted underlying FriendKey ids; does not mint a Base-side user wrap balance |
| Spoke wrap | Robinhood (first spoke) | Mints/burns the representation ERC-1155 at the same CREATE2 address |
| BuyExecutor | Base | Across destination handler: USDC fill → `buyShares(tokenId)` → LayerZero send to Robinhood |
| SellExecutor + SellSinkFactory | Base | Seamless sell: unlock into per-user sink → curve sell → Across USDC→USDG to the user on Robinhood |
| Payment rail | Across | USDG ↔ USDC between Robinhood and Base |
| Delivery / return rail | LayerZero | Wrap inventory movement Base ↔ peered spokes |

BuyExecutor is prefunded with Base ETH to pay LayerZero wrap fees on purchase.

## Flows (one Robinhood signature each)

| Path | User action on Robinhood | Result |
|------|--------------------------|--------|
| **Buy** | One Across/USDG deposit with buy intent (`tokenId` + amount) | Representation ERC-1155 balance on Robinhood |
| **Redeem** | `wrap.send` to the user’s address on Base | Unlock underlying FriendKey on Base (hold keys) |
| **Seamless sell** | `wrap.send` to `sinkOf(user)` on Base | Curve sell + Across → USDG on Robinhood |

Redeem and seamless sell are different destinations for the same wrap send. Sell is not a second mint path.

### Buy

1. User confirms once on Robinhood (USDG via Across).
2. Across delivers USDC to BuyExecutor on Base.
3. BuyExecutor buys the allowlisted FriendKey id and initiates the wrap to the user’s Robinhood address in the same destination execution (reverts as a unit if wrap initiation fails).
4. User receives the representation ERC-1155 on Robinhood after LayerZero delivery.

### Redeem

1. User calls `wrap.send` on Robinhood with destination Base and recipient = their Base address (or chosen wallet).
2. Hub unlocks underlying FriendKey to that recipient.
3. User holds native FriendKey on Base.

### Seamless sell

1. One-time setup (not each sell): permissionless `SellSinkFactory.deploySink(user)` on Base (new factory; legacy sinks do not apply).
2. User calls `wrap.send` on Robinhood to the predicted Base sink for that user.
3. Hub unlocks FriendKey into the sink; the sink’s receive hook calls SellExecutor, which sells on the curve and deposits USDC→USDG via Across to the same user address on Robinhood.
4. No separate Base approval or sell transaction is required for the seamless path.

## Trust model

- **No AlfaClub FriendKey contract changes** for this deployment.
- BuyExecutor accepts Base USDC fills from the Across SpokePool only.
- Seamless sell is gated through the user’s CREATE2 sink → SellExecutor path.
- Spoke wrap supply is backed 1:1 by FriendKey escrowed in the Base hub.
- LayerZero Base ↔ Robinhood pathway configured with confirmations `[15, 15]` and optional DVN threshold 3-of-5.
- Wrap `underlying()` points at the AlfaClub FriendKey collection on Base.

## Metadata and NFT rendering

| Surface | Status |
|---------|--------|
| Collection | `contractURI` → IPFS JSON (**AlfaClub FriendKey**) |
| Token id `1659` | `uri(1659)` → IPFS JSON (**AKITA FriendKey #1659**) with image + attributes |
| Underlying FriendKey | Unchanged application metadata; not required for wrap wallet render |

Wallet and explorer media for the omnichain wrap use the OpenSea-compatible IPFS documents returned by `uri` / `contractURI` on the live wrap.

## Boundaries

**In scope now:** Allowlisted FriendKey ids on the multi-id wrap (seed `1659`); Robinhood ↔ Base buy with USDG; wrap delivery; redeem via wrap; seamless sell to USDG; IPFS metadata on the wrap; no AlfaClub FriendKey contract changes.

**Later / not claimed here:** additional spoke chains beyond Robinhood for hold/redeem; payment adapters on those chains; secondary-market (e.g. Sudoswap) routing as an onchain dependency; alternate stablecoins or payment bridges; deposit / wallet UX packaging.

## Verify

- Base wrap (hub): [Basescan](https://basescan.org/address/0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155) — `isHub() == true`
- Robinhood wrap (spoke): [Blockscout](https://robinhoodchain.blockscout.com/address/0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155) — `isHub() == false`
- BuyExecutor: [Basescan](https://basescan.org/address/0x157aFfd665C81a72579762EaEEe00070B1327Ab4)
- SellExecutor: [Basescan](https://basescan.org/address/0x08FCB9E40fa042B27C9b680d2e359E76Eebf7b4f)
- SellSinkFactory: [Basescan](https://basescan.org/address/0x61De09Cb8CcAa249E6273Baeb904EAfA78CDAC70)
- Legacy wrap (migration only): [Basescan](https://basescan.org/address/0xa1fa929f4d925bf1881657389b2ed7817ef31659)
