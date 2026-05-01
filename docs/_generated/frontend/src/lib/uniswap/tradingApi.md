[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/tradingApi

# src/lib/uniswap/tradingApi

## Type Aliases

### ApprovalRequest

> **ApprovalRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"ApprovalRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L20)

***

### ApprovalResponse

> **ApprovalResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"ApprovalResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L21)

***

### BuildSwapParams

> **BuildSwapParams** = `Omit`\<[`CreateSwapRequest`](#createswaprequest), `"quote"` \| `"permitData"`\> & `object`

Defined in: [src/lib/uniswap/tradingApi.ts:487](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L487)

#### Type Declaration

##### permit2Disabled?

> `optional` **permit2Disabled**: `boolean`

##### permitData?

> `optional` **permitData**: `Record`\<`string`, `unknown`\>

##### quote

> **quote**: `Record`\<`string`, `unknown`\>

***

### CreateOrderParams

> **CreateOrderParams** = `Omit`\<[`OrderRequest`](#orderrequest), `"quote"`\> & `object`

Defined in: [src/lib/uniswap/tradingApi.ts:517](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L517)

#### Type Declaration

##### quote

> **quote**: `Record`\<`string`, `unknown`\>

***

### CreateSwapRequest

> **CreateSwapRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"CreateSwapRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L23)

***

### CreateSwapResponse

> **CreateSwapResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"CreateSwapResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L24)

***

### OrderRequest

> **OrderRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"OrderRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L25)

***

### OrderResponse

> **OrderResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"OrderResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L26)

***

### PermitSignPayload

> **PermitSignPayload** = `object`

Defined in: [src/lib/uniswap/tradingApi.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L59)

#### Properties

##### domain

> **domain**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L60)

##### message

> **message**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L63)

##### primaryType

> **primaryType**: `string`

Defined in: [src/lib/uniswap/tradingApi.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L62)

##### types

> **types**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L61)

***

### ProtocolSwapRouting

> **ProtocolSwapRouting** = `Extract`\<[`Routing`](#routing), `"CLASSIC"` \| `"WRAP"` \| `"UNWRAP"` \| `"BRIDGE"`\>

Defined in: [src/lib/uniswap/tradingApi.ts:337](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L337)

***

### QuoteRequest

> **QuoteRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"QuoteRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L18)

***

### QuoteResponse

> **QuoteResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"QuoteResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L19)

***

### Routing

> **Routing** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"Routing"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L17)

***

### TradeApprovalResponse

> **TradeApprovalResponse** = `Omit`\<[`ApprovalResponse`](#approvalresponse), `"approval"` \| `"cancel"`\> & `object` & `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L53)

#### Type Declaration

##### approval

> **approval**: [`TransactionRequest`](#transactionrequest) \| `null`

##### cancel

> **cancel**: [`TransactionRequest`](#transactionrequest) \| `null`

***

### TradeQuoteRequest

> **TradeQuoteRequest** = [`QuoteRequest`](#quoterequest) & `object`

Defined in: [src/lib/uniswap/tradingApi.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L30)

#### Type Declaration

##### chainedActionsEnabled?

> `optional` **chainedActionsEnabled**: `boolean`

##### providerOverride?

> `optional` **providerOverride**: `"uniswap"` \| `"cdp"`

##### walletModeKey?

> `optional` **walletModeKey**: `"canonical"` \| `"eoa"`

##### xChainedActionsEnabled?

> `optional` **xChainedActionsEnabled**: `boolean`

***

### TradeQuoteResponse

> **TradeQuoteResponse** = [`QuoteResponse`](#quoteresponse) & `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L39)

***

### TransactionRequest

> **TransactionRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"TransactionRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L22)

***

### UniswapXRouting

> **UniswapXRouting** = `Extract`\<[`Routing`](#routing), `"DUTCH_LIMIT"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"LIMIT_ORDER"` \| `"PRIORITY"`\>

Defined in: [src/lib/uniswap/tradingApi.ts:338](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L338)

***

### UserOpCall

> **UserOpCall** = `object`

Defined in: [src/lib/uniswap/tradingApi.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L58)

#### Properties

##### data?

> `optional` **data**: `` `0x${string}` ``

Defined in: [src/lib/uniswap/tradingApi.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L58)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/uniswap/tradingApi.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L58)

##### value?

> `optional` **value**: `bigint`

Defined in: [src/lib/uniswap/tradingApi.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L58)

***

### WalletCheckDelegationRequestBody

> **WalletCheckDelegationRequestBody** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"WalletCheckDelegationRequestBody"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L27)

***

### WalletCheckDelegationResponseBody

> **WalletCheckDelegationResponseBody** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"WalletCheckDelegationResponseBody"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L28)

## Functions

### assertValidSwapTransaction()

> **assertValidSwapTransaction**(`tx`): `void`

Defined in: [src/lib/uniswap/tradingApi.ts:527](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L527)

#### Parameters

##### tx

###### chainId

`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### data

`string`

**Description**

The calldata for the transaction.

###### from

`string`

###### gasLimit?

`string`

###### gasPrice?

`string`

###### maxFeePerGas?

`string`

###### maxPriorityFeePerGas?

`string`

###### to

`string`

###### value

`string`

**Description**

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

#### Returns

`void`

***

### buildSwap()

> **buildSwap**(`body`): `Promise`\<\{ `gasFee?`: `string`; `requestId`: `string`; `swap`: \{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}; \}\>

Defined in: [src/lib/uniswap/tradingApi.ts:493](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L493)

#### Parameters

##### body

[`BuildSwapParams`](#buildswapparams)

#### Returns

`Promise`\<\{ `gasFee?`: `string`; `requestId`: `string`; `swap`: \{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}; \}\>

***

### buildSwap5792()

> **buildSwap5792**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:545](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L545)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### buildSwap7702()

> **buildSwap7702**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:561](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L561)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### checkTradeApproval()

> **checkTradeApproval**(`body`): `Promise`\<[`TradeApprovalResponse`](#tradeapprovalresponse)\>

Defined in: [src/lib/uniswap/tradingApi.ts:474](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L474)

#### Parameters

##### body

`object` & `object`

#### Returns

`Promise`\<[`TradeApprovalResponse`](#tradeapprovalresponse)\>

***

### createCrossChainPlan()

> **createCrossChainPlan**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:571](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L571)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### createOrder()

> **createOrder**(`body`): `Promise`\<\{ `orderId`: `string`; `orderStatus`: `"error"` \| `"expired"` \| `"cancelled"` \| `"open"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`; `requestId`: `string`; \}\>

Defined in: [src/lib/uniswap/tradingApi.ts:521](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L521)

#### Parameters

##### body

[`CreateOrderParams`](#createorderparams)

#### Returns

`Promise`\<\{ `orderId`: `string`; `orderStatus`: `"error"` \| `"expired"` \| `"cancelled"` \| `"open"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`; `requestId`: `string`; \}\>

***

### fetchDelegationStatus()

> **fetchDelegationStatus**(`body`): `Promise`\<`object` & `Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:565](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L565)

#### Parameters

##### body

###### chainIds

(`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`)[]

**Description**

Array of chain IDs to check delegation status for.

###### walletAddresses?

`string`[]

**Description**

Array of wallet addresses to check delegation status for.

#### Returns

`Promise`\<`object` & `Record`\<`string`, `unknown`\>\>

***

### fetchTradeQuote()

> **fetchTradeQuote**(`body`): `Promise`\<[`TradeQuoteResponse`](#tradequoteresponse)\>

Defined in: [src/lib/uniswap/tradingApi.ts:422](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L422)

#### Parameters

##### body

[`TradeQuoteRequest`](#tradequoterequest)

#### Returns

`Promise`\<[`TradeQuoteResponse`](#tradequoteresponse)\>

***

### getCrossChainPlan()

> **getCrossChainPlan**(`planId`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:575](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L575)

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### isProtocolSwapRouting()

> **isProtocolSwapRouting**(`routing`): `routing is ProtocolSwapRouting`

Defined in: [src/lib/uniswap/tradingApi.ts:340](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L340)

#### Parameters

##### routing

`unknown`

#### Returns

`routing is ProtocolSwapRouting`

***

### isUniswapXRouting()

> **isUniswapXRouting**(`routing`): `routing is UniswapXRouting`

Defined in: [src/lib/uniswap/tradingApi.ts:345](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L345)

#### Parameters

##### routing

`unknown`

#### Returns

`routing is UniswapXRouting`

***

### pickOrderQuote()

> **pickOrderQuote**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:375](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L375)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### pickPermitData()

> **pickPermitData**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:381](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L381)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### pickQuote()

> **pickQuote**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:350](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L350)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### pickSwapQuote()

> **pickSwapQuote**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:368](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L368)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### toPermitSignPayload()

> **toPermitSignPayload**(`permitData`): [`PermitSignPayload`](#permitsignpayload) \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:397](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L397)

#### Parameters

##### permitData

`Record`\<`string`, `unknown`\>

#### Returns

[`PermitSignPayload`](#permitsignpayload) \| `null`

***

### toUserOpCallsFrom5792()

> **toUserOpCallsFrom5792**(`batch`): [`UserOpCall`](#useropcall)[]

Defined in: [src/lib/uniswap/tradingApi.ts:549](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L549)

#### Parameters

##### batch

`Record`\<`string`, `unknown`\>

#### Returns

[`UserOpCall`](#useropcall)[]

***

### updateCrossChainPlan()

> **updateCrossChainPlan**(`planId`, `body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:579](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L579)

#### Parameters

##### planId

`string`

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>
