[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/types

# src/lib/swap/types

## Type Aliases

### SwapNormalizedFee

> **SwapNormalizedFee** = `object`

Defined in: [src/lib/swap/types.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L19)

#### Properties

##### amount?

> `optional` **amount**: `string`

Defined in: [src/lib/swap/types.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L20)

##### token?

> `optional` **token**: `string`

Defined in: [src/lib/swap/types.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L21)

***

### SwapNormalizedFees

> **SwapNormalizedFees** = `object`

Defined in: [src/lib/swap/types.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L24)

#### Properties

##### protocolFee?

> `optional` **protocolFee**: [`SwapNormalizedFee`](#swapnormalizedfee)

Defined in: [src/lib/swap/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L25)

***

### SwapNormalizedIssue

> **SwapNormalizedIssue** = `object`

Defined in: [src/lib/swap/types.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L14)

#### Properties

##### allowance?

> `optional` **allowance**: `unknown`

Defined in: [src/lib/swap/types.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L16)

##### balance?

> `optional` **balance**: `unknown`

Defined in: [src/lib/swap/types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L15)

***

### SwapNormalizedQuote

> **SwapNormalizedQuote** = `object`

Defined in: [src/lib/swap/types.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L28)

#### Properties

##### fees?

> `optional` **fees**: [`SwapNormalizedFees`](#swapnormalizedfees)

Defined in: [src/lib/swap/types.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L35)

##### issues?

> `optional` **issues**: [`SwapNormalizedIssue`](#swapnormalizedissue)

Defined in: [src/lib/swap/types.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L36)

##### liquidityAvailable

> **liquidityAvailable**: `boolean`

Defined in: [src/lib/swap/types.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L31)

##### minToAmount?

> `optional` **minToAmount**: `string`

Defined in: [src/lib/swap/types.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L33)

##### provider

> **provider**: `"uniswap"` \| `"cdp"`

Defined in: [src/lib/swap/types.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L29)

##### raw

> **raw**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/swap/types.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L37)

##### routing

> **routing**: `string`

Defined in: [src/lib/swap/types.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L30)

##### supportsOrderExecution

> **supportsOrderExecution**: `boolean`

Defined in: [src/lib/swap/types.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L38)

##### toAmount?

> `optional` **toAmount**: `string`

Defined in: [src/lib/swap/types.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L32)

##### totalNetworkFee?

> `optional` **totalNetworkFee**: `string`

Defined in: [src/lib/swap/types.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L34)

***

### SwapReviewRequest

> **SwapReviewRequest** = `object`

Defined in: [src/lib/swap/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L3)

#### Properties

##### amount

> **amount**: `string`

Defined in: [src/lib/swap/types.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L7)

##### chainId

> **chainId**: `number`

Defined in: [src/lib/swap/types.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L6)

##### executionMode

> **executionMode**: `"canonical"` \| `"eoa"`

Defined in: [src/lib/swap/types.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L10)

##### slippageTolerance

> **slippageTolerance**: `number`

Defined in: [src/lib/swap/types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L9)

##### swapper

> **swapper**: `string`

Defined in: [src/lib/swap/types.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L8)

##### tokenIn

> **tokenIn**: `string`

Defined in: [src/lib/swap/types.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L4)

##### tokenOut

> **tokenOut**: `string`

Defined in: [src/lib/swap/types.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L5)

##### xChainedActionsEnabled?

> `optional` **xChainedActionsEnabled**: `boolean`

Defined in: [src/lib/swap/types.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L11)

***

### SwapReviewResult

> **SwapReviewResult** = `object`

Defined in: [src/lib/swap/types.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L41)

#### Properties

##### approval

> **approval**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/swap/types.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L43)

##### orderRequest

> **orderRequest**: \{ `quote`: `Record`\<`string`, `unknown`\>; `routing?`: `string`; `signature`: `string`; \} \| `null`

Defined in: [src/lib/swap/types.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L45)

##### quote

> **quote**: [`SwapNormalizedQuote`](#swapnormalizedquote)

Defined in: [src/lib/swap/types.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L42)

##### swapTx

> **swapTx**: [`TransactionRequest`](../uniswap/tradingApi.md#transactionrequest) \| `null`

Defined in: [src/lib/swap/types.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/types.ts#L44)
