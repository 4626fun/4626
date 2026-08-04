# FriendKey #1659 Cross-Chain Acquisition — Deployment Status

**Status:** Live (Phase 1) — Base hub + Robinhood spoke; buy + seamless sell  
**Design:** [FriendKey Cross-Chain Acquisition](./friendkey-cross-chain-acquisition.md)  
**Scope:** FriendKey token id **1659** only

This page is the live address and role pin for Phase 1. The design brief remains the narrative; verify contracts on explorers before relying on any secondary copy.

Bridging rails (Across fills, LayerZero delivery) complete asynchronously after the user’s Robinhood transaction. On Base, buy+wrap in the Across destination handler and sink receive → sell are atomic units that revert together on failure.

## Live addresses

| Component | Address | Chain |
|-----------|---------|-------|
| Omnichain wrap (CREATE2 parity) | [`0xa1fa929f4d925bf1881657389b2ed7817ef31659`](https://basescan.org/address/0xa1fa929f4d925bf1881657389b2ed7817ef31659) | Base + [Robinhood](https://robinhoodchain.blockscout.com/address/0xa1fa929f4d925bf1881657389b2ed7817ef31659) |
| BuyExecutor | [`0x5B6ba024db52E7fF684a1Ea58B59c2D4760a28BA`](https://basescan.org/address/0x5B6ba024db52E7fF684a1Ea58B59c2D4760a28BA) | Base |
| SellExecutor | [`0x568A7829aF2e3a3ed022392f143DD9045829dB4B`](https://basescan.org/address/0x568A7829aF2e3a3ed022392f143DD9045829dB4B) | Base |
| SellSinkFactory | [`0xbd292916AceC21943a6Db336f212a17813a5772B`](https://basescan.org/address/0xbd292916AceC21943a6Db336f212a17813a5772B) | Base |
| FriendKey ERC-1155 (id `1659`) | [`0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F`](https://basescan.org/address/0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F) | Base |
| USDC | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) | Base |
| USDG | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) | Robinhood |
| Registry4626 | [`0x777968CB7F302f3d02C094b119a67DCA9E0b4626`](https://basescan.org/address/0x777968CB7F302f3d02C094b119a67DCA9E0b4626) | Base + Robinhood |
| Across SpokePool | [`0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64`](https://basescan.org/address/0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64) | Base |
| LayerZero EndpointV2 | [`0x1a44076050125825900e736c501f859c50fE728c`](https://basescan.org/address/0x1a44076050125825900e736c501f859c50fE728c) (eid `30184`) | Base |
| LayerZero EndpointV2 | [`0x6F475642a6e85809B1c36Fa62763669b1b48DD5B`](https://robinhoodchain.blockscout.com/address/0x6F475642a6e85809B1c36Fa62763669b1b48DD5B) (eid `30416`) | Robinhood |

Chain ids: Base `8453`, Robinhood `4663`.

## Roles

| Role | Where | Responsibility |
|------|-------|----------------|
| Hub wrap | Base | Escrows underlying FriendKey #1659; does not mint a Base-side user wrap balance |
| Spoke wrap | Robinhood | Mints/burns the representation ERC-1155 at the same CREATE2 address |
| BuyExecutor | Base | Across destination handler: USDC fill → `buyShares(1659)` → LayerZero send to Robinhood |
| SellExecutor + SellSinkFactory | Base | Seamless sell: unlock into per-user sink → curve sell → Across USDC→USDG to the user on Robinhood |
| Payment rail | Across | USDG ↔ USDC between Robinhood and Base |
| Delivery / return rail | LayerZero | Wrap inventory movement Base ↔ Robinhood |

BuyExecutor is prefunded with Base ETH to pay LayerZero wrap fees on purchase.

## Flows (one Robinhood signature each)

| Path | User action on Robinhood | Result |
|------|--------------------------|--------|
| **Buy** | One Across/USDG deposit with buy intent | Representation ERC-1155 balance on Robinhood |
| **Redeem** | `wrap.send` to the user’s address on Base | Unlock underlying FriendKey on Base (hold keys) |
| **Seamless sell** | `wrap.send` to `sinkOf(user)` on Base | Curve sell + Across → USDG on Robinhood |

Redeem and seamless sell are different destinations for the same wrap send. Sell is not a second mint path.

### Buy

1. User confirms once on Robinhood (USDG via Across).
2. Across delivers USDC to BuyExecutor on Base.
3. BuyExecutor buys FriendKey #1659 and initiates the wrap to the user’s Robinhood address in the same destination execution (reverts as a unit if wrap initiation fails).
4. User receives the representation ERC-1155 on Robinhood after LayerZero delivery.

### Redeem

1. User calls `wrap.send` on Robinhood with destination Base and recipient = their Base address (or chosen wallet).
2. Hub unlocks underlying FriendKey #1659 to that recipient.
3. User holds native FriendKey on Base.

### Seamless sell

1. One-time setup (not each sell): permissionless `SellSinkFactory.deploySink(user)` on Base.
2. User calls `wrap.send` on Robinhood to the predicted Base sink for that user.
3. Hub unlocks FriendKey into the sink; the sink’s receive hook calls SellExecutor, which sells on the curve and deposits USDC→USDG via Across to the same user address on Robinhood.
4. No separate Base approval or sell transaction is required for the seamless path.

## Trust model

- **No AlfaClub FriendKey contract changes** for Phase 1.
- BuyExecutor accepts Base USDC fills from the Across SpokePool only.
- Seamless sell is gated through the user’s CREATE2 sink → SellExecutor path.
- Robinhood wrap supply is backed 1:1 by FriendKey escrowed in the Base hub.
- LayerZero Base ↔ Robinhood pathway configured with confirmations `[15, 15]` and optional DVN threshold 3-of-5.

## Metadata and NFT rendering

| Surface | `uri(1659)` today | Wallet / explorer media |
|---------|-------------------|-------------------------|
| Omnichain wrap | Empty string | Not rendered as an NFT image yet |
| Underlying FriendKey | Application metadata id (not a portable HTTPS/IPFS JSON URL) | Resolved inside AlfaClub’s product surfaces |

Native wallet and marketplace rendering for the Robinhood wrap requires an OpenSea-compatible metadata document (name, description, `image`, attributes) pinned on **IPFS**, returned from wrap `uri(1659)`, plus collection-level `contractURI`. The live wrap has no URI setter, so that lands with a follow-on metadata-capable wrap cutover (new bytecode / address, peer rewire)—not claimed as live here.

## Phase 1 boundaries

**In scope:** FriendKey #1659 Robinhood ↔ Base buy with USDG; wrap delivery; redeem via wrap; seamless sell to USDG; no AlfaClub FriendKey contract changes.

**Out of scope:** additional token ids; secondary-market (e.g. Sudoswap) routing as an onchain dependency; alternate stablecoins or payment bridges as Phase 1 dependencies; deposit / wallet UX packaging; metadata wrap redeploy.

## Verify

- Base wrap (hub): [Basescan](https://basescan.org/address/0xa1fa929f4d925bf1881657389b2ed7817ef31659) — `isHub() == true`
- Robinhood wrap (spoke): [Blockscout](https://robinhoodchain.blockscout.com/address/0xa1fa929f4d925bf1881657389b2ed7817ef31659) — `isHub() == false`
- BuyExecutor: [Basescan](https://basescan.org/address/0x5B6ba024db52E7fF684a1Ea58B59c2D4760a28BA)
- SellExecutor: [Basescan](https://basescan.org/address/0x568A7829aF2e3a3ed022392f143DD9045829dB4B)
- SellSinkFactory: [Basescan](https://basescan.org/address/0xbd292916AceC21943a6Db336f212a17813a5772B)
