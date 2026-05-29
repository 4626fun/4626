[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/uniswap/liquidityApi

# src/lib/uniswap/liquidityApi

## Type Aliases

### LiquidityAction

> **LiquidityAction** = `"positions"` \| `"quote-create"` \| `"create"` \| `"add"` \| `"remove"` \| `"claim"` \| `"migrate"`

Defined in: [src/lib/uniswap/liquidityApi.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L4)

***

### LiquidityRequest

> **LiquidityRequest**\<`T`\> = `object`

Defined in: [src/lib/uniswap/liquidityApi.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L6)

#### Type Parameters

##### T

`T` = `Record`\<`string`, `unknown`\>

#### Properties

##### action

> **action**: [`LiquidityAction`](#liquidityaction)

Defined in: [src/lib/uniswap/liquidityApi.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L7)

##### payload

> **payload**: `T`

Defined in: [src/lib/uniswap/liquidityApi.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L8)

## Functions

### addLiquidity()

> **addLiquidity**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L42)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### callLiquidityApi()

> **callLiquidityApi**\<`T`\>(`body`): `Promise`\<`T`\>

Defined in: [src/lib/uniswap/liquidityApi.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L11)

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

Defined in: [src/lib/uniswap/liquidityApi.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L50)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### createPosition()

> **createPosition**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L38)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### fetchLiquidityPositions()

> **fetchLiquidityPositions**(`walletAddress`, `chainId`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L30)

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

Defined in: [src/lib/uniswap/liquidityApi.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L34)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### removeLiquidity()

> **removeLiquidity**(`payload`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/liquidityApi.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/liquidityApi.ts#L46)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>
