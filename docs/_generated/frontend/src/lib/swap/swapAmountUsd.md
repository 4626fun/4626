[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/swapAmountUsd

# src/lib/swap/swapAmountUsd

## Type Aliases

### SwapUsdPriceContext

> **SwapUsdPriceContext** = `object`

Defined in: [src/lib/swap/swapAmountUsd.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L34)

#### Properties

##### ethUsd

> **ethUsd**: `number`

Defined in: [src/lib/swap/swapAmountUsd.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L35)

##### tokenUsdByAddress

> **tokenUsdByAddress**: `ReadonlyMap`\<`string`, `number`\>

Defined in: [src/lib/swap/swapAmountUsd.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L36)

## Functions

### collectSwapTokenPriceLookups()

> **collectSwapTokenPriceLookups**(`tokenIn`, `tokenOut`): `string`[]

Defined in: [src/lib/swap/swapAmountUsd.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L112)

#### Parameters

##### tokenIn

`string`

##### tokenOut

`string`

#### Returns

`string`[]

***

### deriveSwapUsdEstimates()

> **deriveSwapUsdEstimates**(`params`): `object`

Defined in: [src/lib/swap/swapAmountUsd.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L89)

#### Parameters

##### params

###### amountInUnits

`string`

###### estimatedOut

`string`

###### prices

[`SwapUsdPriceContext`](#swapusdpricecontext)

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

`object`

##### amountInUsd

> **amountInUsd**: `string` \| `null`

##### estimatedOutUsd

> **estimatedOutUsd**: `string` \| `null`

***

### formatSwapUsd()

> **formatSwapUsd**(`value`): `string`

Defined in: [src/lib/swap/swapAmountUsd.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L21)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### isNativeEthToken()

> **isNativeEthToken**(`address`): `boolean`

Defined in: [src/lib/swap/swapAmountUsd.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L61)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### isUsdStablecoinToken()

> **isUsdStablecoinToken**(`address`): `boolean`

Defined in: [src/lib/swap/swapAmountUsd.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L55)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### parsePositiveHumanAmount()

> **parsePositiveHumanAmount**(`value`): `number` \| `null`

Defined in: [src/lib/swap/swapAmountUsd.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapAmountUsd.ts#L47)

#### Parameters

##### value

`string`

#### Returns

`number` \| `null`
