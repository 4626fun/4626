[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / src/lib/swap/adapters/uniswapAdapter

# src/lib/swap/adapters/uniswapAdapter

## Type Aliases

### UniswapPermitSigner()

> **UniswapPermitSigner** = (`args`) => `Promise`\<\{ `permitData?`: `Record`\<`string`, `unknown`\>; `signature?`: `string`; \}\>

Defined in: [src/lib/swap/adapters/uniswapAdapter.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/adapters/uniswapAdapter.ts#L32)

#### Parameters

##### args

###### quote

[`TradeQuoteResponse`](../../uniswap/tradingApi.md#tradequoteresponse)

#### Returns

`Promise`\<\{ `permitData?`: `Record`\<`string`, `unknown`\>; `signature?`: `string`; \}\>

## Functions

### getUniswapPermitPayload()

> **getUniswapPermitPayload**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/swap/adapters/uniswapAdapter.ts:198](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/adapters/uniswapAdapter.ts#L198)

#### Parameters

##### quote

[`TradeQuoteResponse`](../../uniswap/tradingApi.md#tradequoteresponse)

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### getUniswapPermitSignPayload()

> **getUniswapPermitSignPayload**(`permitData`): [`PermitSignPayload`](../../uniswap/tradingApi.md#permitsignpayload) \| `null`

Defined in: [src/lib/swap/adapters/uniswapAdapter.ts:202](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/adapters/uniswapAdapter.ts#L202)

#### Parameters

##### permitData

`Record`\<`string`, `unknown`\>

#### Returns

[`PermitSignPayload`](../../uniswap/tradingApi.md#permitsignpayload) \| `null`

***

### normalizeUniswapExecutionTx()

> **normalizeUniswapExecutionTx**(`tx`, `signerAddress`, `chainId`): `object`

Defined in: [src/lib/swap/adapters/uniswapAdapter.ts:206](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/adapters/uniswapAdapter.ts#L206)

#### Parameters

##### tx

`Record`\<`string`, `unknown`\>

##### signerAddress

`string` | `null`

##### chainId

`number`

#### Returns

##### chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

##### data

> **data**: `string`

###### Description

The calldata for the transaction.

##### from

> **from**: `string`

##### gasLimit?

> `optional` **gasLimit**: `string`

##### gasPrice?

> `optional` **gasPrice**: `string`

##### maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

##### maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

##### to

> **to**: `string`

##### value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

***

### reviewUniswapSwap()

> **reviewUniswapSwap**(`params`): `Promise`\<[`SwapReviewResult`](../types.md#swapreviewresult)\>

Defined in: [src/lib/swap/adapters/uniswapAdapter.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/adapters/uniswapAdapter.ts#L110)

#### Parameters

##### params

###### deadlineSeconds

`number`

###### request

[`SwapReviewRequest`](../types.md#swapreviewrequest)

###### signPermitIfRequired

[`UniswapPermitSigner`](#uniswappermitsigner)

#### Returns

`Promise`\<[`SwapReviewResult`](../types.md#swapreviewresult)\>

***

### submitUniswapOrder()

> **submitUniswapOrder**(`orderRequest`): `Promise`\<\{ `orderId`: `string`; `orderStatus`: `"error"` \| `"open"` \| `"expired"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`; `requestId`: `string`; \}\>

Defined in: [src/lib/swap/adapters/uniswapAdapter.ts:186](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/adapters/uniswapAdapter.ts#L186)

#### Parameters

##### orderRequest

###### quote

`Record`\<`string`, `unknown`\>

###### routing?

`"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### signature

`string`

#### Returns

`Promise`\<\{ `orderId`: `string`; `orderStatus`: `"error"` \| `"open"` \| `"expired"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`; `requestId`: `string`; \}\>
