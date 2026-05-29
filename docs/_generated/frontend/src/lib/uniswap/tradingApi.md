[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/uniswap/tradingApi

# src/lib/uniswap/tradingApi

## Type Aliases

### ApprovalRequest

> **ApprovalRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"ApprovalRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L32)

***

### ApprovalResponse

> **ApprovalResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"ApprovalResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L33)

***

### BuildSwapParams

> **BuildSwapParams** = `Omit`\<[`CreateSwapRequest`](#createswaprequest), `"quote"` \| `"permitData"`\> & `object`

Defined in: [src/lib/uniswap/tradingApi.ts:519](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L519)

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

Defined in: [src/lib/uniswap/tradingApi.ts:579](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L579)

#### Type Declaration

##### quote

> **quote**: `Record`\<`string`, `unknown`\>

***

### CreateSwapRequest

> **CreateSwapRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"CreateSwapRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L35)

***

### CreateSwapResponse

> **CreateSwapResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"CreateSwapResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L36)

***

### OrderRequest

> **OrderRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"OrderRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L37)

***

### OrderResponse

> **OrderResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"OrderResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L38)

***

### PermitSignPayload

> **PermitSignPayload** = `object`

Defined in: [src/lib/uniswap/tradingApi.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L73)

#### Properties

##### domain

> **domain**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L74)

##### message

> **message**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L77)

##### primaryType

> **primaryType**: `string`

Defined in: [src/lib/uniswap/tradingApi.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L76)

##### types

> **types**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L75)

***

### ProtocolSwapRouting

> **ProtocolSwapRouting** = `Extract`\<[`Routing`](#routing), `"CLASSIC"` \| `"WRAP"` \| `"UNWRAP"` \| `"BRIDGE"`\>

Defined in: [src/lib/uniswap/tradingApi.ts:351](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L351)

***

### QuoteRequest

> **QuoteRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"QuoteRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L30)

***

### QuoteResponse

> **QuoteResponse** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"QuoteResponse"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L31)

***

### Routing

> **Routing** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"Routing"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L29)

***

### TradeApprovalResponse

> **TradeApprovalResponse** = `Omit`\<[`ApprovalResponse`](#approvalresponse), `"approval"` \| `"cancel"`\> & `object` & `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L67)

#### Type Declaration

##### approval

> **approval**: [`TransactionRequest`](#transactionrequest) \| `null`

##### cancel

> **cancel**: [`TransactionRequest`](#transactionrequest) \| `null`

***

### TradeQuoteRequest

> **TradeQuoteRequest** = [`QuoteRequest`](#quoterequest) & `object`

Defined in: [src/lib/uniswap/tradingApi.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L42)

#### Type Declaration

##### chainedActionsEnabled?

> `optional` **chainedActionsEnabled**: `boolean`

##### providerOverride?

> `optional` **providerOverride**: `"uniswap"` \| `"cdp"`

##### useZoraTradeRoute?

> `optional` **useZoraTradeRoute**: `boolean`

When true and pair is on Base, quote via Zora coins SDK (creator-coin pools).

##### walletModeKey?

> `optional` **walletModeKey**: `"canonical"` \| `"eoa"`

##### xChainedActionsEnabled?

> `optional` **xChainedActionsEnabled**: `boolean`

***

### TradeQuoteResponse

> **TradeQuoteResponse** = [`QuoteResponse`](#quoteresponse) & `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/tradingApi.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L53)

***

### TransactionRequest

> **TransactionRequest** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"TransactionRequest"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L34)

***

### UniswapXRouting

> **UniswapXRouting** = `Extract`\<[`Routing`](#routing), `"DUTCH_LIMIT"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"LIMIT_ORDER"` \| `"PRIORITY"`\>

Defined in: [src/lib/uniswap/tradingApi.ts:352](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L352)

***

### UserOpCall

> **UserOpCall** = `object`

Defined in: [src/lib/uniswap/tradingApi.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L72)

#### Properties

##### data?

> `optional` **data**: `` `0x${string}` ``

Defined in: [src/lib/uniswap/tradingApi.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L72)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/uniswap/tradingApi.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L72)

##### value?

> `optional` **value**: `bigint`

Defined in: [src/lib/uniswap/tradingApi.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L72)

***

### WalletCheckDelegationRequestBody

> **WalletCheckDelegationRequestBody** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"WalletCheckDelegationRequestBody"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L39)

***

### WalletCheckDelegationResponseBody

> **WalletCheckDelegationResponseBody** = [`components`](generated/tradeApi.md#components)\[`"schemas"`\]\[`"WalletCheckDelegationResponseBody"`\]

Defined in: [src/lib/uniswap/tradingApi.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L40)

## Functions

### assertValidSwapTransaction()

> **assertValidSwapTransaction**(`tx`): `void`

Defined in: [src/lib/uniswap/tradingApi.ts:589](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L589)

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

Defined in: [src/lib/uniswap/tradingApi.ts:525](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L525)

#### Parameters

##### body

`Omit`\<\{ `deadline?`: `number`; `includeGasInfo`: `boolean`; `permitData?`: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \}; `quote`: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `10` \| `56` \| `8453` \| `42161` \| `137` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: ... \| ...; `amountIn?`: ... \| ...; `amountOut?`: ... \| ...; `reserve0?`: ... \| ...; `reserve1?`: ... \| ...; `tokenIn?`: ... \| ...; `tokenOut?`: ... \| ...; `type`: `string`; \} \| \{ `address?`: ... \| ...; `amountIn?`: ... \| ...; `amountOut?`: ... \| ...; `fee?`: ... \| ...; `liquidity?`: ... \| ...; `sqrtRatioX96?`: ... \| ...; `tickCurrent?`: ... \| ...; `tokenIn?`: ... \| ...; `tokenOut?`: ... \| ...; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: ... \| ...; `amountOut?`: ... \| ...; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `10` \| `56` \| `8453` \| `42161` \| `137` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `10` \| `56` \| `8453` \| `42161` \| `137` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `10` \| `56` \| `8453` \| `42161` \| `137` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}; `refreshGasPrice`: `boolean`; `safetyMode?`: `"SAFE"`; `signature?`: `string`; `simulateTransaction`: `boolean`; `urgency?`: `"normal"` \| `"fast"` \| `"urgent"`; \}, `"quote"` \| `"permitData"`\> & `object` & `object`

#### Returns

`Promise`\<\{ `gasFee?`: `string`; `requestId`: `string`; `swap`: \{ `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `data`: `string`; `from`: `string`; `gasLimit?`: `string`; `gasPrice?`: `string`; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `to`: `string`; `value`: `string`; \}; \}\>

***

### buildSwap5792()

> **buildSwap5792**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:609](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L609)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### buildSwap7702()

> **buildSwap7702**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:625](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L625)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### checkTradeApproval()

> **checkTradeApproval**(`body`): `Promise`\<[`TradeApprovalResponse`](#tradeapprovalresponse)\>

Defined in: [src/lib/uniswap/tradingApi.ts:506](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L506)

#### Parameters

##### body

`object` & `object`

#### Returns

`Promise`\<[`TradeApprovalResponse`](#tradeapprovalresponse)\>

***

### createCrossChainPlan()

> **createCrossChainPlan**(`body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:635](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L635)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### createOrder()

> **createOrder**(`body`): `Promise`\<\{ `orderId`: `string`; `orderStatus`: `"error"` \| `"expired"` \| `"cancelled"` \| `"open"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`; `requestId`: `string`; \}\>

Defined in: [src/lib/uniswap/tradingApi.ts:583](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L583)

#### Parameters

##### body

[`CreateOrderParams`](#createorderparams)

#### Returns

`Promise`\<\{ `orderId`: `string`; `orderStatus`: `"error"` \| `"expired"` \| `"cancelled"` \| `"open"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`; `requestId`: `string`; \}\>

***

### fetchDelegationStatus()

> **fetchDelegationStatus**(`body`): `Promise`\<`object` & `Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:629](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L629)

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

Defined in: [src/lib/uniswap/tradingApi.ts:436](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L436)

#### Parameters

##### body

[`TradeQuoteRequest`](#tradequoterequest)

#### Returns

`Promise`\<[`TradeQuoteResponse`](#tradequoteresponse)\>

***

### getCrossChainPlan()

> **getCrossChainPlan**(`planId`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:639](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L639)

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### isProtocolSwapRouting()

> **isProtocolSwapRouting**(`routing`): `routing is ProtocolSwapRouting`

Defined in: [src/lib/uniswap/tradingApi.ts:354](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L354)

#### Parameters

##### routing

`unknown`

#### Returns

`routing is ProtocolSwapRouting`

***

### isUniswapXRouting()

> **isUniswapXRouting**(`routing`): `routing is UniswapXRouting`

Defined in: [src/lib/uniswap/tradingApi.ts:359](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L359)

#### Parameters

##### routing

`unknown`

#### Returns

`routing is UniswapXRouting`

***

### pickOrderQuote()

> **pickOrderQuote**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:389](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L389)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### pickPermitData()

> **pickPermitData**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:395](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L395)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### pickQuote()

> **pickQuote**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:364](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L364)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### pickSwapQuote()

> **pickSwapQuote**(`quote`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:382](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L382)

#### Parameters

##### quote

[`TradeQuoteResponse`](#tradequoteresponse) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### toPermitSignPayload()

> **toPermitSignPayload**(`permitData`): [`PermitSignPayload`](#permitsignpayload) \| `null`

Defined in: [src/lib/uniswap/tradingApi.ts:411](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L411)

#### Parameters

##### permitData

`Record`\<`string`, `unknown`\>

#### Returns

[`PermitSignPayload`](#permitsignpayload) \| `null`

***

### toUserOpCallsFrom5792()

> **toUserOpCallsFrom5792**(`batch`): [`UserOpCall`](#useropcall)[]

Defined in: [src/lib/uniswap/tradingApi.ts:613](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L613)

#### Parameters

##### batch

`Record`\<`string`, `unknown`\>

#### Returns

[`UserOpCall`](#useropcall)[]

***

### updateCrossChainPlan()

> **updateCrossChainPlan**(`planId`, `body`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [src/lib/uniswap/tradingApi.ts:643](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/tradingApi.ts#L643)

#### Parameters

##### planId

`string`

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>
