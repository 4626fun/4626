[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/auction/auctionTokenDisplaySymbol

# server/\_lib/auction/auctionTokenDisplaySymbol

## Functions

### auctionTokenDisplaySymbol()

> **auctionTokenDisplaySymbol**(`onChainSymbol`): `string` \| `null`

Defined in: [server/\_lib/auction/auctionTokenDisplaySymbol.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/auction/auctionTokenDisplaySymbol.ts#L20)

#### Parameters

##### onChainSymbol

`symbol()` from the auction ERC20

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

Display symbol for UI (e.g. wsAKITA -> ■AKITA); passthrough for normal tokens
