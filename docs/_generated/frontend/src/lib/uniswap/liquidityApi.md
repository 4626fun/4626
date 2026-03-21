[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/liquidityApi

# src/lib/uniswap/liquidityApi

## Type Aliases

### LiquidityAction

> **LiquidityAction** = `"positions"` \| `"quote-create"` \| `"create"` \| `"add"` \| `"remove"` \| `"claim"` \| `"migrate"`

Defined in: [src/lib/uniswap/liquidityApi.ts:5](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L5)

***

### LiquidityRequest

> **LiquidityRequest**\<`T`\> = `object`

Defined in: [src/lib/uniswap/liquidityApi.ts:7](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L7)

#### Type Parameters

##### T

`T` = `Record`\<`string`, `unknown`\>

#### Properties

##### action

> **action**: [`LiquidityAction`](#liquidityaction)

Defined in: [src/lib/uniswap/liquidityApi.ts:8](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L8)

##### payload

> **payload**: `T`

Defined in: [src/lib/uniswap/liquidityApi.ts:9](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L9)

## Functions

### addLiquidity()

> **addLiquidity**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:43](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L43)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### callLiquidityApi()

> **callLiquidityApi**\<`T`\>(`body`): `Promise`\<`T`\>

Defined in: [src/lib/uniswap/liquidityApi.ts:12](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L12)

#### Type Parameters

##### T

`T` = `Record`\<`string`, `unknown`\>

#### Parameters

##### body

[`LiquidityRequest`](#liquidityrequest)

#### Returns

`Promise`\<`T`\>

***

### claimLiquidityFees()

> **claimLiquidityFees**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:51](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L51)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### createPosition()

> **createPosition**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:39](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L39)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### fetchLiquidityPositions()

> **fetchLiquidityPositions**(`walletAddress`, `chainId`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:31](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L31)

#### Parameters

##### walletAddress

`string`

##### chainId

`number`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### quoteCreatePosition()

> **quoteCreatePosition**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:35](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L35)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### removeLiquidity()

> **removeLiquidity**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:47](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/uniswap/liquidityApi.ts#L47)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>
