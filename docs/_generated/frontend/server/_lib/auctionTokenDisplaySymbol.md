[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/auctionTokenDisplaySymbol

# server/\_lib/auctionTokenDisplaySymbol

## Functions

### auctionTokenDisplaySymbol()

> **auctionTokenDisplaySymbol**(`onChainSymbol`): `string` \| `null`

Defined in: [server/\_lib/auctionTokenDisplaySymbol.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/auctionTokenDisplaySymbol.ts#L20)

#### Parameters

##### onChainSymbol

`symbol()` from the auction ERC20

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

Display symbol for UI (e.g. wsAKITA -> ■AKITA); passthrough for normal tokens
