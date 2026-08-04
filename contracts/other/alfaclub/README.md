# AlfaClub FriendKey

Public pin of the live **AlfaClub FriendKey** multi-id omnichain ERC-1155 wrap and Across payment adapters.

## What this is

- One LayerZero OApp ERC-1155 collection wrapping allowlisted AlfaClub FriendKey token ids.
- **Base** = hub (escrows underlying FriendKey; no Base-side user wrap balance).
- **Robinhood** = first spoke (mints/burns the representation at the same CREATE2 address) and USDG payment lane via Across.
- Additional chains can be peered for hold / redeem / bridge; buy/sell adapters stay rail-specific.

## Live CREATE2 wrap

| Role | Address | Chains |
|------|---------|--------|
| Wrap | `0xA1FaC792D1643F9178FcAFF61b5e08B3EAe01155` | Base + Robinhood |


## Layout

```
alfaclub/
├── interfaces/     IAlfaFriendKey, IFriendKeyOERC1155
├── omnichain/      FriendKeyOERC1155 + FriendKeyMsgCodec
└── across/         BuyExecutor, SellExecutor, SellSink, SellSinkFactory
```

## Source of truth

Live addresses, peers, ULN, metadata CIDs, and buy proof:

- [`docs/designs/friendkey-cross-chain-acquisition-status.md`](../../../docs/designs/friendkey-cross-chain-acquisition-status.md)
- Redacted pins: `deployments/base/friendkey-oerc1155.json`, `deployments/robinhood/friendkey-oerc1155.json`

Design narrative: [`docs/designs/friendkey-cross-chain-acquisition.md`](../../../docs/designs/friendkey-cross-chain-acquisition.md).

## Dependencies (not vendored here)

Imports match the rest of this repo:

- OpenZeppelin (`@openzeppelin/...`)
- LayerZero OApp (`@layerzerolabs/oapp-evm/...`)
- Shared registry interface (`@4626/shared/interfaces/core/IRegistry4626.sol`)

Across SpokePool is an external Base address; executors call it / accept fills from it. Do not vendor entire LZ/OZ trees for this pin.

## Seed token

- **AKITA FriendKey #1659** (first allowlisted id)
- Token URI CID: `bafkreidgl52oyplecrkzdocdvruorcgi6b7kyzpe62wbosws3nrxlkdy7i`
- Collection URI CID: `bafkreieeqqxndcflkzfzw2m622hljytb5pnrhnnavbhlfhuhswhgkrmyua`
