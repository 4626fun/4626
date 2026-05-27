[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/swapZoraHoldings

# src/lib/swap/swapZoraHoldings

## Type Aliases

### SwapZoraHoldingRow

> **SwapZoraHoldingRow** = `object`

Defined in: src/lib/swap/swapZoraHoldings.ts:18

#### Properties

##### balanceFormatted

> **balanceFormatted**: `string`

Defined in: src/lib/swap/swapZoraHoldings.ts:20

##### option

> **option**: [`SwapTokenOption`](../../components/swap/TokenSelectorModal.md#swaptokenoption)

Defined in: src/lib/swap/swapZoraHoldings.ts:19

## Functions

### fetchSwapZoraHoldings()

> **fetchSwapZoraHoldings**(`ownerAddress`): `Promise`\<[`SwapZoraHoldingRow`](#swapzoraholdingrow)[]\>

Defined in: src/lib/swap/swapZoraHoldings.ts:115

#### Parameters

##### ownerAddress

`string`

#### Returns

`Promise`\<[`SwapZoraHoldingRow`](#swapzoraholdingrow)[]\>

***

### resolveSwapZoraHoldings()

> **resolveSwapZoraHoldings**(`params`): `Promise`\<[`SwapZoraHoldingRow`](#swapzoraholdingrow)[]\>

Defined in: src/lib/swap/swapZoraHoldings.ts:41

#### Parameters

##### params

###### batch

[`AccountTrayPortfolioBatch`](../debank/client.md#accounttrayportfoliobatch) \| `null`

###### fetchCoin?

(`address`) => `Promise`\<[`ZoraCoin`](../zora/types.md#zoracoin) \| `null`\>

###### ownerAddress

`string`

#### Returns

`Promise`\<[`SwapZoraHoldingRow`](#swapzoraholdingrow)[]\>

***

### swapZoraHoldingsToBalanceMap()

> **swapZoraHoldingsToBalanceMap**(`rows`): `Map`\<`string`, `string`\>

Defined in: src/lib/swap/swapZoraHoldings.ts:125

#### Parameters

##### rows

[`SwapZoraHoldingRow`](#swapzoraholdingrow)[]

#### Returns

`Map`\<`string`, `string`\>
