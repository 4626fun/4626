[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/swapZoraHoldings

# src/lib/swap/swapZoraHoldings

## Functions

### fetchSwapZoraHoldings()

> **fetchSwapZoraHoldings**(`ownerAddress`): `Promise`\<[`SwapZoraHoldingRow`](../zora/walletHoldings.md#swapzoraholdingrow)[]\>

Defined in: [src/lib/swap/swapZoraHoldings.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapZoraHoldings.ts#L117)

Canonical path: one API call for all Zora creator/content coins on a CSW (or any wallet).

#### Parameters

##### ownerAddress

`string`

#### Returns

`Promise`\<[`SwapZoraHoldingRow`](../zora/walletHoldings.md#swapzoraholdingrow)[]\>

***

### resolveSwapZoraHoldings()

> **resolveSwapZoraHoldings**(`params`): `Promise`\<[`SwapZoraHoldingRow`](../zora/walletHoldings.md#swapzoraholdingrow)[]\>

Defined in: [src/lib/swap/swapZoraHoldings.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapZoraHoldings.ts#L40)

Client-side resolver (tests + offline). Production paths use `fetchSwapZoraHoldings` → API.

#### Parameters

##### params

###### batch

[`AccountTrayPortfolioBatch`](../debank/client.md#accounttrayportfoliobatch) \| `null`

###### fetchCoin?

(`address`) => `Promise`\<`unknown`\>

###### ownerAddress

`string`

#### Returns

`Promise`\<[`SwapZoraHoldingRow`](../zora/walletHoldings.md#swapzoraholdingrow)[]\>

***

### swapZoraHoldingsToBalanceMap()

> **swapZoraHoldingsToBalanceMap**(`rows`): `Map`\<`string`, `string`\>

Defined in: [src/lib/swap/swapZoraHoldings.ts:126](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapZoraHoldings.ts#L126)

#### Parameters

##### rows

[`SwapZoraHoldingRow`](../zora/walletHoldings.md#swapzoraholdingrow)[]

#### Returns

`Map`\<`string`, `string`\>

## References

### SwapZoraHoldingRow

Re-exports [SwapZoraHoldingRow](../zora/walletHoldings.md#swapzoraholdingrow)
