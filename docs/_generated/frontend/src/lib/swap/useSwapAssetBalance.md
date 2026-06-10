[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/useSwapAssetBalance

# src/lib/swap/useSwapAssetBalance

## Type Aliases

### SwapAssetBalance

> **SwapAssetBalance** = `object`

Defined in: [src/lib/swap/useSwapAssetBalance.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L8)

#### Properties

##### decimals

> **decimals**: `number`

Defined in: [src/lib/swap/useSwapAssetBalance.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L10)

##### formatted

> **formatted**: `string`

Defined in: [src/lib/swap/useSwapAssetBalance.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L11)

##### raw

> **raw**: `bigint`

Defined in: [src/lib/swap/useSwapAssetBalance.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L9)

## Functions

### fetchSwapAssetBalanceViaApi()

> **fetchSwapAssetBalanceViaApi**(`params`): `Promise`\<[`SwapAssetBalance`](#swapassetbalance)\>

Defined in: [src/lib/swap/useSwapAssetBalance.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L20)

#### Parameters

##### params

###### ownerAddress

`string`

###### tokenAddress

`string`

#### Returns

`Promise`\<[`SwapAssetBalance`](#swapassetbalance)\>

***

### swapAssetBalanceQueryKey()

> **swapAssetBalanceQueryKey**(`params`): readonly \[`"swap"`, `"asset-balance"`, `number`, `string` \| `null`, `string`\]

Defined in: [src/lib/swap/useSwapAssetBalance.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L40)

#### Parameters

##### params

###### chainId

`number`

###### ownerAddress

`string` \| `null` \| `undefined`

###### tokenAddress

`string`

#### Returns

readonly \[`"swap"`, `"asset-balance"`, `number`, `string` \| `null`, `string`\]

***

### useSwapAssetBalance()

> **useSwapAssetBalance**(`params`): `UseQueryResult`\<[`SwapAssetBalance`](#swapassetbalance), `Error`\>

Defined in: [src/lib/swap/useSwapAssetBalance.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/useSwapAssetBalance.ts#L54)

#### Parameters

##### params

###### chainId

`number`

###### enabled?

`boolean`

###### ownerAddress

`string` \| `null` \| `undefined`

###### tokenAddress

`string`

#### Returns

`UseQueryResult`\<[`SwapAssetBalance`](#swapassetbalance), `Error`\>
