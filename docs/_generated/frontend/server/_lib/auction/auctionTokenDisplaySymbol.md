[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/auction/auctionTokenDisplaySymbol

# server/\_lib/auction/auctionTokenDisplaySymbol

## Functions

### auctionTokenDisplaySymbol()

> **auctionTokenDisplaySymbol**(`onChainSymbol`): `string` \| `null`

Defined in: [server/\_lib/auction/auctionTokenDisplaySymbol.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/auction/auctionTokenDisplaySymbol.ts#L20)

#### Parameters

##### onChainSymbol

`symbol()` from the auction ERC20

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

Display symbol for UI (e.g. wsAKITA -> ■AKITA); passthrough for normal tokens
