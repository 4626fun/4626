[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/swap/cdpApi

# src/lib/swap/cdpApi

## Type Aliases

### CdpExecuteRequest

> **CdpExecuteRequest** = [`CdpPriceRequest`](#cdppricerequest)

Defined in: [src/lib/swap/cdpApi.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L16)

***

### CdpPriceRequest

> **CdpPriceRequest** = `object`

Defined in: [src/lib/swap/cdpApi.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L5)

#### Properties

##### account?

> `optional` **account**: `string`

Defined in: [src/lib/swap/cdpApi.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L12)

##### fromAmount

> **fromAmount**: `string`

Defined in: [src/lib/swap/cdpApi.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L9)

##### fromToken

> **fromToken**: `string`

Defined in: [src/lib/swap/cdpApi.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L7)

##### network

> **network**: `string`

Defined in: [src/lib/swap/cdpApi.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L6)

##### slippageBps?

> `optional` **slippageBps**: `number`

Defined in: [src/lib/swap/cdpApi.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L11)

##### taker?

> `optional` **taker**: `string`

Defined in: [src/lib/swap/cdpApi.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L10)

##### toToken

> **toToken**: `string`

Defined in: [src/lib/swap/cdpApi.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L8)

##### useCdpPaymaster?

> `optional` **useCdpPaymaster**: `boolean`

Defined in: [src/lib/swap/cdpApi.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L13)

## Functions

### buildCdpPriceRequest()

> **buildCdpPriceRequest**(`params`): [`CdpPriceRequest`](#cdppricerequest)

Defined in: [src/lib/swap/cdpApi.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L41)

#### Parameters

##### params

###### amount

`string`

###### chainId

`number`

###### slippageTolerance

`number`

###### swapper

`string`

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

[`CdpPriceRequest`](#cdppricerequest)

***

### executeCdpSwap()

> **executeCdpSwap**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/swap/cdpApi.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L64)

#### Parameters

##### body

[`CdpPriceRequest`](#cdppricerequest)

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### fetchCdpSwapPrice()

> **fetchCdpSwapPrice**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/swap/cdpApi.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/cdpApi.ts#L60)

#### Parameters

##### body

[`CdpPriceRequest`](#cdppricerequest)

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>
