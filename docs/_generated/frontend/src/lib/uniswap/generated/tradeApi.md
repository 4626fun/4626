[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / src/lib/uniswap/generated/tradeApi

# src/lib/uniswap/generated/tradeApi

## Interfaces

### components

Defined in: [src/lib/uniswap/generated/tradeApi.ts:518](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L518)

#### Properties

##### headers

> **headers**: `never`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2318](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2318)

##### parameters

> **parameters**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2289](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2289)

###### bridgeTokenInChainIdParam

> **bridgeTokenInChainIdParam**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### chainIdParam

> **chainIdParam**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### cursorParam

> **cursorParam**: `string`

###### erc20EthEnabledHeader

> **erc20EthEnabledHeader**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### fillerParam

> **fillerParam**: `string`

###### Description

Filter by filler address.

###### limitParam

> **limitParam**: `number`

###### orderIdParam

> **orderIdParam**: `string`

###### orderIdsParam

> **orderIdsParam**: `string`

###### Description

A list of comma separated orderIds.

###### orderStatusParam

> **orderStatusParam**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### Description

Filter by order status.

###### orderTypeParam

> **orderTypeParam**: `"Dutch"` \| `"Dutch_V2"` \| `"Dutch_V1_V2"` \| `"Dutch_V3"` \| `"Limit"` \| `"Priority"`

###### Description

The default orderType is Dutch_V1_V2 and will grab both Dutch and Dutch_V2 orders.

###### sortKeyParam

> **sortKeyParam**: `"createdAt"`

###### Description

Order the query results by the sort key.

###### sortParam

> **sortParam**: `string`

###### Description

Sort query. For example: `sort=gt(UNIX_TIMESTAMP)`, `sort=between(1675872827, 1675872930)`, or `lt(1675872930)`.

###### swapperParam

> **swapperParam**: `string`

###### Description

Filter by swapper address.

###### tokenInParam

> **tokenInParam**: `string`

###### transactionHashesParam

> **transactionHashesParam**: `string`[]

###### Description

The transaction hashes.

###### universalRouterVersionHeader

> **universalRouterVersionHeader**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

##### pathItems

> **pathItems**: `never`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2319](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2319)

##### requestBodies

> **requestBodies**: `never`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2317](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2317)

##### responses

> **responses**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:1891](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L1891)

###### ApprovalNotFound404

> **ApprovalNotFound404**: `object`

###### Description

ResourceNotFound eg. Token allowance not found or Gas info not found.

###### ApprovalNotFound404.content

> **content**: `object`

###### ApprovalNotFound404.content.application/json

> **application/json**: `object`

###### ApprovalNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### ApprovalNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### ApprovalNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### ApprovalSuccess200

> **ApprovalSuccess200**: `object`

###### Description

Check approval successful.

###### ApprovalSuccess200.content

> **content**: `object`

###### ApprovalSuccess200.content.application/json

> **application/json**: `object`

###### ApprovalSuccess200.content.application/json.approval

> **approval**: `object`

###### ApprovalSuccess200.content.application/json.approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ApprovalSuccess200.content.application/json.approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ApprovalSuccess200.content.application/json.approval.from

> **from**: `string`

###### ApprovalSuccess200.content.application/json.approval.gasLimit?

> `optional` **gasLimit**: `string`

###### ApprovalSuccess200.content.application/json.approval.gasPrice?

> `optional` **gasPrice**: `string`

###### ApprovalSuccess200.content.application/json.approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ApprovalSuccess200.content.application/json.approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ApprovalSuccess200.content.application/json.approval.to

> **to**: `string`

###### ApprovalSuccess200.content.application/json.approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ApprovalSuccess200.content.application/json.cancel

> **cancel**: `object`

###### ApprovalSuccess200.content.application/json.cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ApprovalSuccess200.content.application/json.cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ApprovalSuccess200.content.application/json.cancel.from

> **from**: `string`

###### ApprovalSuccess200.content.application/json.cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### ApprovalSuccess200.content.application/json.cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### ApprovalSuccess200.content.application/json.cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ApprovalSuccess200.content.application/json.cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ApprovalSuccess200.content.application/json.cancel.to

> **to**: `string`

###### ApprovalSuccess200.content.application/json.cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ApprovalSuccess200.content.application/json.cancelGasFee?

> `optional` **cancelGasFee**: `string`

###### ApprovalSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### ApprovalSuccess200.content.application/json.requestId

> **requestId**: `string`

###### ApprovalSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### ApprovalUnauthorized401

> **ApprovalUnauthorized401**: `object`

###### Description

UnauthorizedError eg. Account is blocked.

###### ApprovalUnauthorized401.content

> **content**: `object`

###### ApprovalUnauthorized401.content.application/json

> **application/json**: `object`

###### ApprovalUnauthorized401.content.application/json.detail?

> `optional` **detail**: `string`

###### ApprovalUnauthorized401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### ApprovalUnauthorized401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### BadRequest400

> **BadRequest400**: `object`

###### Description

RequestValidationError, Bad Input

###### BadRequest400.content

> **content**: `object`

###### BadRequest400.content.application/json

> **application/json**: `object`

###### BadRequest400.content.application/json.detail?

> `optional` **detail**: `string`

###### BadRequest400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### BadRequest400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CheckApprovalLPSuccess200

> **CheckApprovalLPSuccess200**: `object`

###### Description

Approve LP successful.

###### CheckApprovalLPSuccess200.content

> **content**: `object`

###### CheckApprovalLPSuccess200.content.application/json

> **application/json**: `object`

###### CheckApprovalLPSuccess200.content.application/json.gasFeePositionTokenApproval?

> `optional` **gasFeePositionTokenApproval**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeePositionTokenPermit?

> `optional` **gasFeePositionTokenPermit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeeToken0Approval?

> `optional` **gasFeeToken0Approval**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeeToken0Cancel?

> `optional` **gasFeeToken0Cancel**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeeToken0Permit?

> `optional` **gasFeeToken0Permit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeeToken1Approval?

> `optional` **gasFeeToken1Approval**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeeToken1Cancel?

> `optional` **gasFeeToken1Cancel**: `string`

###### CheckApprovalLPSuccess200.content.application/json.gasFeeToken1Permit?

> `optional` **gasFeeToken1Permit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval?

> `optional` **positionTokenApproval**: `object`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenApproval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction?

> `optional` **positionTokenPermitTransaction**: `object`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.positionTokenPermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval?

> `optional` **token0Approval**: `object`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel?

> `optional` **token0Cancel**: `object`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction?

> `optional` **token0PermitTransaction**: `object`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token0PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.token1Approval?

> `optional` **token1Approval**: `object`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel?

> `optional` **token1Cancel**: `object`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction?

> `optional` **token1PermitTransaction**: `object`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.from

> **from**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.to

> **to**: `string`

###### CheckApprovalLPSuccess200.content.application/json.token1PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### ClaimLPFeesSuccess200

> **ClaimLPFeesSuccess200**: `object`

###### Description

Claim LP Fees successful.

###### ClaimLPFeesSuccess200.content

> **content**: `object`

###### ClaimLPFeesSuccess200.content.application/json

> **application/json**: `object`

###### ClaimLPFeesSuccess200.content.application/json.claim?

> `optional` **claim**: `object`

###### ClaimLPFeesSuccess200.content.application/json.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ClaimLPFeesSuccess200.content.application/json.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ClaimLPFeesSuccess200.content.application/json.claim.from

> **from**: `string`

###### ClaimLPFeesSuccess200.content.application/json.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### ClaimLPFeesSuccess200.content.application/json.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### ClaimLPFeesSuccess200.content.application/json.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ClaimLPFeesSuccess200.content.application/json.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ClaimLPFeesSuccess200.content.application/json.claim.to

> **to**: `string`

###### ClaimLPFeesSuccess200.content.application/json.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ClaimLPFeesSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### ClaimLPFeesSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### ClaimLPFeesSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### ClaimLPRewardsSuccess200

> **ClaimLPRewardsSuccess200**: `object`

###### Description

Claim LP Rewards successful.

###### ClaimLPRewardsSuccess200.content

> **content**: `object`

###### ClaimLPRewardsSuccess200.content.application/json

> **application/json**: `object`

###### ClaimLPRewardsSuccess200.content.application/json.claim?

> `optional` **claim**: `object`

###### ClaimLPRewardsSuccess200.content.application/json.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ClaimLPRewardsSuccess200.content.application/json.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ClaimLPRewardsSuccess200.content.application/json.claim.from

> **from**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.claim.to

> **to**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ClaimLPRewardsSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### ClaimLPRewardsSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### ClaimLPRewardsSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CreateLPPositionSuccess200

> **CreateLPPositionSuccess200**: `object`

###### Description

Create LP Position successful.

###### CreateLPPositionSuccess200.content

> **content**: `object`

###### CreateLPPositionSuccess200.content.application/json

> **application/json**: `object`

###### CreateLPPositionSuccess200.content.application/json.create?

> `optional` **create**: `object`

###### CreateLPPositionSuccess200.content.application/json.create.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateLPPositionSuccess200.content.application/json.create.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateLPPositionSuccess200.content.application/json.create.from

> **from**: `string`

###### CreateLPPositionSuccess200.content.application/json.create.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateLPPositionSuccess200.content.application/json.create.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateLPPositionSuccess200.content.application/json.create.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateLPPositionSuccess200.content.application/json.create.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateLPPositionSuccess200.content.application/json.create.to

> **to**: `string`

###### CreateLPPositionSuccess200.content.application/json.create.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateLPPositionSuccess200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### CreateLPPositionSuccess200.content.application/json.dependentAmount?

> `optional` **dependentAmount**: `string`

###### CreateLPPositionSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### CreateLPPositionSuccess200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### CreateLPPositionSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### CreateLPPositionSuccess200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### CreateLPPositionSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CreatePlanSuccess200

> **CreatePlanSuccess200**: `object`

###### Description

Create plan successful.

###### CreatePlanSuccess200.content

> **content**: `object`

###### CreatePlanSuccess200.content.application/json

> **application/json**: `object`

###### CreatePlanSuccess200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### CreatePlanSuccess200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### CreatePlanSuccess200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### CreatePlanSuccess200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### CreatePlanSuccess200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### CreatePlanSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### CreatePlanSuccess200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### CreatePlanSuccess200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### CreatePlanSuccess200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### CreatePlanSuccess200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### CreatePlanSuccess200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### CreatePlanSuccess200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### CreatePlanSuccess200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### CreatePlanSuccess200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### CreatePlanSuccess200.content.application/json.quoteId

> **quoteId**: `string`

###### CreatePlanSuccess200.content.application/json.recipient

> **recipient**: `string`

###### CreatePlanSuccess200.content.application/json.requestId

> **requestId**: `string`

###### CreatePlanSuccess200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### CreatePlanSuccess200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### CreatePlanSuccess200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### CreatePlanSuccess200.content.application/json.swapper

> **swapper**: `string`

###### CreatePlanSuccess200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### CreatePlanSuccess200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### CreatePlanSuccess200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### CreatePlanSuccess200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### CreatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### CreatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ... \| ...

###### Description

Name of the wallet.

###### CreatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ... \| ...

###### Description

Reverse domain name identifier for the wallet.

###### CreatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ... \| ...

###### Description

Unique identifier for the wallet.

###### CreatePlanSuccess200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### CreatePlanSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CreateSendSuccess200

> **CreateSendSuccess200**: `object`

###### Description

Create send successful.

###### CreateSendSuccess200.content

> **content**: `object`

###### CreateSendSuccess200.content.application/json

> **application/json**: `object`

###### CreateSendSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### CreateSendSuccess200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### CreateSendSuccess200.content.application/json.requestId

> **requestId**: `string`

###### CreateSendSuccess200.content.application/json.send

> **send**: `object`

###### CreateSendSuccess200.content.application/json.send.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSendSuccess200.content.application/json.send.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateSendSuccess200.content.application/json.send.from

> **from**: `string`

###### CreateSendSuccess200.content.application/json.send.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateSendSuccess200.content.application/json.send.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateSendSuccess200.content.application/json.send.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateSendSuccess200.content.application/json.send.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateSendSuccess200.content.application/json.send.to

> **to**: `string`

###### CreateSendSuccess200.content.application/json.send.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateSendSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CreateSwap5792Success200

> **CreateSwap5792Success200**: `object`

###### Description

Create 5792 swap successful.

###### CreateSwap5792Success200.content

> **content**: `object`

###### CreateSwap5792Success200.content.application/json

> **application/json**: `object`

###### CreateSwap5792Success200.content.application/json.calls

> **calls**: `object`[]

###### CreateSwap5792Success200.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSwap5792Success200.content.application/json.from

> **from**: `string`

###### CreateSwap5792Success200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### CreateSwap5792Success200.content.application/json.requestId

> **requestId**: `string`

###### CreateSwap5792Success200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CreateSwap7702Success200

> **CreateSwap7702Success200**: `object`

###### Description

Create 7702 swap successful.

###### CreateSwap7702Success200.content

> **content**: `object`

###### CreateSwap7702Success200.content.application/json

> **application/json**: `object`

###### CreateSwap7702Success200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### CreateSwap7702Success200.content.application/json.requestId

> **requestId**: `string`

###### CreateSwap7702Success200.content.application/json.swap

> **swap**: `object`

###### CreateSwap7702Success200.content.application/json.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSwap7702Success200.content.application/json.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateSwap7702Success200.content.application/json.swap.from

> **from**: `string`

###### CreateSwap7702Success200.content.application/json.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateSwap7702Success200.content.application/json.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateSwap7702Success200.content.application/json.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateSwap7702Success200.content.application/json.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateSwap7702Success200.content.application/json.swap.to

> **to**: `string`

###### CreateSwap7702Success200.content.application/json.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateSwap7702Success200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### CreateSwapSuccess200

> **CreateSwapSuccess200**: `object`

###### Description

Create swap successful.

###### CreateSwapSuccess200.content

> **content**: `object`

###### CreateSwapSuccess200.content.application/json

> **application/json**: `object`

###### CreateSwapSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### CreateSwapSuccess200.content.application/json.requestId

> **requestId**: `string`

###### CreateSwapSuccess200.content.application/json.swap

> **swap**: `object`

###### CreateSwapSuccess200.content.application/json.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSwapSuccess200.content.application/json.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateSwapSuccess200.content.application/json.swap.from

> **from**: `string`

###### CreateSwapSuccess200.content.application/json.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateSwapSuccess200.content.application/json.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateSwapSuccess200.content.application/json.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateSwapSuccess200.content.application/json.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateSwapSuccess200.content.application/json.swap.to

> **to**: `string`

###### CreateSwapSuccess200.content.application/json.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateSwapSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### DecreaseLPPositionSuccess200

> **DecreaseLPPositionSuccess200**: `object`

###### Description

Decrease LP Position successful.

###### DecreaseLPPositionSuccess200.content

> **content**: `object`

###### DecreaseLPPositionSuccess200.content.application/json

> **application/json**: `object`

###### DecreaseLPPositionSuccess200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### DecreaseLPPositionSuccess200.content.application/json.decrease?

> `optional` **decrease**: `object`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### DecreaseLPPositionSuccess200.content.application/json.decrease.from

> **from**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.gasLimit?

> `optional` **gasLimit**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.gasPrice?

> `optional` **gasPrice**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.to

> **to**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.decrease.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### DecreaseLPPositionSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### DecreaseLPPositionSuccess200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### DecreaseLPPositionSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### GetPlanSuccess200

> **GetPlanSuccess200**: `object`

###### Description

Get plan successful.

###### GetPlanSuccess200.content

> **content**: `object`

###### GetPlanSuccess200.content.application/json

> **application/json**: `object`

###### GetPlanSuccess200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### GetPlanSuccess200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### GetPlanSuccess200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### GetPlanSuccess200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### GetPlanSuccess200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### GetPlanSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### GetPlanSuccess200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### GetPlanSuccess200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### GetPlanSuccess200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### GetPlanSuccess200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### GetPlanSuccess200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### GetPlanSuccess200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### GetPlanSuccess200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### GetPlanSuccess200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### GetPlanSuccess200.content.application/json.quoteId

> **quoteId**: `string`

###### GetPlanSuccess200.content.application/json.recipient

> **recipient**: `string`

###### GetPlanSuccess200.content.application/json.requestId

> **requestId**: `string`

###### GetPlanSuccess200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### GetPlanSuccess200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### GetPlanSuccess200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### GetPlanSuccess200.content.application/json.swapper

> **swapper**: `string`

###### GetPlanSuccess200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### GetPlanSuccess200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### GetPlanSuccess200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### GetPlanSuccess200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### GetPlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### GetPlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ... \| ...

###### Description

Name of the wallet.

###### GetPlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ... \| ...

###### Description

Reverse domain name identifier for the wallet.

###### GetPlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ... \| ...

###### Description

Unique identifier for the wallet.

###### GetPlanSuccess200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### GetPlanSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### GetSwappableTokensSuccess200

> **GetSwappableTokensSuccess200**: `object`

###### Description

Get swappable tokens successful.

###### GetSwappableTokensSuccess200.content

> **content**: `object`

###### GetSwappableTokensSuccess200.content.application/json

> **application/json**: `object`

###### GetSwappableTokensSuccess200.content.application/json.requestId

> **requestId**: `string`

###### GetSwappableTokensSuccess200.content.application/json.tokens

> **tokens**: `object`[]

###### GetSwappableTokensSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### GetSwapsSuccess200

> **GetSwapsSuccess200**: `object`

###### Description

Get swap successful.

###### GetSwapsSuccess200.content

> **content**: `object`

###### GetSwapsSuccess200.content.application/json

> **application/json**: `object`

###### GetSwapsSuccess200.content.application/json.requestId

> **requestId**: `string`

###### GetSwapsSuccess200.content.application/json.swaps?

> `optional` **swaps**: `object`[]

###### GetSwapsSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### IncreaseLPPositionSuccess200

> **IncreaseLPPositionSuccess200**: `object`

###### Description

Create LP Position successful.

###### IncreaseLPPositionSuccess200.content

> **content**: `object`

###### IncreaseLPPositionSuccess200.content.application/json

> **application/json**: `object`

###### IncreaseLPPositionSuccess200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### IncreaseLPPositionSuccess200.content.application/json.dependentAmount?

> `optional` **dependentAmount**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase?

> `optional` **increase**: `object`

###### IncreaseLPPositionSuccess200.content.application/json.increase.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### IncreaseLPPositionSuccess200.content.application/json.increase.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### IncreaseLPPositionSuccess200.content.application/json.increase.from

> **from**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase.gasLimit?

> `optional` **gasLimit**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase.gasPrice?

> `optional` **gasPrice**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase.to

> **to**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.increase.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### IncreaseLPPositionSuccess200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### IncreaseLPPositionSuccess200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### IncreaseLPPositionSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### IndicativeQuoteSuccess200

> **IndicativeQuoteSuccess200**: `object`

###### Description

Indicative quote request successful.

###### IndicativeQuoteSuccess200.content

> **content**: `object`

###### IndicativeQuoteSuccess200.content.application/json

> **application/json**: `object`

###### IndicativeQuoteSuccess200.content.application/json.input

> **input**: `object`

###### IndicativeQuoteSuccess200.content.application/json.input.amount?

> `optional` **amount**: `string`

###### IndicativeQuoteSuccess200.content.application/json.input.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### IndicativeQuoteSuccess200.content.application/json.input.token?

> `optional` **token**: `string`

###### IndicativeQuoteSuccess200.content.application/json.output

> **output**: `object`

###### IndicativeQuoteSuccess200.content.application/json.output.amount?

> `optional` **amount**: `string`

###### IndicativeQuoteSuccess200.content.application/json.output.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### IndicativeQuoteSuccess200.content.application/json.output.token?

> `optional` **token**: `string`

###### IndicativeQuoteSuccess200.content.application/json.requestId

> **requestId**: `string`

###### IndicativeQuoteSuccess200.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### IndicativeQuoteSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### InternalErr500

> **InternalErr500**: `object`

###### Description

Unexpected error

###### InternalErr500.content

> **content**: `object`

###### InternalErr500.content.application/json

> **application/json**: `object`

###### InternalErr500.content.application/json.detail?

> `optional` **detail**: `string`

###### InternalErr500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### InternalErr500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### LimitOrderQuoteSuccess200

> **LimitOrderQuoteSuccess200**: `object`

###### Description

Limit Order Quote request successful.

###### LimitOrderQuoteSuccess200.content

> **content**: `object`

###### LimitOrderQuoteSuccess200.content.application/json

> **application/json**: `object`

###### LimitOrderQuoteSuccess200.content.application/json.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### LimitOrderQuoteSuccess200.content.application/json.quote

> **quote**: `object`

###### LimitOrderQuoteSuccess200.content.application/json.quote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### LimitOrderQuoteSuccess200.content.application/json.quote.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.encodedOrder

> **encodedOrder**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderId

> **orderId**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo

> **orderInfo**: `object`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.deadline

> **deadline**: `number`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.exclusiveFiller

> **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.exclusivityOverrideBps

> **exclusivityOverrideBps**: `string`

###### Description

The portion of the order which is eligible to be filled by the `exclusiveFiller`, specified in basis points.

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.input

> **input**: `object`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.input.endAmount

> **endAmount**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.input.startAmount

> **startAmount**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.input.token?

> `optional` **token**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.nonce

> **nonce**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.outputs

> **outputs**: `object`[]

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.reactor

> **reactor**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.orderInfo.swapper

> **swapper**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.portionAmount?

> `optional` **portionAmount**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.portionBips?

> `optional` **portionBips**: `number`

###### LimitOrderQuoteSuccess200.content.application/json.quote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.quoteId?

> `optional` **quoteId**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### LimitOrderQuoteSuccess200.content.application/json.requestId

> **requestId**: `string`

###### LimitOrderQuoteSuccess200.content.application/json.routing

> **routing**: `"LIMIT_ORDER"`

###### LimitOrderQuoteSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### LPNotFound404

> **LPNotFound404**: `object`

###### Description

ResourceNotFound eg. Cant Find LP Position.

###### LPNotFound404.content

> **content**: `object`

###### LPNotFound404.content.application/json

> **application/json**: `object`

###### LPNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### LPNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### LPNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### LPRewardsNotFound404

> **LPRewardsNotFound404**: `object`

###### Description

ResourceNotFound eg. No rewards available for wallet or on given chai or Gas fee/price not available

###### LPRewardsNotFound404.content

> **content**: `object`

###### LPRewardsNotFound404.content.application/json

> **application/json**: `object`

###### LPRewardsNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### LPRewardsNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### LPRewardsNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### MigrateLPPositionSuccess200

> **MigrateLPPositionSuccess200**: `object`

###### Description

Migrate LP Position successful.

###### MigrateLPPositionSuccess200.content

> **content**: `object`

###### MigrateLPPositionSuccess200.content.application/json

> **application/json**: `object`

###### MigrateLPPositionSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate?

> `optional` **migrate**: `object`

###### MigrateLPPositionSuccess200.content.application/json.migrate.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### MigrateLPPositionSuccess200.content.application/json.migrate.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### MigrateLPPositionSuccess200.content.application/json.migrate.from

> **from**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate.gasLimit?

> `optional` **gasLimit**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate.gasPrice?

> `optional` **gasPrice**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate.to

> **to**: `string`

###### MigrateLPPositionSuccess200.content.application/json.migrate.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### MigrateLPPositionSuccess200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### MigrateLPPositionSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### OrdersBadRequest400

> **OrdersBadRequest400**: `object`

###### Description

RequestValidationError eg. Token allowance not valid or Insufficient Funds.

###### OrdersBadRequest400.content

> **content**: `object`

###### OrdersBadRequest400.content.application/json

> **application/json**: `object`

###### OrdersBadRequest400.content.application/json.detail?

> `optional` **detail**: `string`

###### OrdersBadRequest400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### OrdersBadRequest400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### OrdersNotFound404

> **OrdersNotFound404**: `object`

###### Description

Orders not found.

###### OrdersNotFound404.content

> **content**: `object`

###### OrdersNotFound404.content.application/json

> **application/json**: `object`

###### OrdersNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### OrdersNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### OrdersNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### OrdersSuccess200

> **OrdersSuccess200**: `object`

###### Description

The request orders matching the query parameters.

###### OrdersSuccess200.content

> **content**: `object`

###### OrdersSuccess200.content.application/json

> **application/json**: `object`

###### OrdersSuccess200.content.application/json.cursor?

> `optional` **cursor**: `string`

###### OrdersSuccess200.content.application/json.orders

> **orders**: `object`[]

###### OrdersSuccess200.content.application/json.requestId

> **requestId**: `string`

###### OrdersSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### OrderSuccess201

> **OrderSuccess201**: `object`

###### Description

Encoded order submitted.

###### OrderSuccess201.content

> **content**: `object`

###### OrderSuccess201.content.application/json

> **application/json**: `object`

###### OrderSuccess201.content.application/json.orderId

> **orderId**: `string`

###### OrderSuccess201.content.application/json.orderStatus

> **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### OrderSuccess201.content.application/json.requestId

> **requestId**: `string`

###### OrderSuccess201.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### PoolInfoNotFound404

> **PoolInfoNotFound404**: `object`

###### Description

ResourceNotFound eg. No pool information on given chain

###### PoolInfoNotFound404.content

> **content**: `object`

###### PoolInfoNotFound404.content.application/json

> **application/json**: `object`

###### PoolInfoNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### PoolInfoNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### PoolInfoNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### PoolInfoResponse200

> **PoolInfoResponse200**: `object`

###### Description

Pool information response successful.

###### PoolInfoResponse200.content

> **content**: `object`

###### PoolInfoResponse200.content.application/json

> **application/json**: `object`

###### PoolInfoResponse200.content.application/json.currentPage?

> `optional` **currentPage**: `number`

###### PoolInfoResponse200.content.application/json.pageSize?

> `optional` **pageSize**: `number`

###### PoolInfoResponse200.content.application/json.pools?

> `optional` **pools**: `object`[]

###### Description

Array of pool information objects.

###### PoolInfoResponse200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### PoolInfoResponse200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### QuoteNotFound404

> **QuoteNotFound404**: `object`

###### Description

ResourceNotFound eg. No quotes available or Gas fee/price not available

###### QuoteNotFound404.content

> **content**: `object`

###### QuoteNotFound404.content.application/json

> **application/json**: `object`

###### QuoteNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### QuoteNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### QuoteNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### QuoteSuccess200

> **QuoteSuccess200**: `object`

###### Description

Quote request successful.

###### QuoteSuccess200.content

> **content**: `object`

###### QuoteSuccess200.content.application/json

> **application/json**: `object`

###### QuoteSuccess200.content.application/json.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### QuoteSuccess200.content.application/json.permitGasFee?

> `optional` **permitGasFee**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction?

> `optional` **permitTransaction**: `object`

###### QuoteSuccess200.content.application/json.permitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### QuoteSuccess200.content.application/json.permitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### QuoteSuccess200.content.application/json.permitTransaction.from

> **from**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction.to

> **to**: `string`

###### QuoteSuccess200.content.application/json.permitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### QuoteSuccess200.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: ...; `amountIn?`: ...; `amountOut?`: ...; `reserve0?`: ...; `reserve1?`: ...; `tokenIn?`: ...; `tokenOut?`: ...; `type`: ...; \} \| \{ `address?`: ...; `amountIn?`: ...; `amountOut?`: ...; `fee?`: ...; `liquidity?`: ...; `sqrtRatioX96?`: ...; `tickCurrent?`: ...; `tokenIn?`: ...; `tokenOut?`: ...; `type`: ...; \} \| \{ `address`: ...; `amountIn?`: ...; `amountOut?`: ...; `fee`: ...; `hooks`: ...; `liquidity`: ...; `sqrtRatioX96`: ...; `tickCurrent`: ...; `tickSpacing`: ...; `tokenIn`: ...; `tokenOut`: ...; `type`: ...; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ...[]; `relativeBlocks?`: ...[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: ...; `amountIn?`: ...; `amountOut?`: ...; `reserve0?`: ...; `reserve1?`: ...; `tokenIn?`: ...; `tokenOut?`: ...; `type`: ...; \} \| \{ `address?`: ...; `amountIn?`: ...; `amountOut?`: ...; `fee?`: ...; `liquidity?`: ...; `sqrtRatioX96?`: ...; `tickCurrent?`: ...; `tokenIn?`: ...; `tokenOut?`: ...; `type`: ...; \} \| \{ `address`: ...; `amountIn?`: ...; `amountOut?`: ...; `fee`: ...; `hooks`: ...; `liquidity`: ...; `sqrtRatioX96`: ...; `tickCurrent`: ...; `tickSpacing`: ...; `tokenIn`: ...; `tokenOut`: ...; `type`: ...; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ...[]; `relativeBlocks?`: ...[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### QuoteSuccess200.content.application/json.requestId

> **requestId**: `string`

###### QuoteSuccess200.content.application/json.routing

> **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### QuoteSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### RateLimitedErr429

> **RateLimitedErr429**: `object`

###### Description

Ratelimited

###### RateLimitedErr429.content

> **content**: `object`

###### RateLimitedErr429.content.application/json

> **application/json**: `object`

###### RateLimitedErr429.content.application/json.detail?

> `optional` **detail**: `string`

###### RateLimitedErr429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### RateLimitedErr429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### RewardsNotFound404

> **RewardsNotFound404**: `object`

###### Description

ResourceNotFound eg. No rewards found for wallet on given chain

###### RewardsNotFound404.content

> **content**: `object`

###### RewardsNotFound404.content.application/json

> **application/json**: `object`

###### RewardsNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### RewardsNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### RewardsNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### SendNotFound404

> **SendNotFound404**: `object`

###### Description

ResourceNotFound eg. Gas fee not available

###### SendNotFound404.content

> **content**: `object`

###### SendNotFound404.content.application/json

> **application/json**: `object`

###### SendNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### SendNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### SendNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### SwapBadRequest400

> **SwapBadRequest400**: `object`

###### Description

RequestValidationError, Bad Input

###### SwapBadRequest400.content

> **content**: `object`

###### SwapBadRequest400.content.application/json

> **application/json**: `object`

###### SwapBadRequest400.content.application/json.detail?

> `optional` **detail**: `string`

###### SwapBadRequest400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### SwapBadRequest400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### SwapNotFound404

> **SwapNotFound404**: `object`

###### Description

ResourceNotFound eg. No quotes available or Gas fee/price not available

###### SwapNotFound404.content

> **content**: `object`

###### SwapNotFound404.content.application/json

> **application/json**: `object`

###### SwapNotFound404.content.application/json.detail?

> `optional` **detail**: `string`

###### SwapNotFound404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### SwapNotFound404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### SwapUnauthorized401

> **SwapUnauthorized401**: `object`

###### Description

UnauthorizedError eg. Account is blocked or  Fee is not enabled.

###### SwapUnauthorized401.content

> **content**: `object`

###### SwapUnauthorized401.content.application/json

> **application/json**: `object`

###### SwapUnauthorized401.content.application/json.detail?

> `optional` **detail**: `string`

###### SwapUnauthorized401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### SwapUnauthorized401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### Timeout504

> **Timeout504**: `object`

###### Description

Request duration limit reached.

###### Timeout504.content

> **content**: `object`

###### Timeout504.content.application/json

> **application/json**: `object`

###### Timeout504.content.application/json.detail?

> `optional` **detail**: `string`

###### Timeout504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### Timeout504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### Unauthorized401

> **Unauthorized401**: `object`

###### Description

UnauthorizedError eg. Account is blocked.

###### Unauthorized401.content

> **content**: `object`

###### Unauthorized401.content.application/json

> **application/json**: `object`

###### Unauthorized401.content.application/json.detail?

> `optional` **detail**: `string`

###### Unauthorized401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### Unauthorized401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### UnprocessableEntity422

> **UnprocessableEntity422**: `object`

###### Description

UnprocessableEntity eg. Plan is already completed and cannot be updated.

###### UnprocessableEntity422.content

> **content**: `object`

###### UnprocessableEntity422.content.application/json

> **application/json**: `object`

###### UnprocessableEntity422.content.application/json.detail?

> `optional` **detail**: `string`

###### UnprocessableEntity422.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnprocessableEntity
```

###### UnprocessableEntity422.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### UpdatePlanSuccess200

> **UpdatePlanSuccess200**: `object`

###### Description

Update plan successful.

###### UpdatePlanSuccess200.content

> **content**: `object`

###### UpdatePlanSuccess200.content.application/json

> **application/json**: `object`

###### UpdatePlanSuccess200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### UpdatePlanSuccess200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### UpdatePlanSuccess200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### UpdatePlanSuccess200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### UpdatePlanSuccess200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### UpdatePlanSuccess200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### UpdatePlanSuccess200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### UpdatePlanSuccess200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### UpdatePlanSuccess200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### UpdatePlanSuccess200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### UpdatePlanSuccess200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### UpdatePlanSuccess200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### UpdatePlanSuccess200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### UpdatePlanSuccess200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### UpdatePlanSuccess200.content.application/json.quoteId

> **quoteId**: `string`

###### UpdatePlanSuccess200.content.application/json.recipient

> **recipient**: `string`

###### UpdatePlanSuccess200.content.application/json.requestId

> **requestId**: `string`

###### UpdatePlanSuccess200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### UpdatePlanSuccess200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### UpdatePlanSuccess200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### UpdatePlanSuccess200.content.application/json.swapper

> **swapper**: `string`

###### UpdatePlanSuccess200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### UpdatePlanSuccess200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ... \| ...

###### Description

Name of the wallet.

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ... \| ...

###### Description

Reverse domain name identifier for the wallet.

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ... \| ...

###### Description

Unique identifier for the wallet.

###### UpdatePlanSuccess200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### UpdatePlanSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### WalletCheckDelegationSuccess200

> **WalletCheckDelegationSuccess200**: `object`

###### Description

Wallet delegation info request successful.

###### WalletCheckDelegationSuccess200.content

> **content**: `object`

###### WalletCheckDelegationSuccess200.content.application/json

> **application/json**: `object`

###### WalletCheckDelegationSuccess200.content.application/json.delegationDetails

> **delegationDetails**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of wallet addresses to chain IDs to delegation details.

###### WalletCheckDelegationSuccess200.content.application/json.requestId

> **requestId**: `string`

###### WalletCheckDelegationSuccess200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### WalletEncode7702Success200

> **WalletEncode7702Success200**: `object`

###### Description

Encode 7702 wallet transactions successful.

###### WalletEncode7702Success200.content

> **content**: `object`

###### WalletEncode7702Success200.content.application/json

> **application/json**: `object`

###### WalletEncode7702Success200.content.application/json.encoded

> **encoded**: `object`

###### WalletEncode7702Success200.content.application/json.encoded.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### WalletEncode7702Success200.content.application/json.encoded.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### WalletEncode7702Success200.content.application/json.encoded.from

> **from**: `string`

###### WalletEncode7702Success200.content.application/json.encoded.gasLimit?

> `optional` **gasLimit**: `string`

###### WalletEncode7702Success200.content.application/json.encoded.gasPrice?

> `optional` **gasPrice**: `string`

###### WalletEncode7702Success200.content.application/json.encoded.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### WalletEncode7702Success200.content.application/json.encoded.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### WalletEncode7702Success200.content.application/json.encoded.to

> **to**: `string`

###### WalletEncode7702Success200.content.application/json.encoded.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### WalletEncode7702Success200.content.application/json.requestId

> **requestId**: `string`

###### WalletEncode7702Success200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### schemas

> **schemas**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:519](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L519)

###### ~~additionalValidationContract~~

> **additionalValidationContract**: `string`

###### Deprecated

###### Description

Unused and deprecated.

###### Default

```ts
0x0000000000000000000000000000000000000000
```

###### ~~additionalValidationData~~

> **additionalValidationData**: `string`

###### Deprecated

###### Description

Unused and deprecated.

###### Default

```ts
0x
```

###### Address

> **Address**: `string`

###### AggregatedOutput

> **AggregatedOutput**: `object`

###### Description

An array of all outputs of the proposed transaction. This includes the swap as well as any fees collected by the API integrator. This does not include pool fees when routing is through a Uniswap Protocol pool.

###### AggregatedOutput.amount?

> `optional` **amount**: `string`

###### AggregatedOutput.bps?

> `optional` **bps**: `number`

###### AggregatedOutput.minAmount?

> `optional` **minAmount**: `string`

###### AggregatedOutput.recipient?

> `optional` **recipient**: `string`

###### AggregatedOutput.token?

> `optional` **token**: `string`

###### ApprovalRequest

> **ApprovalRequest**: `object`

###### ApprovalRequest.amount

> **amount**: `string`

###### ApprovalRequest.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ApprovalRequest.includeGasInfo?

> `optional` **includeGasInfo**: `boolean`

###### ApprovalRequest.token

> **token**: `string`

###### ApprovalRequest.tokenOut?

> `optional` **tokenOut**: `string`

###### ApprovalRequest.tokenOutChainId?

> `optional` **tokenOutChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### ApprovalRequest.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### ApprovalRequest.walletAddress

> **walletAddress**: `string`

###### ApprovalResponse

> **ApprovalResponse**: `object`

###### ApprovalResponse.approval

> **approval**: `object`

###### ApprovalResponse.approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ApprovalResponse.approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ApprovalResponse.approval.from

> **from**: `string`

###### ApprovalResponse.approval.gasLimit?

> `optional` **gasLimit**: `string`

###### ApprovalResponse.approval.gasPrice?

> `optional` **gasPrice**: `string`

###### ApprovalResponse.approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ApprovalResponse.approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ApprovalResponse.approval.to

> **to**: `string`

###### ApprovalResponse.approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ApprovalResponse.cancel

> **cancel**: `object`

###### ApprovalResponse.cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ApprovalResponse.cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ApprovalResponse.cancel.from

> **from**: `string`

###### ApprovalResponse.cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### ApprovalResponse.cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### ApprovalResponse.cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ApprovalResponse.cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ApprovalResponse.cancel.to

> **to**: `string`

###### ApprovalResponse.cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ApprovalResponse.cancelGasFee?

> `optional` **cancelGasFee**: `string`

###### ApprovalResponse.gasFee?

> `optional` **gasFee**: `string`

###### ApprovalResponse.requestId

> **requestId**: `string`

###### AutoSlippage

> **AutoSlippage**: `"DEFAULT"`

###### Description

The auto slippage strategy to employ. For Uniswap Protocols (v2, v3, v4) the auto slippage will be automatically calculated when this field is set to `DEFAULT`. Auto slippage cannot be calculated for UniswapX swaps.

    Note that if the trade type is `EXACT_INPUT`, then the slippage is in terms of the output token. If the trade type is `EXACT_OUTPUT`, then the slippage is in terms of the input token.

    When submitting a request, `autoSlippage` may not be set when `slippageTolerance` is defined. One of `slippageTolerance` or `autoSlippage` must be defined.

###### bps

> **bps**: `number`

###### Description

The portion of the swap stated in basis points.

###### bpsFee

> **bpsFee**: `string`

###### Description

A fee charged by the token specified in basis points. Field is not present if the token does not charge a fee.

###### BridgeQuote

> **BridgeQuote**: `object`

Bridge Quote

###### BridgeQuote.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### BridgeQuote.destinationChainId?

> `optional` **destinationChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### BridgeQuote.estimatedFillTimeMs?

> `optional` **estimatedFillTimeMs**: `number`

###### Description

The estimated time it will take to fill the order in milliseconds.

###### BridgeQuote.exclusiveRelayer?

> `optional` **exclusiveRelayer**: `string`

###### Description

The address of the exclusive filler (the relayer).

###### BridgeQuote.exclusivityDeadline?

> `optional` **exclusivityDeadline**: `number`

###### Description

The deadline (unix timestamp) by which the exclusive relayer must fill the order before other relayers can fill it.

###### BridgeQuote.fillDeadline?

> `optional` **fillDeadline**: `number`

###### Description

The deadline by which, if the order is not filled, the order will be reverted.

###### BridgeQuote.gasFee?

> `optional` **gasFee**: `string`

###### BridgeQuote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### BridgeQuote.gasPrice?

> `optional` **gasPrice**: `string`

###### BridgeQuote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### BridgeQuote.input?

> `optional` **input**: `object`

###### BridgeQuote.input.amount?

> `optional` **amount**: `string`

###### BridgeQuote.input.token?

> `optional` **token**: `string`

###### BridgeQuote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### BridgeQuote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### BridgeQuote.output?

> `optional` **output**: `object`

###### BridgeQuote.output.amount?

> `optional` **amount**: `string`

###### BridgeQuote.output.recipient?

> `optional` **recipient**: `string`

###### BridgeQuote.output.token?

> `optional` **token**: `string`

###### BridgeQuote.portionAmount?

> `optional` **portionAmount**: `string`

###### BridgeQuote.portionBips?

> `optional` **portionBips**: `number`

###### BridgeQuote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### BridgeQuote.quoteId?

> `optional` **quoteId**: `string`

###### BridgeQuote.quoteTimestamp?

> `optional` **quoteTimestamp**: `number`

###### BridgeQuote.swapper?

> `optional` **swapper**: `string`

###### BridgeQuote.tradeType?

> `optional` **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### ChainDelegationMap

> **ChainDelegationMap**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of chain IDs to delegation details for a specific wallet.

###### ChainedQuote

> **ChainedQuote**: `object`

Chained Quote

###### Description

A quote for a chained transaction flow that spans multiple steps, potentially across multiple chains.

###### ChainedQuote.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### ChainedQuote.gasEstimates?

> `optional` **gasEstimates**: `Record`\<`string`, `never`\>[]

###### Description

Gas estimates for each step in the chained flow.

###### ChainedQuote.gasFee?

> `optional` **gasFee**: `string`

###### ChainedQuote.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### ChainedQuote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### ChainedQuote.gasPrice?

> `optional` **gasPrice**: `string`

###### ChainedQuote.gasStrategies

> **gasStrategies**: `object`[]

###### Description

Gas strategies for the chained flow.

###### ChainedQuote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### ChainedQuote.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### ChainedQuote.input

> **input**: `object`

###### ChainedQuote.input.amount?

> `optional` **amount**: `string`

###### ChainedQuote.input.token?

> `optional` **token**: `string`

###### ChainedQuote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ChainedQuote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ChainedQuote.output

> **output**: `object`

###### ChainedQuote.output.amount?

> `optional` **amount**: `string`

###### ChainedQuote.output.recipient?

> `optional` **recipient**: `string`

###### ChainedQuote.output.token?

> `optional` **token**: `string`

###### ChainedQuote.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### ChainedQuote.quoteId

> **quoteId**: `string`

###### ChainedQuote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### ChainedQuote.steps?

> `optional` **steps**: `object`[]

###### Description

Truncated plan steps for the chained transaction flow.

###### ChainedQuote.swapper

> **swapper**: `string`

###### ChainedQuote.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire chained flow.

###### ChainedQuote.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ChainedQuote.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ChainedQuote.tradeType

> **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### ChainId

> **ChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### Description

The unique ID of the blockchain. For a list of supported chains see the [FAQ](https://api-docs.uniswap.org/guides/faqs).

###### Default

```ts
1
@enum {number}
```

###### CheckApprovalLPRequest

> **CheckApprovalLPRequest**: `object`

###### CheckApprovalLPRequest.amount0?

> `optional` **amount0**: `string`

###### Description

The amount of token0 to be added or removed from the position. To estimate the amount of token0 needed when adding a new position, use the /lp/create endpoint to simulate the position creation.

###### CheckApprovalLPRequest.amount1?

> `optional` **amount1**: `string`

###### Description

The amount of token1 to be added or removed from the position. To estimate the amount of token1 needed when adding a new position, use the /lp/create endpoint to simulate the position creation.

###### CheckApprovalLPRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### CheckApprovalLPRequest.generatePermitAsTransaction?

> `optional` **generatePermitAsTransaction**: `boolean`

###### CheckApprovalLPRequest.positionAmount?

> `optional` **positionAmount**: `string`

###### Description

Only required when getting approval for removing a V2 position. Populated with the amount of the V2 position to be removed (eg. amount0*amount1).

###### CheckApprovalLPRequest.positionToken?

> `optional` **positionToken**: `string`

###### Description

The address of the NFT representing the position. Required when requesting approval for removing liquidity from a V2 position (provide address of V2 NFT). Required when requesting approval for migrating a V3 position to a V4 position (provide address of V3 NFT).

###### CheckApprovalLPRequest.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### CheckApprovalLPRequest.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### CheckApprovalLPRequest.token0?

> `optional` **token0**: `string`

###### CheckApprovalLPRequest.token1?

> `optional` **token1**: `string`

###### CheckApprovalLPRequest.walletAddress?

> `optional` **walletAddress**: `string`

###### CheckApprovalLPResponse

> **CheckApprovalLPResponse**: `object`

###### CheckApprovalLPResponse.gasFeePositionTokenApproval?

> `optional` **gasFeePositionTokenApproval**: `string`

###### CheckApprovalLPResponse.gasFeePositionTokenPermit?

> `optional` **gasFeePositionTokenPermit**: `string`

###### CheckApprovalLPResponse.gasFeeToken0Approval?

> `optional` **gasFeeToken0Approval**: `string`

###### CheckApprovalLPResponse.gasFeeToken0Cancel?

> `optional` **gasFeeToken0Cancel**: `string`

###### CheckApprovalLPResponse.gasFeeToken0Permit?

> `optional` **gasFeeToken0Permit**: `string`

###### CheckApprovalLPResponse.gasFeeToken1Approval?

> `optional` **gasFeeToken1Approval**: `string`

###### CheckApprovalLPResponse.gasFeeToken1Cancel?

> `optional` **gasFeeToken1Cancel**: `string`

###### CheckApprovalLPResponse.gasFeeToken1Permit?

> `optional` **gasFeeToken1Permit**: `string`

###### CheckApprovalLPResponse.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### CheckApprovalLPResponse.positionTokenApproval?

> `optional` **positionTokenApproval**: `object`

###### CheckApprovalLPResponse.positionTokenApproval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.positionTokenApproval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.positionTokenApproval.from

> **from**: `string`

###### CheckApprovalLPResponse.positionTokenApproval.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.positionTokenApproval.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.positionTokenApproval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.positionTokenApproval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.positionTokenApproval.to

> **to**: `string`

###### CheckApprovalLPResponse.positionTokenApproval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.positionTokenPermitTransaction?

> `optional` **positionTokenPermitTransaction**: `object`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.positionTokenPermitTransaction.from

> **from**: `string`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.to

> **to**: `string`

###### CheckApprovalLPResponse.positionTokenPermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.requestId?

> `optional` **requestId**: `string`

###### CheckApprovalLPResponse.token0Approval?

> `optional` **token0Approval**: `object`

###### CheckApprovalLPResponse.token0Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.token0Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.token0Approval.from

> **from**: `string`

###### CheckApprovalLPResponse.token0Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.token0Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.token0Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.token0Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.token0Approval.to

> **to**: `string`

###### CheckApprovalLPResponse.token0Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.token0Cancel?

> `optional` **token0Cancel**: `object`

###### CheckApprovalLPResponse.token0Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.token0Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.token0Cancel.from

> **from**: `string`

###### CheckApprovalLPResponse.token0Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.token0Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.token0Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.token0Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.token0Cancel.to

> **to**: `string`

###### CheckApprovalLPResponse.token0Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.token0PermitTransaction?

> `optional` **token0PermitTransaction**: `object`

###### CheckApprovalLPResponse.token0PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.token0PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.token0PermitTransaction.from

> **from**: `string`

###### CheckApprovalLPResponse.token0PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.token0PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.token0PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.token0PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.token0PermitTransaction.to

> **to**: `string`

###### CheckApprovalLPResponse.token0PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.token1Approval?

> `optional` **token1Approval**: `object`

###### CheckApprovalLPResponse.token1Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.token1Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.token1Approval.from

> **from**: `string`

###### CheckApprovalLPResponse.token1Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.token1Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.token1Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.token1Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.token1Approval.to

> **to**: `string`

###### CheckApprovalLPResponse.token1Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.token1Cancel?

> `optional` **token1Cancel**: `object`

###### CheckApprovalLPResponse.token1Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.token1Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.token1Cancel.from

> **from**: `string`

###### CheckApprovalLPResponse.token1Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.token1Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.token1Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.token1Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.token1Cancel.to

> **to**: `string`

###### CheckApprovalLPResponse.token1Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CheckApprovalLPResponse.token1PermitTransaction?

> `optional` **token1PermitTransaction**: `object`

###### CheckApprovalLPResponse.token1PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CheckApprovalLPResponse.token1PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CheckApprovalLPResponse.token1PermitTransaction.from

> **from**: `string`

###### CheckApprovalLPResponse.token1PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### CheckApprovalLPResponse.token1PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### CheckApprovalLPResponse.token1PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CheckApprovalLPResponse.token1PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CheckApprovalLPResponse.token1PermitTransaction.to

> **to**: `string`

###### CheckApprovalLPResponse.token1PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### claimerWalletAddress

> **claimerWalletAddress**: `string`

###### Description

The wallet address which will be used to claim.

###### ClaimLPFeesRequest

> **ClaimLPFeesRequest**: `object`

###### ClaimLPFeesRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### ClaimLPFeesRequest.collectAsWETH?

> `optional` **collectAsWETH**: `boolean`

###### ClaimLPFeesRequest.expectedTokenOwed0RawAmount?

> `optional` **expectedTokenOwed0RawAmount**: `string`

###### ClaimLPFeesRequest.expectedTokenOwed1RawAmount?

> `optional` **expectedTokenOwed1RawAmount**: `string`

###### ClaimLPFeesRequest.position?

> `optional` **position**: `object`

###### ClaimLPFeesRequest.position.pool

> **pool**: `object`

###### ClaimLPFeesRequest.position.pool.fee?

> `optional` **fee**: `number`

###### ClaimLPFeesRequest.position.pool.hooks?

> `optional` **hooks**: `string`

###### ClaimLPFeesRequest.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### ClaimLPFeesRequest.position.pool.token0

> **token0**: `string`

###### ClaimLPFeesRequest.position.pool.token1

> **token1**: `string`

###### ClaimLPFeesRequest.position.tickLower?

> `optional` **tickLower**: `number`

###### ClaimLPFeesRequest.position.tickUpper?

> `optional` **tickUpper**: `number`

###### ClaimLPFeesRequest.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### ClaimLPFeesRequest.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### ClaimLPFeesRequest.tokenId?

> `optional` **tokenId**: `number`

###### ClaimLPFeesRequest.walletAddress?

> `optional` **walletAddress**: `string`

###### ClaimLPFeesResponse

> **ClaimLPFeesResponse**: `object`

###### ClaimLPFeesResponse.claim?

> `optional` **claim**: `object`

###### ClaimLPFeesResponse.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ClaimLPFeesResponse.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ClaimLPFeesResponse.claim.from

> **from**: `string`

###### ClaimLPFeesResponse.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### ClaimLPFeesResponse.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### ClaimLPFeesResponse.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ClaimLPFeesResponse.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ClaimLPFeesResponse.claim.to

> **to**: `string`

###### ClaimLPFeesResponse.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ClaimLPFeesResponse.gasFee?

> `optional` **gasFee**: `string`

###### ClaimLPFeesResponse.requestId?

> `optional` **requestId**: `string`

###### ClaimLPRewardsRequest

> **ClaimLPRewardsRequest**: `object`

###### ClaimLPRewardsRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### ClaimLPRewardsRequest.distributor?

> `optional` **distributor**: `"MERKL"`

###### ClaimLPRewardsRequest.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### ClaimLPRewardsRequest.tokens?

> `optional` **tokens**: `string`[]

###### Description

The token addresses to claim rewards for.

###### ClaimLPRewardsRequest.walletAddress?

> `optional` **walletAddress**: `string`

###### ClaimLPRewardsResponse

> **ClaimLPRewardsResponse**: `object`

###### ClaimLPRewardsResponse.claim?

> `optional` **claim**: `object`

###### ClaimLPRewardsResponse.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### ClaimLPRewardsResponse.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### ClaimLPRewardsResponse.claim.from

> **from**: `string`

###### ClaimLPRewardsResponse.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### ClaimLPRewardsResponse.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### ClaimLPRewardsResponse.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ClaimLPRewardsResponse.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ClaimLPRewardsResponse.claim.to

> **to**: `string`

###### ClaimLPRewardsResponse.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### ClaimLPRewardsResponse.gasFee?

> `optional` **gasFee**: `string`

###### ClaimLPRewardsResponse.requestId?

> `optional` **requestId**: `string`

###### ClassicGasUseEstimateUSD

> **ClassicGasUseEstimateUSD**: `string`

###### Description

The gas fee you would pay if you opted for a CLASSIC swap over a Uniswap X order in terms of USD.

###### ClassicInput

> **ClassicInput**: `object`

###### ClassicInput.amount?

> `optional` **amount**: `string`

###### ClassicInput.token?

> `optional` **token**: `string`

###### ClassicOutput

> **ClassicOutput**: `object`

###### ClassicOutput.amount?

> `optional` **amount**: `string`

###### ClassicOutput.recipient?

> `optional` **recipient**: `string`

###### ClassicOutput.token?

> `optional` **token**: `string`

###### ClassicQuote

> **ClassicQuote**: `object`

Classic Quote

###### ClassicQuote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### ClassicQuote.blockNumber?

> `optional` **blockNumber**: `string`

###### Description

The current block number.

###### ClassicQuote.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### ClassicQuote.gasFee?

> `optional` **gasFee**: `string`

###### ClassicQuote.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### ClassicQuote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### ClassicQuote.gasPrice?

> `optional` **gasPrice**: `string`

###### ClassicQuote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### Description

The estimated gas use. It does NOT include the additional gas for token approvals.

###### ClassicQuote.input?

> `optional` **input**: `object`

###### ClassicQuote.input.amount?

> `optional` **amount**: `string`

###### ClassicQuote.input.token?

> `optional` **token**: `string`

###### ClassicQuote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### ClassicQuote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### ClassicQuote.output?

> `optional` **output**: `object`

###### ClassicQuote.output.amount?

> `optional` **amount**: `string`

###### ClassicQuote.output.recipient?

> `optional` **recipient**: `string`

###### ClassicQuote.output.token?

> `optional` **token**: `string`

###### ClassicQuote.portionAmount?

> `optional` **portionAmount**: `string`

###### ClassicQuote.portionBips?

> `optional` **portionBips**: `number`

###### ClassicQuote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### ClassicQuote.priceImpact?

> `optional` **priceImpact**: `number`

###### Description

The impact the trade has on the market price of the pool, between 0-100 percent

###### ClassicQuote.quoteId?

> `optional` **quoteId**: `string`

###### ClassicQuote.route?

> `optional` **route**: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: `string`; `token?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; \}; `reserve1?`: \{ `quotient?`: `string`; `token?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; \}; `tokenIn?`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `tokenOut?`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `tokenOut?`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `tokenOut`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `type`: `string`; \})[][]

###### ClassicQuote.routeString?

> `optional` **routeString**: `string`

###### Description

The route in string format.

###### ClassicQuote.slippage?

> `optional` **slippage**: `number`

###### ClassicQuote.swapper?

> `optional` **swapper**: `string`

###### ClassicQuote.tradeType?

> `optional` **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### ClassicQuote.txFailureReasons?

> `optional` **txFailureReasons**: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]

###### Description

The reason(s) why the transaction failed during simulation.

###### ClientContext

> **ClientContext**: `object`

###### Description

Uni client-specific context describing how this wallet integrates with the application.

###### ClientContext.directPrivateKeyAccess?

> `optional` **directPrivateKeyAccess**: `boolean`

###### Description

Whether the wallet has direct private key access.

###### ClientContext.nextEvmUpgradeAddress?

> `optional` **nextEvmUpgradeAddress**: `string`

###### Description

Address for the next EVM upgrade.

###### contractAddress

> **contractAddress**: `string`

###### Description

The address of a contract which will be used to facilitate the swap.

###### cosignerAddress

> **cosignerAddress**: `string`

###### Description

The address of a cosigner who will run the auction and ensure the best executable price within the given parameters. Currently the cosigner is always Uniswap Labs.

###### CosignerData

> **CosignerData**: `object`

###### CosignerData.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### CosignerData.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### CosignerData.exclusiveFiller?

> `optional` **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### CosignerData.inputOverride?

> `optional` **inputOverride**: `string`

###### CosignerData.outputOverrides?

> `optional` **outputOverrides**: `string`[]

###### CreateLPPositionRequest

> **CreateLPPositionRequest**: `object`

###### CreateLPPositionRequest.amount0?

> `optional` **amount0**: `string`

###### CreateLPPositionRequest.amount1?

> `optional` **amount1**: `string`

###### CreateLPPositionRequest.batchPermitData?

> `optional` **batchPermitData**: `object`

###### CreateLPPositionRequest.batchPermitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### CreateLPPositionRequest.batchPermitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### CreateLPPositionRequest.batchPermitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### CreateLPPositionRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### CreateLPPositionRequest.currentTick?

> `optional` **currentTick**: `number`

###### CreateLPPositionRequest.deadline?

> `optional` **deadline**: `number`

###### CreateLPPositionRequest.defaultDependentAmount?

> `optional` **defaultDependentAmount**: `string`

###### CreateLPPositionRequest.independentAmount?

> `optional` **independentAmount**: `string`

###### CreateLPPositionRequest.independentToken?

> `optional` **independentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### CreateLPPositionRequest.initialDependentAmount?

> `optional` **initialDependentAmount**: `string`

###### CreateLPPositionRequest.initialPrice?

> `optional` **initialPrice**: `string`

###### CreateLPPositionRequest.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### CreateLPPositionRequest.position?

> `optional` **position**: `object`

###### CreateLPPositionRequest.position.pool

> **pool**: `object`

###### CreateLPPositionRequest.position.pool.fee?

> `optional` **fee**: `number`

###### CreateLPPositionRequest.position.pool.hooks?

> `optional` **hooks**: `string`

###### CreateLPPositionRequest.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### CreateLPPositionRequest.position.pool.token0

> **token0**: `string`

###### CreateLPPositionRequest.position.pool.token1

> **token1**: `string`

###### CreateLPPositionRequest.position.tickLower?

> `optional` **tickLower**: `number`

###### CreateLPPositionRequest.position.tickUpper?

> `optional` **tickUpper**: `number`

###### CreateLPPositionRequest.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### CreateLPPositionRequest.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### CreateLPPositionRequest.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### CreateLPPositionRequest.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### CreateLPPositionRequest.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### CreateLPPositionRequest.walletAddress?

> `optional` **walletAddress**: `string`

###### CreateLPPositionResponse

> **CreateLPPositionResponse**: `object`

###### CreateLPPositionResponse.create?

> `optional` **create**: `object`

###### CreateLPPositionResponse.create.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateLPPositionResponse.create.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateLPPositionResponse.create.from

> **from**: `string`

###### CreateLPPositionResponse.create.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateLPPositionResponse.create.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateLPPositionResponse.create.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateLPPositionResponse.create.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateLPPositionResponse.create.to

> **to**: `string`

###### CreateLPPositionResponse.create.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateLPPositionResponse.currentTick?

> `optional` **currentTick**: `number`

###### CreateLPPositionResponse.dependentAmount?

> `optional` **dependentAmount**: `string`

###### CreateLPPositionResponse.gasFee?

> `optional` **gasFee**: `string`

###### CreateLPPositionResponse.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### CreateLPPositionResponse.requestId?

> `optional` **requestId**: `string`

###### CreateLPPositionResponse.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### CreatePlanRequest

> **CreatePlanRequest**: `object`

###### CreatePlanRequest.quote

> **quote**: `object`

###### CreatePlanRequest.quote.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### CreatePlanRequest.quote.gasEstimates?

> `optional` **gasEstimates**: `Record`\<`string`, `never`\>[]

###### Description

Gas estimates for each step in the chained flow.

###### CreatePlanRequest.quote.gasFee?

> `optional` **gasFee**: `string`

###### CreatePlanRequest.quote.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### CreatePlanRequest.quote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### CreatePlanRequest.quote.gasPrice?

> `optional` **gasPrice**: `string`

###### CreatePlanRequest.quote.gasStrategies

> **gasStrategies**: `object`[]

###### Description

Gas strategies for the chained flow.

###### CreatePlanRequest.quote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### CreatePlanRequest.quote.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### CreatePlanRequest.quote.input

> **input**: `object`

###### CreatePlanRequest.quote.input.amount?

> `optional` **amount**: `string`

###### CreatePlanRequest.quote.input.token?

> `optional` **token**: `string`

###### CreatePlanRequest.quote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreatePlanRequest.quote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreatePlanRequest.quote.output

> **output**: `object`

###### CreatePlanRequest.quote.output.amount?

> `optional` **amount**: `string`

###### CreatePlanRequest.quote.output.recipient?

> `optional` **recipient**: `string`

###### CreatePlanRequest.quote.output.token?

> `optional` **token**: `string`

###### CreatePlanRequest.quote.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### CreatePlanRequest.quote.quoteId

> **quoteId**: `string`

###### CreatePlanRequest.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### CreatePlanRequest.quote.steps?

> `optional` **steps**: `object`[]

###### Description

Truncated plan steps for the chained transaction flow.

###### CreatePlanRequest.quote.swapper

> **swapper**: `string`

###### CreatePlanRequest.quote.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire chained flow.

###### CreatePlanRequest.quote.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreatePlanRequest.quote.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreatePlanRequest.quote.tradeType

> **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### CreatePlanRequest.routing

> **routing**: `"CHAINED"`

###### Description

The routing type for the plan. Currently only CHAINED is supported for multi-step execution plans.

###### CreatePlanRequest.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### CreatePlanRequest.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### CreatePlanRequest.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### CreatePlanRequest.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: `string`

###### Description

Name of the wallet.

###### CreatePlanRequest.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: `string`

###### Description

Reverse domain name identifier for the wallet.

###### CreatePlanRequest.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: `string`

###### Description

Unique identifier for the wallet.

###### CreatePlanRequest.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### CreateSendRequest

> **CreateSendRequest**: `object`

###### CreateSendRequest.amount

> **amount**: `string`

###### CreateSendRequest.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSendRequest.recipient

> **recipient**: `string`

###### CreateSendRequest.sender

> **sender**: `string`

###### CreateSendRequest.token

> **token**: `string`

###### CreateSendRequest.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### CreateSendResponse

> **CreateSendResponse**: `object`

###### CreateSendResponse.gasFee?

> `optional` **gasFee**: `string`

###### CreateSendResponse.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### CreateSendResponse.requestId

> **requestId**: `string`

###### CreateSendResponse.send

> **send**: `object`

###### CreateSendResponse.send.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSendResponse.send.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateSendResponse.send.from

> **from**: `string`

###### CreateSendResponse.send.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateSendResponse.send.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateSendResponse.send.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateSendResponse.send.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateSendResponse.send.to

> **to**: `string`

###### CreateSendResponse.send.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateSwap5792Request

> **CreateSwap5792Request**: `object`

###### CreateSwap5792Request.deadline?

> `optional` **deadline**: `number`

###### CreateSwap5792Request.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### CreateSwap5792Request.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### CreateSwap5792Request.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### CreateSwap5792Response

> **CreateSwap5792Response**: `object`

###### CreateSwap5792Response.calls

> **calls**: `object`[]

###### CreateSwap5792Response.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSwap5792Response.from

> **from**: `string`

###### CreateSwap5792Response.gasFee?

> `optional` **gasFee**: `string`

###### CreateSwap5792Response.requestId

> **requestId**: `string`

###### CreateSwap7702Request

> **CreateSwap7702Request**: `object`

###### CreateSwap7702Request.deadline?

> `optional` **deadline**: `number`

###### CreateSwap7702Request.includeGasInfo

> **includeGasInfo**: `boolean`

###### Default

```ts
false
```

###### CreateSwap7702Request.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### CreateSwap7702Request.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### CreateSwap7702Request.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### CreateSwap7702Request.smartContractDelegationAddress?

> `optional` **smartContractDelegationAddress**: `string`

###### CreateSwap7702Request.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### CreateSwap7702Response

> **CreateSwap7702Response**: `object`

###### CreateSwap7702Response.gasFee?

> `optional` **gasFee**: `string`

###### CreateSwap7702Response.requestId

> **requestId**: `string`

###### CreateSwap7702Response.swap

> **swap**: `object`

###### CreateSwap7702Response.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSwap7702Response.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateSwap7702Response.swap.from

> **from**: `string`

###### CreateSwap7702Response.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateSwap7702Response.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateSwap7702Response.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateSwap7702Response.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateSwap7702Response.swap.to

> **to**: `string`

###### CreateSwap7702Response.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### CreateSwapRequest

> **CreateSwapRequest**: `object`

###### Description

The parameters **signature** and **permitData** should only be included if *permitData* was returned from **/quote**.

###### CreateSwapRequest.deadline?

> `optional` **deadline**: `number`

###### CreateSwapRequest.includeGasInfo

> **includeGasInfo**: `boolean`

###### Deprecated

###### Description

Use `refreshGasPrice` instead.

###### Default

```ts
false
```

###### CreateSwapRequest.permitData?

> `optional` **permitData**: `object`

###### CreateSwapRequest.permitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### CreateSwapRequest.permitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### CreateSwapRequest.permitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### CreateSwapRequest.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### CreateSwapRequest.refreshGasPrice

> **refreshGasPrice**: `boolean`

###### Description

If true, the gas price will be re-fetched from the network.

###### Default

```ts
false
```

###### CreateSwapRequest.safetyMode?

> `optional` **safetyMode**: `"SAFE"`

###### CreateSwapRequest.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### CreateSwapRequest.simulateTransaction

> **simulateTransaction**: `boolean`

###### Description

If true, the transaction will be simulated. If the simulation results on an onchain error, endpoint will return an error.

###### Default

```ts
false
```

###### CreateSwapRequest.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### CreateSwapResponse

> **CreateSwapResponse**: `object`

###### CreateSwapResponse.gasFee?

> `optional` **gasFee**: `string`

###### CreateSwapResponse.requestId

> **requestId**: `string`

###### CreateSwapResponse.swap

> **swap**: `object`

###### CreateSwapResponse.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### CreateSwapResponse.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### CreateSwapResponse.swap.from

> **from**: `string`

###### CreateSwapResponse.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### CreateSwapResponse.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### CreateSwapResponse.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### CreateSwapResponse.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### CreateSwapResponse.swap.to

> **to**: `string`

###### CreateSwapResponse.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### Curve

> **Curve**: `object`

###### Curve.relativeAmounts?

> `optional` **relativeAmounts**: `string`[]

###### Curve.relativeBlocks?

> `optional` **relativeBlocks**: `number`[]

###### deadline

> **deadline**: `number`

###### Description

The unix timestamp at which the order will be reverted if not filled.

###### DecreaseLPPositionRequest

> **DecreaseLPPositionRequest**: `object`

###### DecreaseLPPositionRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### DecreaseLPPositionRequest.collectAsWETH?

> `optional` **collectAsWETH**: `boolean`

###### DecreaseLPPositionRequest.currentTick?

> `optional` **currentTick**: `number`

###### DecreaseLPPositionRequest.deadline?

> `optional` **deadline**: `number`

###### DecreaseLPPositionRequest.expectedTokenOwed0RawAmount?

> `optional` **expectedTokenOwed0RawAmount**: `string`

###### DecreaseLPPositionRequest.expectedTokenOwed1RawAmount?

> `optional` **expectedTokenOwed1RawAmount**: `string`

###### DecreaseLPPositionRequest.liquidity0?

> `optional` **liquidity0**: `string`

###### DecreaseLPPositionRequest.liquidity1?

> `optional` **liquidity1**: `string`

###### DecreaseLPPositionRequest.liquidityPercentageToDecrease?

> `optional` **liquidityPercentageToDecrease**: `number`

###### DecreaseLPPositionRequest.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### DecreaseLPPositionRequest.position?

> `optional` **position**: `object`

###### DecreaseLPPositionRequest.position.pool

> **pool**: `object`

###### DecreaseLPPositionRequest.position.pool.fee?

> `optional` **fee**: `number`

###### DecreaseLPPositionRequest.position.pool.hooks?

> `optional` **hooks**: `string`

###### DecreaseLPPositionRequest.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### DecreaseLPPositionRequest.position.pool.token0

> **token0**: `string`

###### DecreaseLPPositionRequest.position.pool.token1

> **token1**: `string`

###### DecreaseLPPositionRequest.position.tickLower?

> `optional` **tickLower**: `number`

###### DecreaseLPPositionRequest.position.tickUpper?

> `optional` **tickUpper**: `number`

###### DecreaseLPPositionRequest.positionLiquidity?

> `optional` **positionLiquidity**: `string`

###### DecreaseLPPositionRequest.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### DecreaseLPPositionRequest.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### DecreaseLPPositionRequest.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### DecreaseLPPositionRequest.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### DecreaseLPPositionRequest.tokenId?

> `optional` **tokenId**: `number`

###### DecreaseLPPositionRequest.walletAddress?

> `optional` **walletAddress**: `string`

###### DecreaseLPPositionResponse

> **DecreaseLPPositionResponse**: `object`

###### DecreaseLPPositionResponse.currentTick?

> `optional` **currentTick**: `number`

###### DecreaseLPPositionResponse.decrease?

> `optional` **decrease**: `object`

###### DecreaseLPPositionResponse.decrease.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DecreaseLPPositionResponse.decrease.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### DecreaseLPPositionResponse.decrease.from

> **from**: `string`

###### DecreaseLPPositionResponse.decrease.gasLimit?

> `optional` **gasLimit**: `string`

###### DecreaseLPPositionResponse.decrease.gasPrice?

> `optional` **gasPrice**: `string`

###### DecreaseLPPositionResponse.decrease.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### DecreaseLPPositionResponse.decrease.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### DecreaseLPPositionResponse.decrease.to

> **to**: `string`

###### DecreaseLPPositionResponse.decrease.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### DecreaseLPPositionResponse.gasFee?

> `optional` **gasFee**: `string`

###### DecreaseLPPositionResponse.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### DecreaseLPPositionResponse.requestId?

> `optional` **requestId**: `string`

###### DecreaseLPPositionResponse.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### DelegationDetails

> **DelegationDetails**: `object`

###### DelegationDetails.currentDelegationAddress

> **currentDelegationAddress**: `string` \| `null`

###### Description

The current delegation address of the wallet. May be null if the wallet does not currently delegate to any address.

###### DelegationDetails.isWalletDelegatedToUniswap

> **isWalletDelegatedToUniswap**: `boolean`

###### Description

Whether the current delegation address is a Uniswap delegation address.

###### DelegationDetails.latestDelegationAddress

> **latestDelegationAddress**: `string`

###### Description

The latest delegation address that the wallet could upgrade to.

###### Distributor

> **Distributor**: `"MERKL"`

###### Description

The distributor of the rewards.

###### DutchInput

> **DutchInput**: `object`

###### DutchInput.endAmount

> **endAmount**: `string`

###### DutchInput.startAmount

> **startAmount**: `string`

###### DutchInput.token?

> `optional` **token**: `string`

###### DutchInputV3

> **DutchInputV3**: `object`

###### DutchInputV3.adjustmentPerGweiBaseFee

> **adjustmentPerGweiBaseFee**: `string`

###### DutchInputV3.curve

> **curve**: `object`

###### DutchInputV3.curve.relativeAmounts?

> `optional` **relativeAmounts**: `string`[]

###### DutchInputV3.curve.relativeBlocks?

> `optional` **relativeBlocks**: `number`[]

###### DutchInputV3.maxAmount

> **maxAmount**: `string`

###### DutchInputV3.startAmount

> **startAmount**: `string`

###### DutchInputV3.token

> **token**: `string`

###### DutchOrderInfo

> **DutchOrderInfo**: `object`

###### DutchOrderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### DutchOrderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### DutchOrderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DutchOrderInfo.deadline

> **deadline**: `number`

###### DutchOrderInfo.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### DutchOrderInfo.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### DutchOrderInfo.exclusiveFiller

> **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### DutchOrderInfo.exclusivityOverrideBps

> **exclusivityOverrideBps**: `string`

###### Description

The portion of the order which is eligible to be filled by the `exclusiveFiller`, specified in basis points.

###### DutchOrderInfo.input

> **input**: `object`

###### DutchOrderInfo.input.endAmount

> **endAmount**: `string`

###### DutchOrderInfo.input.startAmount

> **startAmount**: `string`

###### DutchOrderInfo.input.token?

> `optional` **token**: `string`

###### DutchOrderInfo.nonce

> **nonce**: `string`

###### DutchOrderInfo.outputs

> **outputs**: `object`[]

###### DutchOrderInfo.reactor

> **reactor**: `string`

###### DutchOrderInfo.swapper

> **swapper**: `string`

###### DutchOrderInfoV2

> **DutchOrderInfoV2**: `object`

###### DutchOrderInfoV2.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### DutchOrderInfoV2.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### DutchOrderInfoV2.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DutchOrderInfoV2.cosigner?

> `optional` **cosigner**: `string`

###### DutchOrderInfoV2.deadline

> **deadline**: `number`

###### DutchOrderInfoV2.input

> **input**: `object`

###### DutchOrderInfoV2.input.endAmount

> **endAmount**: `string`

###### DutchOrderInfoV2.input.startAmount

> **startAmount**: `string`

###### DutchOrderInfoV2.input.token?

> `optional` **token**: `string`

###### DutchOrderInfoV2.nonce

> **nonce**: `string`

###### DutchOrderInfoV2.outputs

> **outputs**: `object`[]

###### DutchOrderInfoV2.reactor

> **reactor**: `string`

###### DutchOrderInfoV2.swapper

> **swapper**: `string`

###### DutchOrderInfoV3

> **DutchOrderInfoV3**: `object`

###### DutchOrderInfoV3.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### DutchOrderInfoV3.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### DutchOrderInfoV3.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DutchOrderInfoV3.cosigner?

> `optional` **cosigner**: `string`

###### DutchOrderInfoV3.deadline

> **deadline**: `number`

###### DutchOrderInfoV3.input

> **input**: `object`

###### DutchOrderInfoV3.input.adjustmentPerGweiBaseFee

> **adjustmentPerGweiBaseFee**: `string`

###### DutchOrderInfoV3.input.curve

> **curve**: `object`

###### DutchOrderInfoV3.input.curve.relativeAmounts?

> `optional` **relativeAmounts**: `string`[]

###### DutchOrderInfoV3.input.curve.relativeBlocks?

> `optional` **relativeBlocks**: `number`[]

###### DutchOrderInfoV3.input.maxAmount

> **maxAmount**: `string`

###### DutchOrderInfoV3.input.startAmount

> **startAmount**: `string`

###### DutchOrderInfoV3.input.token

> **token**: `string`

###### DutchOrderInfoV3.nonce

> **nonce**: `string`

###### DutchOrderInfoV3.outputs

> **outputs**: `object`[]

###### DutchOrderInfoV3.reactor

> **reactor**: `string`

###### DutchOrderInfoV3.startingBaseFee?

> `optional` **startingBaseFee**: `string`

###### DutchOrderInfoV3.swapper

> **swapper**: `string`

###### DutchOutput

> **DutchOutput**: `object`

###### DutchOutput.endAmount

> **endAmount**: `string`

###### DutchOutput.recipient

> **recipient**: `string`

###### DutchOutput.startAmount

> **startAmount**: `string`

###### DutchOutput.token

> **token**: `string`

###### DutchOutputV3

> **DutchOutputV3**: `object`

###### DutchOutputV3.adjustmentPerGweiBaseFee

> **adjustmentPerGweiBaseFee**: `string`

###### DutchOutputV3.curve

> **curve**: `object`

###### DutchOutputV3.curve.relativeAmounts?

> `optional` **relativeAmounts**: `string`[]

###### DutchOutputV3.curve.relativeBlocks?

> `optional` **relativeBlocks**: `number`[]

###### DutchOutputV3.minAmount?

> `optional` **minAmount**: `string`

###### DutchOutputV3.recipient

> **recipient**: `string`

###### DutchOutputV3.startAmount

> **startAmount**: `string`

###### DutchOutputV3.token

> **token**: `string`

###### DutchQuote

> **DutchQuote**: `object`

###### DutchQuote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### DutchQuote.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### DutchQuote.encodedOrder

> **encodedOrder**: `string`

###### DutchQuote.orderId

> **orderId**: `string`

###### DutchQuote.orderInfo

> **orderInfo**: `object`

###### DutchQuote.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### DutchQuote.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### DutchQuote.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DutchQuote.orderInfo.deadline

> **deadline**: `number`

###### DutchQuote.orderInfo.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### DutchQuote.orderInfo.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### DutchQuote.orderInfo.exclusiveFiller

> **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### DutchQuote.orderInfo.exclusivityOverrideBps

> **exclusivityOverrideBps**: `string`

###### Description

The portion of the order which is eligible to be filled by the `exclusiveFiller`, specified in basis points.

###### DutchQuote.orderInfo.input

> **input**: `object`

###### DutchQuote.orderInfo.input.endAmount

> **endAmount**: `string`

###### DutchQuote.orderInfo.input.startAmount

> **startAmount**: `string`

###### DutchQuote.orderInfo.input.token?

> `optional` **token**: `string`

###### DutchQuote.orderInfo.nonce

> **nonce**: `string`

###### DutchQuote.orderInfo.outputs

> **outputs**: `object`[]

###### DutchQuote.orderInfo.reactor

> **reactor**: `string`

###### DutchQuote.orderInfo.swapper

> **swapper**: `string`

###### DutchQuote.portionAmount?

> `optional` **portionAmount**: `string`

###### DutchQuote.portionBips?

> `optional` **portionBips**: `number`

###### DutchQuote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### DutchQuote.quoteId?

> `optional` **quoteId**: `string`

###### DutchQuote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### DutchQuoteV2

> **DutchQuoteV2**: `object`

UniswapX V2 Quote

###### DutchQuoteV2.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### DutchQuoteV2.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### DutchQuoteV2.deadlineBufferSecs?

> `optional` **deadlineBufferSecs**: `number`

###### DutchQuoteV2.encodedOrder

> **encodedOrder**: `string`

###### DutchQuoteV2.orderId

> **orderId**: `string`

###### DutchQuoteV2.orderInfo

> **orderInfo**: `object`

###### DutchQuoteV2.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### DutchQuoteV2.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### DutchQuoteV2.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DutchQuoteV2.orderInfo.cosigner?

> `optional` **cosigner**: `string`

###### DutchQuoteV2.orderInfo.deadline

> **deadline**: `number`

###### DutchQuoteV2.orderInfo.input

> **input**: `object`

###### DutchQuoteV2.orderInfo.input.endAmount

> **endAmount**: `string`

###### DutchQuoteV2.orderInfo.input.startAmount

> **startAmount**: `string`

###### DutchQuoteV2.orderInfo.input.token?

> `optional` **token**: `string`

###### DutchQuoteV2.orderInfo.nonce

> **nonce**: `string`

###### DutchQuoteV2.orderInfo.outputs

> **outputs**: `object`[]

###### DutchQuoteV2.orderInfo.reactor

> **reactor**: `string`

###### DutchQuoteV2.orderInfo.swapper

> **swapper**: `string`

###### DutchQuoteV2.portionAmount?

> `optional` **portionAmount**: `string`

###### DutchQuoteV2.portionBips?

> `optional` **portionBips**: `number`

###### DutchQuoteV2.portionRecipient?

> `optional` **portionRecipient**: `string`

###### DutchQuoteV2.quoteId?

> `optional` **quoteId**: `string`

###### DutchQuoteV2.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### DutchQuoteV3

> **DutchQuoteV3**: `object`

UniswapX V3 Quote

###### DutchQuoteV3.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### DutchQuoteV3.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### DutchQuoteV3.deadlineBufferSecs?

> `optional` **deadlineBufferSecs**: `number`

###### DutchQuoteV3.encodedOrder

> **encodedOrder**: `string`

###### DutchQuoteV3.expectedAmountIn?

> `optional` **expectedAmountIn**: `string`

###### DutchQuoteV3.expectedAmountOut?

> `optional` **expectedAmountOut**: `string`

###### DutchQuoteV3.orderId

> **orderId**: `string`

###### DutchQuoteV3.orderInfo

> **orderInfo**: `object`

###### DutchQuoteV3.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### DutchQuoteV3.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### DutchQuoteV3.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### DutchQuoteV3.orderInfo.cosigner?

> `optional` **cosigner**: `string`

###### DutchQuoteV3.orderInfo.deadline

> **deadline**: `number`

###### DutchQuoteV3.orderInfo.input

> **input**: `object`

###### DutchQuoteV3.orderInfo.input.adjustmentPerGweiBaseFee

> **adjustmentPerGweiBaseFee**: `string`

###### DutchQuoteV3.orderInfo.input.curve

> **curve**: `object`

###### DutchQuoteV3.orderInfo.input.curve.relativeAmounts?

> `optional` **relativeAmounts**: `string`[]

###### DutchQuoteV3.orderInfo.input.curve.relativeBlocks?

> `optional` **relativeBlocks**: `number`[]

###### DutchQuoteV3.orderInfo.input.maxAmount

> **maxAmount**: `string`

###### DutchQuoteV3.orderInfo.input.startAmount

> **startAmount**: `string`

###### DutchQuoteV3.orderInfo.input.token

> **token**: `string`

###### DutchQuoteV3.orderInfo.nonce

> **nonce**: `string`

###### DutchQuoteV3.orderInfo.outputs

> **outputs**: `object`[]

###### DutchQuoteV3.orderInfo.reactor

> **reactor**: `string`

###### DutchQuoteV3.orderInfo.startingBaseFee?

> `optional` **startingBaseFee**: `string`

###### DutchQuoteV3.orderInfo.swapper

> **swapper**: `string`

###### DutchQuoteV3.portionAmount?

> `optional` **portionAmount**: `string`

###### DutchQuoteV3.portionBips?

> `optional` **portionBips**: `number`

###### DutchQuoteV3.portionRecipient?

> `optional` **portionRecipient**: `string`

###### DutchQuoteV3.quoteId?

> `optional` **quoteId**: `string`

###### DutchQuoteV3.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### Encode7702ResponseBody

> **Encode7702ResponseBody**: `object`

###### Encode7702ResponseBody.encoded

> **encoded**: `object`

###### Encode7702ResponseBody.encoded.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### Encode7702ResponseBody.encoded.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### Encode7702ResponseBody.encoded.from

> **from**: `string`

###### Encode7702ResponseBody.encoded.gasLimit?

> `optional` **gasLimit**: `string`

###### Encode7702ResponseBody.encoded.gasPrice?

> `optional` **gasPrice**: `string`

###### Encode7702ResponseBody.encoded.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### Encode7702ResponseBody.encoded.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### Encode7702ResponseBody.encoded.to

> **to**: `string`

###### Encode7702ResponseBody.encoded.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### Encode7702ResponseBody.requestId

> **requestId**: `string`

###### encodedOrder

> **encodedOrder**: `string`

###### Description

An encoded copy of the order details which will be submitted to the filler network along with the signed permit.

###### endAmount

> **endAmount**: `string`

###### Description

The worst case quantity of tokens resulting from this swap.

###### Err400

> **Err400**: `object`

###### Err400.detail?

> `optional` **detail**: `string`

###### Err400.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### Err401

> **Err401**: `object`

###### Err401.detail?

> `optional` **detail**: `string`

###### Err401.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### Err404

> **Err404**: `object`

###### Err404.detail?

> `optional` **detail**: `string`

###### Err404.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### Err422

> **Err422**: `object`

###### Err422.detail?

> `optional` **detail**: `string`

###### Err422.errorCode

> **errorCode**: `string`

###### Default

```ts
UnprocessableEntity
```

###### Err429

> **Err429**: `object`

###### Err429.detail?

> `optional` **detail**: `string`

###### Err429.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### Err500

> **Err500**: `object`

###### Err500.detail?

> `optional` **detail**: `string`

###### Err500.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### Err504

> **Err504**: `object`

###### Err504.detail?

> `optional` **detail**: `string`

###### Err504.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### gasFee

> **gasFee**: `string`

###### Description

The total estimated gas cost of this transaction (eg. `gasLimit` multiplied by `maxFeePerGas`) in the base unit of the chain.

###### gasFeeInCurrency

> **gasFeeInCurrency**: `string`

###### Description

The total estimated gas cost of this transaction (eg. gasLimit multiplied by maxFeePerGas) in the quoted currency (e.g. output token) in the base units of the quoted currency.

###### gasFeeUSD

> **gasFeeUSD**: `string`

###### Description

The total estimated gas cost of this transaction (eg. `gasLimit` multiplied by `maxFeePerGas`) denominated in USDC.

###### gasLimit

> **gasLimit**: `string`

###### Description

The maximum units of gas that will be consumed by this transaction.

###### gasPrice

> **gasPrice**: `string`

###### Description

The cost per unit of gas.

###### GasStrategy

> **GasStrategy**: `object`

###### Description

Gas strategy configuration for transaction fee estimation.

###### GasStrategy.baseFeeHistoryWindow?

> `optional` **baseFeeHistoryWindow**: `number`

###### Description

Number of blocks to consider for base fee history.

###### GasStrategy.baseFeeMultiplier?

> `optional` **baseFeeMultiplier**: `number`

###### Description

Multiplier for the base fee.

###### GasStrategy.limitInflationFactor

> **limitInflationFactor**: `number`

###### Description

Factor to inflate the gas limit estimate.

###### GasStrategy.maxPriorityFeeGwei?

> `optional` **maxPriorityFeeGwei**: `number`

###### Description

Maximum priority fee in Gwei.

###### GasStrategy.minPriorityFeeGwei?

> `optional` **minPriorityFeeGwei**: `number`

###### Description

Minimum priority fee in Gwei.

###### GasStrategy.minPriorityFeeRatioOfBaseFee?

> `optional` **minPriorityFeeRatioOfBaseFee**: `number`

###### Description

Minimum priority fee as a ratio of base fee.

###### GasStrategy.percentileThresholdFor1559Fee

> **percentileThresholdFor1559Fee**: `number`

###### Description

Percentile threshold for EIP-1559 fee calculation.

###### GasStrategy.priceInflationFactor

> **priceInflationFactor**: `number`

###### Description

Factor to inflate the gas price estimate.

###### GasStrategy.thresholdToInflateLastBlockBaseFee?

> `optional` **thresholdToInflateLastBlockBaseFee**: `number`

###### Description

Threshold to inflate the last block base fee.

###### generatePermitAsTransaction

> **generatePermitAsTransaction**: `boolean`

###### Description

Indicates whether you want to receive a permit2 transaction to sign and submit onchain, or a permit message to sign. When set to `true`, the quote response returns the Permit2 as a calldata which the user signs and broadcasts. When set to `false` (the default), the quote response returns the Permit2 as a message which the user signs but does not need to broadcast. When using a 7702-delegated wallet, set this field to `true`. Except for this scenario, it is recommended that this field is set to false. Note that a Permit2 calldata (e.g. `true`), will provide indefinite permission for Permit2 to spend a token, in contrast to a Permit2 message (e.g. `false`) which is only valid for 30 days. Further, a Permit2 calldata (e.g. `true`) requires the user to pay gas to submit the transaction, whereas the Permit2 message (e.g. `false` ) does not require the user to submit a transaction and requires no gas.

###### Default

```ts
false
```

###### GetOrdersResponse

> **GetOrdersResponse**: `object`

###### GetOrdersResponse.cursor?

> `optional` **cursor**: `string`

###### GetOrdersResponse.orders

> **orders**: `object`[]

###### GetOrdersResponse.requestId

> **requestId**: `string`

###### GetSwappableTokensResponse

> **GetSwappableTokensResponse**: `object`

###### GetSwappableTokensResponse.requestId

> **requestId**: `string`

###### GetSwappableTokensResponse.tokens

> **tokens**: `object`[]

###### GetSwapsResponse

> **GetSwapsResponse**: `object`

###### GetSwapsResponse.requestId

> **requestId**: `string`

###### GetSwapsResponse.swaps?

> `optional` **swaps**: `object`[]

###### HooksOptions

> **HooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### Description

The hook options to use for V4 pool quotes. `V4_HOOKS_INCLUSIVE` will get quotes for V4 pools with or without hooks. `V4_HOOKS_ONLY` will only get quotes for V4 pools with hooks. `V4_NO_HOOKS` will only get quotes for V4 pools without hooks. Defaults to `V4_HOOKS_INCLUSIVE` if `V4` is included in `protocols` and `hookOptions` is not set. This field is ignored if `V4` is not passed in `protocols`.

###### includeGasInfo

> **includeGasInfo**: `boolean`

###### Description

If set to `true`, the response will include the estimated gas fee for the proposed transaction.

###### Default

```ts
false
```

###### IncreaseLPPositionRequest

> **IncreaseLPPositionRequest**: `object`

###### IncreaseLPPositionRequest.amount0?

> `optional` **amount0**: `string`

###### IncreaseLPPositionRequest.amount1?

> `optional` **amount1**: `string`

###### IncreaseLPPositionRequest.batchPermitData?

> `optional` **batchPermitData**: `object`

###### IncreaseLPPositionRequest.batchPermitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### IncreaseLPPositionRequest.batchPermitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### IncreaseLPPositionRequest.batchPermitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### IncreaseLPPositionRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### IncreaseLPPositionRequest.currentTick?

> `optional` **currentTick**: `number`

###### IncreaseLPPositionRequest.deadline?

> `optional` **deadline**: `number`

###### IncreaseLPPositionRequest.defaultDependentAmount?

> `optional` **defaultDependentAmount**: `string`

###### IncreaseLPPositionRequest.independentAmount?

> `optional` **independentAmount**: `string`

###### IncreaseLPPositionRequest.independentToken?

> `optional` **independentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### IncreaseLPPositionRequest.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### IncreaseLPPositionRequest.position?

> `optional` **position**: `object`

###### IncreaseLPPositionRequest.position.pool

> **pool**: `object`

###### IncreaseLPPositionRequest.position.pool.fee?

> `optional` **fee**: `number`

###### IncreaseLPPositionRequest.position.pool.hooks?

> `optional` **hooks**: `string`

###### IncreaseLPPositionRequest.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### IncreaseLPPositionRequest.position.pool.token0

> **token0**: `string`

###### IncreaseLPPositionRequest.position.pool.token1

> **token1**: `string`

###### IncreaseLPPositionRequest.position.tickLower?

> `optional` **tickLower**: `number`

###### IncreaseLPPositionRequest.position.tickUpper?

> `optional` **tickUpper**: `number`

###### IncreaseLPPositionRequest.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### IncreaseLPPositionRequest.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### IncreaseLPPositionRequest.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### IncreaseLPPositionRequest.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### IncreaseLPPositionRequest.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### IncreaseLPPositionRequest.tokenId?

> `optional` **tokenId**: `number`

###### IncreaseLPPositionRequest.walletAddress?

> `optional` **walletAddress**: `string`

###### IncreaseLPPositionResponse

> **IncreaseLPPositionResponse**: `object`

###### IncreaseLPPositionResponse.currentTick?

> `optional` **currentTick**: `number`

###### IncreaseLPPositionResponse.dependentAmount?

> `optional` **dependentAmount**: `string`

###### IncreaseLPPositionResponse.gasFee?

> `optional` **gasFee**: `string`

###### IncreaseLPPositionResponse.increase?

> `optional` **increase**: `object`

###### IncreaseLPPositionResponse.increase.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### IncreaseLPPositionResponse.increase.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### IncreaseLPPositionResponse.increase.from

> **from**: `string`

###### IncreaseLPPositionResponse.increase.gasLimit?

> `optional` **gasLimit**: `string`

###### IncreaseLPPositionResponse.increase.gasPrice?

> `optional` **gasPrice**: `string`

###### IncreaseLPPositionResponse.increase.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### IncreaseLPPositionResponse.increase.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### IncreaseLPPositionResponse.increase.to

> **to**: `string`

###### IncreaseLPPositionResponse.increase.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### IncreaseLPPositionResponse.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### IncreaseLPPositionResponse.requestId?

> `optional` **requestId**: `string`

###### IncreaseLPPositionResponse.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### IndependentToken

> **IndependentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### IndicativeQuoteRequest

> **IndicativeQuoteRequest**: `object`

###### IndicativeQuoteRequest.amount

> **amount**: `string`

###### IndicativeQuoteRequest.tokenIn

> **tokenIn**: `string`

###### IndicativeQuoteRequest.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### IndicativeQuoteRequest.tokenOut

> **tokenOut**: `string`

###### IndicativeQuoteRequest.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### IndicativeQuoteRequest.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### IndicativeQuoteResponse

> **IndicativeQuoteResponse**: `object`

###### IndicativeQuoteResponse.input

> **input**: `object`

###### IndicativeQuoteResponse.input.amount?

> `optional` **amount**: `string`

###### IndicativeQuoteResponse.input.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### IndicativeQuoteResponse.input.token?

> `optional` **token**: `string`

###### IndicativeQuoteResponse.output

> **output**: `object`

###### IndicativeQuoteResponse.output.amount?

> `optional` **amount**: `string`

###### IndicativeQuoteResponse.output.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### IndicativeQuoteResponse.output.token?

> `optional` **token**: `string`

###### IndicativeQuoteResponse.requestId

> **requestId**: `string`

###### IndicativeQuoteResponse.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### IndicativeQuoteToken

> **IndicativeQuoteToken**: `object`

###### IndicativeQuoteToken.amount?

> `optional` **amount**: `string`

###### IndicativeQuoteToken.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### IndicativeQuoteToken.token?

> `optional` **token**: `string`

###### inputToken

> **inputToken**: `string`

###### Description

The token which will be sent, specified by its token address. For a list of supported tokens, see the [FAQ](https://api-docs.uniswap.org/guides/faqs).

###### isSpam

> **isSpam**: `boolean`

###### Description

Whether the token is considered a spam token.

###### LimitOrderQuoteRequest

> **LimitOrderQuoteRequest**: `object`

###### LimitOrderQuoteRequest.amount

> **amount**: `string`

###### LimitOrderQuoteRequest.limitPrice?

> `optional` **limitPrice**: `string`

###### LimitOrderQuoteRequest.orderDeadline?

> `optional` **orderDeadline**: `number`

###### LimitOrderQuoteRequest.swapper

> **swapper**: `string`

###### LimitOrderQuoteRequest.tokenIn

> **tokenIn**: `string`

###### LimitOrderQuoteRequest.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### LimitOrderQuoteRequest.tokenOut

> **tokenOut**: `string`

###### LimitOrderQuoteRequest.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### LimitOrderQuoteRequest.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### LimitOrderQuoteResponse

> **LimitOrderQuoteResponse**: `object`

###### LimitOrderQuoteResponse.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### LimitOrderQuoteResponse.quote

> **quote**: `object`

###### LimitOrderQuoteResponse.quote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### LimitOrderQuoteResponse.quote.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### LimitOrderQuoteResponse.quote.encodedOrder

> **encodedOrder**: `string`

###### LimitOrderQuoteResponse.quote.orderId

> **orderId**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo

> **orderInfo**: `object`

###### LimitOrderQuoteResponse.quote.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### LimitOrderQuoteResponse.quote.orderInfo.deadline

> **deadline**: `number`

###### LimitOrderQuoteResponse.quote.orderInfo.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### LimitOrderQuoteResponse.quote.orderInfo.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### LimitOrderQuoteResponse.quote.orderInfo.exclusiveFiller

> **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### LimitOrderQuoteResponse.quote.orderInfo.exclusivityOverrideBps

> **exclusivityOverrideBps**: `string`

###### Description

The portion of the order which is eligible to be filled by the `exclusiveFiller`, specified in basis points.

###### LimitOrderQuoteResponse.quote.orderInfo.input

> **input**: `object`

###### LimitOrderQuoteResponse.quote.orderInfo.input.endAmount

> **endAmount**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.input.startAmount

> **startAmount**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.input.token?

> `optional` **token**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.nonce

> **nonce**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.outputs

> **outputs**: `object`[]

###### LimitOrderQuoteResponse.quote.orderInfo.reactor

> **reactor**: `string`

###### LimitOrderQuoteResponse.quote.orderInfo.swapper

> **swapper**: `string`

###### LimitOrderQuoteResponse.quote.portionAmount?

> `optional` **portionAmount**: `string`

###### LimitOrderQuoteResponse.quote.portionBips?

> `optional` **portionBips**: `number`

###### LimitOrderQuoteResponse.quote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### LimitOrderQuoteResponse.quote.quoteId?

> `optional` **quoteId**: `string`

###### LimitOrderQuoteResponse.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### LimitOrderQuoteResponse.requestId

> **requestId**: `string`

###### LimitOrderQuoteResponse.routing

> **routing**: `"LIMIT_ORDER"`

###### liquidity

> **liquidity**: `string`

###### Description

The amount of liquidity in the pool at a given tick. For more information see the [Uniswap V3 Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf).

###### lpPoolFee

> **lpPoolFee**: `number`

###### Description

The fee of the pool in basis points.

###### lpTickCurrent

> **lpTickCurrent**: `number`

###### Description

The current tick of the pool. For more information see the [Uniswap V3 Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf).

###### maxFeePerGas

> **maxFeePerGas**: `string`

###### Description

The sum of the base fee and priority fee. Subtracting `maxPriorityFeePerGas` from this value will yield the base fee to be paid for this transaction.

###### maxPriorityFeePerGas

> **maxPriorityFeePerGas**: `string`

###### Description

The maximum tip to the block builder. Adjusted based upon the urgency specified in the request.

###### MigrateLPPositionRequest

> **MigrateLPPositionRequest**: `object`

###### MigrateLPPositionRequest.amount0

> **amount0**: `string`

###### MigrateLPPositionRequest.amount1

> **amount1**: `string`

###### MigrateLPPositionRequest.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### MigrateLPPositionRequest.deadline?

> `optional` **deadline**: `number`

###### MigrateLPPositionRequest.expectedTokenOwed0RawAmount

> **expectedTokenOwed0RawAmount**: `string`

###### MigrateLPPositionRequest.expectedTokenOwed1RawAmount

> **expectedTokenOwed1RawAmount**: `string`

###### MigrateLPPositionRequest.initialPrice?

> `optional` **initialPrice**: `string`

###### MigrateLPPositionRequest.inputCurrentTick

> **inputCurrentTick**: `number`

###### MigrateLPPositionRequest.inputPoolLiquidity

> **inputPoolLiquidity**: `string`

###### MigrateLPPositionRequest.inputPosition

> **inputPosition**: `object`

###### MigrateLPPositionRequest.inputPosition.pool

> **pool**: `object`

###### MigrateLPPositionRequest.inputPosition.pool.fee?

> `optional` **fee**: `number`

###### MigrateLPPositionRequest.inputPosition.pool.hooks?

> `optional` **hooks**: `string`

###### MigrateLPPositionRequest.inputPosition.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### MigrateLPPositionRequest.inputPosition.pool.token0

> **token0**: `string`

###### MigrateLPPositionRequest.inputPosition.pool.token1

> **token1**: `string`

###### MigrateLPPositionRequest.inputPosition.tickLower?

> `optional` **tickLower**: `number`

###### MigrateLPPositionRequest.inputPosition.tickUpper?

> `optional` **tickUpper**: `number`

###### MigrateLPPositionRequest.inputPositionLiquidity

> **inputPositionLiquidity**: `string`

###### MigrateLPPositionRequest.inputProtocol

> **inputProtocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### MigrateLPPositionRequest.inputSqrtRatioX96

> **inputSqrtRatioX96**: `string`

###### MigrateLPPositionRequest.outputCurrentTick?

> `optional` **outputCurrentTick**: `number`

###### MigrateLPPositionRequest.outputPoolLiquidity?

> `optional` **outputPoolLiquidity**: `string`

###### MigrateLPPositionRequest.outputPosition

> **outputPosition**: `object`

###### MigrateLPPositionRequest.outputPosition.pool

> **pool**: `object`

###### MigrateLPPositionRequest.outputPosition.pool.fee?

> `optional` **fee**: `number`

###### MigrateLPPositionRequest.outputPosition.pool.hooks?

> `optional` **hooks**: `string`

###### MigrateLPPositionRequest.outputPosition.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### MigrateLPPositionRequest.outputPosition.pool.token0

> **token0**: `string`

###### MigrateLPPositionRequest.outputPosition.pool.token1

> **token1**: `string`

###### MigrateLPPositionRequest.outputPosition.tickLower?

> `optional` **tickLower**: `number`

###### MigrateLPPositionRequest.outputPosition.tickUpper?

> `optional` **tickUpper**: `number`

###### MigrateLPPositionRequest.outputProtocol

> **outputProtocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### MigrateLPPositionRequest.outputSqrtRatioX96?

> `optional` **outputSqrtRatioX96**: `string`

###### MigrateLPPositionRequest.signature?

> `optional` **signature**: `string`

###### MigrateLPPositionRequest.signatureDeadline?

> `optional` **signatureDeadline**: `number`

###### MigrateLPPositionRequest.simulateTransaction

> **simulateTransaction**: `boolean`

###### Default

```ts
false
```

###### MigrateLPPositionRequest.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### MigrateLPPositionRequest.tokenId

> **tokenId**: `number`

###### MigrateLPPositionRequest.walletAddress

> **walletAddress**: `string`

###### MigrateLPPositionResponse

> **MigrateLPPositionResponse**: `object`

###### MigrateLPPositionResponse.gasFee?

> `optional` **gasFee**: `string`

###### MigrateLPPositionResponse.migrate?

> `optional` **migrate**: `object`

###### MigrateLPPositionResponse.migrate.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### MigrateLPPositionResponse.migrate.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### MigrateLPPositionResponse.migrate.from

> **from**: `string`

###### MigrateLPPositionResponse.migrate.gasLimit?

> `optional` **gasLimit**: `string`

###### MigrateLPPositionResponse.migrate.gasPrice?

> `optional` **gasPrice**: `string`

###### MigrateLPPositionResponse.migrate.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### MigrateLPPositionResponse.migrate.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### MigrateLPPositionResponse.migrate.to

> **to**: `string`

###### MigrateLPPositionResponse.migrate.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### MigrateLPPositionResponse.requestId?

> `optional` **requestId**: `string`

###### minAmount

> **minAmount**: `string`

###### Description

The minimum portion of the swap, stated in the base unit of the token, which will be output to the recipient.

###### nonce

> **nonce**: `string`

###### Description

A unique nonce for this order.

###### NullablePermit

> **NullablePermit**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### Description

the permit2 message object for the customer to sign to permit spending by the permit2 contract.

###### orderId

> **orderId**: `string`

###### Description

A unique ID for the order. Used to track the order's status.

###### OrderIds

> **OrderIds**: `string`

###### OrderInput

> **OrderInput**: `object`

###### OrderInput.endAmount?

> `optional` **endAmount**: `string`

###### OrderInput.startAmount?

> `optional` **startAmount**: `string`

###### OrderInput.token

> **token**: `string`

###### OrderOutput

> **OrderOutput**: `object`

###### OrderOutput.endAmount?

> `optional` **endAmount**: `string`

###### OrderOutput.isFeeOutput?

> `optional` **isFeeOutput**: `boolean`

###### OrderOutput.recipient?

> `optional` **recipient**: `string`

###### OrderOutput.startAmount?

> `optional` **startAmount**: `string`

###### OrderOutput.token

> **token**: `string`

###### OrderRequest

> **OrderRequest**: `object`

###### OrderRequest.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: `string`[]; `relativeBlocks?`: `number`[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

###### OrderRequest.routing?

> `optional` **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### OrderRequest.signature

> **signature**: `string`

###### Description

The signed permit.

###### OrderResponse

> **OrderResponse**: `object`

###### OrderResponse.orderId

> **orderId**: `string`

###### OrderResponse.orderStatus

> **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### OrderResponse.requestId

> **requestId**: `string`

###### OrderStatus

> **OrderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### Description

The status of the order. Note that all of these are final states with the exception of Open, meaning that no further state changes will occur.
     Open - order is not yet filled by a filler.
     Expired - order has expired without being filled and is no longer fillable.
     Error - a catchall for other final states which are not otherwise specified, where the order will not be filled.
     Cancelled - order is cancelled. Note that to cancel an order, a new order must be placed with the same nonce as the prior open order and it must be placed within the same block as the original order.
     Filled - order is filled.
     Insufficient-funds - the swapper (you) do not have enough funds for the order to be completed and the order is cancelled and will not be filled.
     Unverified - order has not been verified yet.

###### OrderType

> **OrderType**: `"Dutch"` \| `"Dutch_V2"` \| `"Dutch_V3"` \| `"Priority"` \| `"DutchLimit"`

###### OrderTypeQuery

> **OrderTypeQuery**: `"Dutch"` \| `"Dutch_V2"` \| `"Dutch_V1_V2"` \| `"Dutch_V3"` \| `"Limit"` \| `"Priority"`

###### outputToken

> **outputToken**: `string`

###### Description

The token which will be received, specified by its token address. For a list of supported tokens, see the [FAQ](https://api-docs.uniswap.org/guides/faqs).

###### Permit

> **Permit**: `object`

###### Description

the permit2 message object for the customer to sign to permit spending by the permit2 contract.

###### Permit.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### Permit.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### Permit.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### PermitAmount

> **PermitAmount**: `"FULL"` \| `"EXACT"`

###### Description

For Uniswap Protocols (v2, v3, v4) swaps, specify the input token spend allowance (e.g. quantity) to be set in the permit. `FULL` can be used to specify an unlimited token quantity, and may prevent the wallet from needing to sign another permit for the same token in the future. `EXACT` can be used to specify the exact input token quantity for this request. Defaults to `FULL`.

###### Default

```ts
FULL
@enum {string}
```

###### PlanResponse

> **PlanResponse**: `object`

###### PlanResponse.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### PlanResponse.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### PlanResponse.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### PlanResponse.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### PlanResponse.expectedOutput

> **expectedOutput**: `string`

###### PlanResponse.gasFee?

> `optional` **gasFee**: `string`

###### PlanResponse.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### PlanResponse.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### PlanResponse.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### PlanResponse.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### PlanResponse.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### PlanResponse.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### PlanResponse.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### PlanResponse.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### PlanResponse.quoteId

> **quoteId**: `string`

###### PlanResponse.recipient

> **recipient**: `string`

###### PlanResponse.requestId

> **requestId**: `string`

###### PlanResponse.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### PlanResponse.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### PlanResponse.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### PlanResponse.swapper

> **swapper**: `string`

###### PlanResponse.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### PlanResponse.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### PlanResponse.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### PlanResponse.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### PlanResponse.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### PlanResponse.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: `string`

###### Description

Name of the wallet.

###### PlanResponse.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: `string`

###### Description

Reverse domain name identifier for the wallet.

###### PlanResponse.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: `string`

###### Description

Unique identifier for the wallet.

###### PlanResponse.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### PlanStatus

> **PlanStatus**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### Description

The overall status of the plan execution. ACTIVE means the plan is ready to begin (all steps NOT_READY). AWAITING_ACTION means at least one step requires user action. IN_PROGRESS means at least one step is executing. COMPLETED means all steps have been successfully executed. FAILED means the plan cannot be completed.

###### PlanStep

> **PlanStep**: `object`

###### PlanStep.gasFee?

> `optional` **gasFee**: `string`

###### PlanStep.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### PlanStep.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### PlanStep.gasPrice?

> `optional` **gasPrice**: `string`

###### PlanStep.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### PlanStep.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### PlanStep.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### PlanStep.method

> **method**: `"SEND_TX"` \| `"SIGN_MSG"` \| `"SEND_CALLS"`

###### PlanStep.payload

> **payload**: `Record`\<`string`, `never`\>

###### Description

The payload data for this step. The structure depends on the payloadType.

###### PlanStep.payloadType

> **payloadType**: `"TX"` \| `"EIP_712"` \| `"EIP_5792"`

###### PlanStep.proof?

> `optional` **proof**: `object`

###### PlanStep.proof.orderId?

> `optional` **orderId**: `string`

###### Description

The order ID for a gasless order step.

###### PlanStep.proof.signature?

> `optional` **signature**: `string`

###### Description

The signature for a message signing step.

###### PlanStep.proof.txHash?

> `optional` **txHash**: `string`

###### PlanStep.recipient?

> `optional` **recipient**: `string`

###### PlanStep.routingStepKey?

> `optional` **routingStepKey**: `string`

###### Description

An optional key identifying the routing strategy used for this step.

###### PlanStep.slippage?

> `optional` **slippage**: `number`

###### PlanStep.status

> **status**: `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"NOT_READY"` \| `"COMPLETE"` \| `"STEP_ERROR"`

###### PlanStep.stepIndex

> **stepIndex**: `number`

###### Description

The index of this step in the plan (0-based).

###### PlanStep.stepType?

> `optional` **stepType**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"` \| `"QUICKROUTE"` \| `"APPROVAL_TXN"` \| `"APPROVAL_PERMIT"` \| `"RESET_APPROVAL_TXN"`

###### PlanStep.swapper?

> `optional` **swapper**: `string`

###### PlanStep.tokenIn?

> `optional` **tokenIn**: `string`

###### PlanStep.tokenInAmount?

> `optional` **tokenInAmount**: `string`

###### PlanStep.tokenInChainId?

> `optional` **tokenInChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### PlanStep.tokenOut?

> `optional` **tokenOut**: `string`

###### PlanStep.tokenOutAmount?

> `optional` **tokenOutAmount**: `string`

###### PlanStep.tokenOutChainId?

> `optional` **tokenOutChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### PlanStepMethod

> **PlanStepMethod**: `"SEND_TX"` \| `"SIGN_MSG"` \| `"SEND_CALLS"`

###### Description

The execution method for the step. SEND_TX is a standard transaction. SIGN_MSG is for signing a message (e.g., permit). SEND_CALLS is for batch transaction execution (EIP-5792).

###### PlanStepPayloadType

> **PlanStepPayloadType**: `"TX"` \| `"EIP_712"` \| `"EIP_5792"`

###### Description

The type of payload data. TX is a standard transaction object. EIP_712 is a typed structured data for signing. EIP_5792 is a batch of transaction calls.

###### PlanStepProof

> **PlanStepProof**: `object`

###### Description

Proof of execution for a plan step, provided after the step is completed.

###### PlanStepProof.orderId?

> `optional` **orderId**: `string`

###### Description

The order ID for a gasless order step.

###### PlanStepProof.signature?

> `optional` **signature**: `string`

###### Description

The signature for a message signing step.

###### PlanStepProof.txHash?

> `optional` **txHash**: `string`

###### PlanStepStatus

> **PlanStepStatus**: `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"NOT_READY"` \| `"COMPLETE"` \| `"STEP_ERROR"`

###### Description

The status of an individual step. NOT_READY means prerequisites are not met. AWAITING_ACTION means the step is ready for user action. IN_PROGRESS means the step is being executed. COMPLETE means the step finished successfully. STEP_ERROR means the step failed.

###### PlanStepType

> **PlanStepType**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"` \| `"QUICKROUTE"` \| `"APPROVAL_TXN"` \| `"APPROVAL_PERMIT"` \| `"RESET_APPROVAL_TXN"`

###### Description

The type of step in a plan, including swap types and approval types.

###### Pool

> **Pool**: `object`

###### Pool.fee?

> `optional` **fee**: `number`

###### Pool.hooks?

> `optional` **hooks**: `string`

###### Pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### Pool.token0

> **token0**: `string`

###### Pool.token1

> **token1**: `string`

###### poolFee

> **poolFee**: `string`

###### Description

The fee of the pool in basis points.

###### PoolInfoRequest

> **PoolInfoRequest**: `object`

###### PoolInfoRequest.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### PoolInfoRequest.currentPage?

> `optional` **currentPage**: `number`

###### PoolInfoRequest.pageSize?

> `optional` **pageSize**: `number`

###### PoolInfoRequest.poolParams?

> `optional` **poolParams**: `object`

###### PoolInfoRequest.poolParams.fee?

> `optional` **fee**: `number`

###### Description

The fee of the pool, if the pool has a fee value.

###### PoolInfoRequest.poolParams.hookAddress?

> `optional` **hookAddress**: `string`

###### Description

The address of the hook for the pool, if any.

###### PoolInfoRequest.poolParams.tickSpacing?

> `optional` **tickSpacing**: `number`

###### PoolInfoRequest.poolParams.token0?

> `optional` **token0**: `string`

###### PoolInfoRequest.poolParams.token1?

> `optional` **token1**: `string`

###### PoolInfoRequest.poolReferences?

> `optional` **poolReferences**: `object`[]

###### Description

Array of pool reference identifiers to query. Each reference should include the protocol, chainId, and either the pool address (V3), pool id (V4), or pair address (V2).

###### PoolInfoRequest.protocol

> **protocol**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### PoolInfoResponse

> **PoolInfoResponse**: `object`

###### PoolInfoResponse.currentPage?

> `optional` **currentPage**: `number`

###### PoolInfoResponse.pageSize?

> `optional` **pageSize**: `number`

###### PoolInfoResponse.pools?

> `optional` **pools**: `object`[]

###### Description

Array of pool information objects.

###### PoolInfoResponse.requestId?

> `optional` **requestId**: `string`

###### PoolInformation

> **PoolInformation**: `object`

###### PoolInformation.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### PoolInformation.currentTick?

> `optional` **currentTick**: `number`

###### PoolInformation.fee?

> `optional` **fee**: `string`

###### PoolInformation.hookAddress?

> `optional` **hookAddress**: `string`

###### Description

The address of the hook for the pool, if any.

###### PoolInformation.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### PoolInformation.poolProtocol?

> `optional` **poolProtocol**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### PoolInformation.poolReferenceIdentifier?

> `optional` **poolReferenceIdentifier**: `string`

###### Description

The unique identifier for the pool reference, which can be a pool address, pool id, or pair address depending on the protocol.

###### PoolInformation.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### PoolInformation.tickSpacing?

> `optional` **tickSpacing**: `number`

###### PoolInformation.tokenAddressA?

> `optional` **tokenAddressA**: `string`

###### PoolInformation.tokenAddressB?

> `optional` **tokenAddressB**: `string`

###### PoolInformation.tokenAmountA?

> `optional` **tokenAmountA**: `string`

###### PoolInformation.tokenAmountB?

> `optional` **tokenAmountB**: `string`

###### PoolInformation.tokenAReserves?

> `optional` **tokenAReserves**: `string`

###### PoolInformation.tokenBReserves?

> `optional` **tokenBReserves**: `string`

###### PoolInformation.tokenDecimalsA?

> `optional` **tokenDecimalsA**: `number`

###### Description

The number of decimals for token A.

###### PoolInformation.tokenDecimalsB?

> `optional` **tokenDecimalsB**: `number`

###### Description

The number of decimals for token B.

###### PoolParameters

> **PoolParameters**: `object`

###### PoolParameters.fee?

> `optional` **fee**: `number`

###### Description

The fee of the pool, if the pool has a fee value.

###### PoolParameters.hookAddress?

> `optional` **hookAddress**: `string`

###### Description

The address of the hook for the pool, if any.

###### PoolParameters.tickSpacing?

> `optional` **tickSpacing**: `number`

###### PoolParameters.token0?

> `optional` **token0**: `string`

###### PoolParameters.token1?

> `optional` **token1**: `string`

###### PoolReferenceByProtocol

> **PoolReferenceByProtocol**: `object`

###### PoolReferenceByProtocol.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### PoolReferenceByProtocol.protocol

> **protocol**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### PoolReferenceByProtocol.referenceIdentifier?

> `optional` **referenceIdentifier**: `string`

###### portionAmount

> **portionAmount**: `string`

###### Description

The portion of the swap that will be taken as a fee in the base units of the token. The fee will be taken from the output token.

###### portionAmountReceiverAddress

> **portionAmountReceiverAddress**: `string`

###### Description

The wallet address which will receive the fee.

###### portionBips

> **portionBips**: `number`

###### Description

The portion of the swap that will be taken as a fee stated in basis points. The fee will be taken from the output token.

###### Position

> **Position**: `object`

###### Position.pool

> **pool**: `object`

###### Position.pool.fee?

> `optional` **fee**: `number`

###### Position.pool.hooks?

> `optional` **hooks**: `string`

###### Position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### Position.pool.token0

> **token0**: `string`

###### Position.pool.token1

> **token1**: `string`

###### Position.tickLower?

> `optional` **tickLower**: `number`

###### Position.tickUpper?

> `optional` **tickUpper**: `number`

###### PriorityInput

> **PriorityInput**: `object`

###### PriorityInput.amount

> **amount**: `string`

###### PriorityInput.mpsPerPriorityFeeWei

> **mpsPerPriorityFeeWei**: `string`

###### PriorityInput.token

> **token**: `string`

###### PriorityOrderInfo

> **PriorityOrderInfo**: `object`

###### PriorityOrderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### PriorityOrderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### PriorityOrderInfo.auctionStartBlock

> **auctionStartBlock**: `string`

###### PriorityOrderInfo.baselinePriorityFeeWei

> **baselinePriorityFeeWei**: `string`

###### PriorityOrderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### PriorityOrderInfo.cosigner

> **cosigner**: `string`

###### PriorityOrderInfo.deadline

> **deadline**: `number`

###### PriorityOrderInfo.input

> **input**: `object`

###### PriorityOrderInfo.input.amount

> **amount**: `string`

###### PriorityOrderInfo.input.mpsPerPriorityFeeWei

> **mpsPerPriorityFeeWei**: `string`

###### PriorityOrderInfo.input.token

> **token**: `string`

###### PriorityOrderInfo.nonce

> **nonce**: `string`

###### PriorityOrderInfo.outputs

> **outputs**: `object`[]

###### PriorityOrderInfo.reactor

> **reactor**: `string`

###### PriorityOrderInfo.swapper

> **swapper**: `string`

###### PriorityOutput

> **PriorityOutput**: `object`

###### PriorityOutput.amount

> **amount**: `string`

###### PriorityOutput.mpsPerPriorityFeeWei

> **mpsPerPriorityFeeWei**: `string`

###### Description

The scaling factor of the priority fee based on the output token amount.

###### PriorityOutput.recipient

> **recipient**: `string`

###### PriorityOutput.token

> **token**: `string`

###### PriorityQuote

> **PriorityQuote**: `object`

UniswapX Priority Quote

###### PriorityQuote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### PriorityQuote.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### PriorityQuote.deadlineBufferSecs?

> `optional` **deadlineBufferSecs**: `number`

###### PriorityQuote.encodedOrder

> **encodedOrder**: `string`

###### PriorityQuote.expectedAmountIn?

> `optional` **expectedAmountIn**: `string`

###### PriorityQuote.expectedAmountOut?

> `optional` **expectedAmountOut**: `string`

###### PriorityQuote.orderId

> **orderId**: `string`

###### PriorityQuote.orderInfo

> **orderInfo**: `object`

###### PriorityQuote.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### PriorityQuote.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### PriorityQuote.orderInfo.auctionStartBlock

> **auctionStartBlock**: `string`

###### PriorityQuote.orderInfo.baselinePriorityFeeWei

> **baselinePriorityFeeWei**: `string`

###### PriorityQuote.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### PriorityQuote.orderInfo.cosigner

> **cosigner**: `string`

###### PriorityQuote.orderInfo.deadline

> **deadline**: `number`

###### PriorityQuote.orderInfo.input

> **input**: `object`

###### PriorityQuote.orderInfo.input.amount

> **amount**: `string`

###### PriorityQuote.orderInfo.input.mpsPerPriorityFeeWei

> **mpsPerPriorityFeeWei**: `string`

###### PriorityQuote.orderInfo.input.token

> **token**: `string`

###### PriorityQuote.orderInfo.nonce

> **nonce**: `string`

###### PriorityQuote.orderInfo.outputs

> **outputs**: `object`[]

###### PriorityQuote.orderInfo.reactor

> **reactor**: `string`

###### PriorityQuote.orderInfo.swapper

> **swapper**: `string`

###### PriorityQuote.portionAmount?

> `optional` **portionAmount**: `string`

###### PriorityQuote.portionBips?

> `optional` **portionBips**: `number`

###### PriorityQuote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### PriorityQuote.quoteId?

> `optional` **quoteId**: `string`

###### PriorityQuote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### ProtocolItems

> **ProtocolItems**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### Description

The protocol to use for the swap/order.

###### Protocols

> **Protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### Description

The protocols to use for the swap/order. If the `protocols` field is defined, then you can only set the `routingPreference` to `BEST_PRICE`. Note that the value `UNISWAPX` is deprecated and will be removed in a future release.

###### Quote

> **Quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ... \| ...; `token?`: ... \| ...; \}; `reserve1?`: \{ `quotient?`: ... \| ...; `token?`: ... \| ...; \}; `tokenIn?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `tokenOut`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: `string`[]; `relativeBlocks?`: `number`[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ... \| ...; `token?`: ... \| ...; \}; `reserve1?`: \{ `quotient?`: ... \| ...; `token?`: ... \| ...; \}; `tokenIn?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut?`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `tokenOut`: \{ `address?`: `string`; `buyFeeBps?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `decimals?`: `string`; `sellFeeBps?`: `string`; `symbol?`: `string`; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: `string`[]; `relativeBlocks?`: `number`[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### quoteId

> **quoteId**: `string`

###### Description

A unique ID for the quote.

###### QuoteRequest

> **QuoteRequest**: `object`

###### QuoteRequest.amount

> **amount**: `string`

###### QuoteRequest.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### QuoteRequest.generatePermitAsTransaction?

> `optional` **generatePermitAsTransaction**: `boolean`

###### QuoteRequest.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### QuoteRequest.permitAmount?

> `optional` **permitAmount**: `"FULL"` \| `"EXACT"`

###### QuoteRequest.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### QuoteRequest.routingPreference?

> `optional` **routingPreference**: `"BEST_PRICE"` \| `"FASTEST"`

###### QuoteRequest.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### QuoteRequest.spreadOptimization?

> `optional` **spreadOptimization**: `"EXECUTION"` \| `"PRICE"`

###### QuoteRequest.swapper

> **swapper**: `string`

###### QuoteRequest.tokenIn

> **tokenIn**: `string`

###### QuoteRequest.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### QuoteRequest.tokenOut

> **tokenOut**: `string`

###### QuoteRequest.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### QuoteRequest.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### QuoteRequest.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### QuoteResponse

> **QuoteResponse**: `object`

###### QuoteResponse.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### QuoteResponse.permitGasFee?

> `optional` **permitGasFee**: `string`

###### QuoteResponse.permitTransaction?

> `optional` **permitTransaction**: `object`

###### QuoteResponse.permitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### QuoteResponse.permitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### QuoteResponse.permitTransaction.from

> **from**: `string`

###### QuoteResponse.permitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### QuoteResponse.permitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### QuoteResponse.permitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### QuoteResponse.permitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### QuoteResponse.permitTransaction.to

> **to**: `string`

###### QuoteResponse.permitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### QuoteResponse.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: `string`[]; `relativeBlocks?`: `number`[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (\{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `reserve0?`: \{ `quotient?`: ...; `token?`: ...; \}; `reserve1?`: \{ `quotient?`: ...; `token?`: ...; \}; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address?`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee?`: `string`; `liquidity?`: `string`; `sqrtRatioX96?`: `string`; `tickCurrent?`: `string`; `tokenIn?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `tokenOut?`: \{ `address?`: ...; `buyFeeBps?`: ...; `chainId?`: ...; `decimals?`: ...; `sellFeeBps?`: ...; `symbol?`: ...; \}; `type`: `string`; \} \| \{ `address`: `string`; `amountIn?`: `string`; `amountOut?`: `string`; `fee`: `string`; `hooks`: `string`; `liquidity`: `string`; `sqrtRatioX96`: `string`; `tickCurrent`: `string`; `tickSpacing`: `number`; `tokenIn`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `tokenOut`: \{ `address?`: ... \| ...; `buyFeeBps?`: ... \| ...; `chainId?`: ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ... \| ...; `decimals?`: ... \| ...; `sellFeeBps?`: ... \| ...; `symbol?`: ... \| ...; \}; `type`: `string`; \})[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: `string`[]; `relativeBlocks?`: `number`[]; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### QuoteResponse.requestId

> **requestId**: `string`

###### QuoteResponse.routing

> **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### receiverWalletAddress

> **receiverWalletAddress**: `string`

###### Description

The wallet address which will receive the token.

###### RequestId

> **RequestId**: `string`

###### Description

A unique ID for the request.

###### Routing

> **Routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### Description

The routing for the proposed transaction.

###### RoutingPreference

> **RoutingPreference**: `"BEST_PRICE"` \| `"FASTEST"`

###### Description

The `routingPreference` specifies the preferred strategy to determine the quote. If the `routingPreference` is `BEST_PRICE`, then the quote will propose a route through the specified whitelisted protocols (or all, if none are specified) that provides the best price. When the `routingPreference` is `FASTEST`, the quote will propose the first route which is found to complete the swap.

###### Default

```ts
BEST_PRICE
@enum {string}
```

###### SafetyLevel

> **SafetyLevel**: `"BLOCKED"` \| `"MEDIUM_WARNING"` \| `"STRONG_WARNING"` \| `"VERIFIED"`

###### ScopeData

> **ScopeData**: `object`

###### Description

Data defining a wallet scope including accounts, methods, capabilities, chains, and client context.

###### ScopeData.accounts

> **accounts**: `string`[]

###### Description

Array of account addresses associated with this scope.

###### ScopeData.capabilities?

> `optional` **capabilities**: `object`

###### Index Signature

\[`key`: `string`\]: `unknown`

###### Description

Additional capabilities for this scope.

###### ScopeData.chains?

> `optional` **chains**: `string`[]

###### Description

Array of chain identifiers allowed in this scope.

###### ScopeData.clientContext?

> `optional` **clientContext**: `object`

###### ScopeData.clientContext.directPrivateKeyAccess?

> `optional` **directPrivateKeyAccess**: `boolean`

###### Description

Whether the wallet has direct private key access.

###### ScopeData.clientContext.nextEvmUpgradeAddress?

> `optional` **nextEvmUpgradeAddress**: `string`

###### Description

Address for the next EVM upgrade.

###### ScopeData.methods

> **methods**: `string`[]

###### Description

Array of methods allowed in this scope.

###### senderWalletAddress

> **senderWalletAddress**: `string`

###### Description

The wallet address which will be used to send the token.

###### SettledAmount

> **SettledAmount**: `object`

###### SettledAmount.amountIn?

> `optional` **amountIn**: `string`

###### SettledAmount.amountOut?

> `optional` **amountOut**: `string`

###### SettledAmount.tokenIn?

> `optional` **tokenIn**: `string`

###### SettledAmount.tokenOut?

> `optional` **tokenOut**: `string`

###### slippageTolerance

> **slippageTolerance**: `number`

###### Description

The slippage tolerance as a percentage up to a maximum of two decimal places. For Uniswap Protocols (v2, v3, v4), the slippage tolerance is the maximum amount the price can change between the time the transaction is submitted and the time it is executed. The slippage tolerance is a percentage of the total value of the swap.

    When submitting a quote, note that slippage tolerance works differently in UniswapX swaps where it does not set a limit on the Spread in an order. See [here](https://api-docs.uniswap.org/guides/faqs#why-do-uniswapx-quotes-have-more-slippage-than-the-tolerance-i-set) for more information.

    Note that if the trade type is `EXACT_INPUT`, then the slippage is in terms of the output token. If the trade type is `EXACT_OUTPUT`, then the slippage is in terms of the input token.

    When submitting a request, `slippageTolerance` may not be set when `autoSlippage` is defined. One of `slippageTolerance` or `autoSlippage` must be defined.

###### SortKey

> **SortKey**: `"createdAt"`

###### SpreadOptimization

> **SpreadOptimization**: `"EXECUTION"` \| `"PRICE"`

###### Description

For UniswapX swaps, when set to `EXECUTION`, quotes optimize for looser spreads at higher fill rates. When set to `PRICE`, quotes optimize for tighter spreads at lower fill rates. This field is not applicable to Uniswap Protocols (v2, v3, v4), bridging, or wrapping/unwrapping and will be ignored if set.

###### Default

```ts
EXECUTION
@enum {string}
```

###### sqrtRatioX96

> **sqrtRatioX96**: `string`

###### Description

The square root of the ratio of the token0 and token1 in the pool, as a Q64.64 number. For more information see the [Uniswap V3 Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf).

###### startAmount

> **startAmount**: `string`

###### Description

The intended execution quantity of tokens resulting from this swap.

###### StepUpdate

> **StepUpdate**: `object`

###### Description

Represents a single step update with proof. Note: orderId is not accepted in update requests; it is system-generated after receiving a signature.

###### StepUpdate.proof

> **proof**: `object`

###### Description

Proof of step completion. Must provide either txHash or signature.

###### StepUpdate.proof.signature?

> `optional` **signature**: `string`

###### Description

The signature for a message signing step.

###### StepUpdate.proof.txHash?

> `optional` **txHash**: `string`

###### StepUpdate.stepIndex

> **stepIndex**: `number`

###### Description

The index of the step being updated (0-based).

###### SwapSafetyMode

> **SwapSafetyMode**: `"SAFE"`

###### Description

Swap safety mode will automatically sweep the transaction for the native token and return it to the sender wallet address. This is to prevent accidental loss of funds in the event that the token amount is set in the transaction value instead of as part of the calldata.

###### SwapStatus

> **SwapStatus**: `"PENDING"` \| `"SUCCESS"` \| `"NOT_FOUND"` \| `"FAILED"` \| `"EXPIRED"`

###### tickCurrent

> **tickCurrent**: `string`

###### Description

The current tick of the pool. For more information see the [Uniswap V3 Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf).

###### tickSpacing

> **tickSpacing**: `number`

###### Description

The width of ticks in this pool (e.g. the price range between two ticks) specified in basis points. For more information see the [Uniswap V3 Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf).

###### tokenAmount

> **tokenAmount**: `string`

###### Description

The quantity of tokens denominated in the token's base units. (For example, for an ERC20 token one token is 1x10^18 base units. For one USDC token one token is 1x10^6 base units.) This value must be greater than 0.

###### TokenInRoute

> **TokenInRoute**: `object`

###### TokenInRoute.address?

> `optional` **address**: `string`

###### TokenInRoute.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### TokenInRoute.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### TokenInRoute.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### TokenInRoute.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### TokenInRoute.symbol?

> `optional` **symbol**: `string`

###### TokenProject

> **TokenProject**: `object`

###### TokenProject.isSpam

> **isSpam**: `boolean`

###### TokenProject.logo

> **logo**: `object`

###### TokenProject.logo.url

> **url**: `string`

###### TokenProject.safetyLevel

> **safetyLevel**: `"BLOCKED"` \| `"MEDIUM_WARNING"` \| `"STRONG_WARNING"` \| `"VERIFIED"`

###### TokenProjectLogo

> **TokenProjectLogo**: `object`

###### TokenProjectLogo.url

> **url**: `string`

###### tokenSymbol

> **tokenSymbol**: `string`

###### Description

The symbol of the token.

###### Example

```ts
ETH
```

###### TradeType

> **TradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### Description

The handling of the `amount` field. `EXACT_INPUT` means the requester will send the specified `amount` of input tokens and get a quote with a variable quantity of output tokens. `EXACT_OUTPUT` means the requester will receive the specified `amount` of output tokens and get a quote with a variable quantity of input tokens.

###### Default

```ts
EXACT_INPUT
@enum {string}
```

###### TransactionFailureReason

> **TransactionFailureReason**: `"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`

###### TransactionHash

> **TransactionHash**: `string`

###### Description

The unique hash of the transaction.

###### TransactionRequest

> **TransactionRequest**: `object`

###### TransactionRequest.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### TransactionRequest.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### TransactionRequest.from

> **from**: `string`

###### TransactionRequest.gasLimit?

> `optional` **gasLimit**: `string`

###### TransactionRequest.gasPrice?

> `optional` **gasPrice**: `string`

###### TransactionRequest.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### TransactionRequest.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### TransactionRequest.to

> **to**: `string`

###### TransactionRequest.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### TransactionRequest5792

> **TransactionRequest5792**: `object`

###### TransactionRequest5792.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### TransactionRequest5792.gasLimit?

> `optional` **gasLimit**: `string`

###### TransactionRequest5792.gasPrice?

> `optional` **gasPrice**: `string`

###### TransactionRequest5792.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### TransactionRequest5792.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### TransactionRequest5792.to

> **to**: `string`

###### TransactionRequest5792.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### TruncatedPlanStep

> **TruncatedPlanStep**: `object`

###### Description

A truncated representation of a plan step containing only routing information.

###### TruncatedPlanStep.slippage?

> `optional` **slippage**: `number`

###### TruncatedPlanStep.stepType

> **stepType**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"` \| `"QUICKROUTE"` \| `"APPROVAL_TXN"` \| `"APPROVAL_PERMIT"` \| `"RESET_APPROVAL_TXN"`

###### TruncatedPlanStep.tokenIn?

> `optional` **tokenIn**: `string`

###### TruncatedPlanStep.tokenInChainId?

> `optional` **tokenInChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### TruncatedPlanStep.tokenOut?

> `optional` **tokenOut**: `string`

###### TruncatedPlanStep.tokenOutChainId?

> `optional` **tokenOutChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### UniswapXOrder

> **UniswapXOrder**: `object`

###### UniswapXOrder.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### UniswapXOrder.cosignature?

> `optional` **cosignature**: `string`

###### UniswapXOrder.cosignerData?

> `optional` **cosignerData**: `object`

###### UniswapXOrder.cosignerData.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### UniswapXOrder.cosignerData.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### UniswapXOrder.cosignerData.exclusiveFiller?

> `optional` **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### UniswapXOrder.cosignerData.inputOverride?

> `optional` **inputOverride**: `string`

###### UniswapXOrder.cosignerData.outputOverrides?

> `optional` **outputOverrides**: `string`[]

###### UniswapXOrder.encodedOrder

> **encodedOrder**: `string`

###### UniswapXOrder.input?

> `optional` **input**: `object`

###### UniswapXOrder.input.endAmount?

> `optional` **endAmount**: `string`

###### UniswapXOrder.input.startAmount?

> `optional` **startAmount**: `string`

###### UniswapXOrder.input.token

> **token**: `string`

###### UniswapXOrder.nonce

> **nonce**: `string`

###### UniswapXOrder.orderId

> **orderId**: `string`

###### UniswapXOrder.orderStatus

> **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### UniswapXOrder.outputs?

> `optional` **outputs**: `object`[]

###### UniswapXOrder.quoteId?

> `optional` **quoteId**: `string`

###### UniswapXOrder.settledAmounts?

> `optional` **settledAmounts**: `object`[]

###### UniswapXOrder.signature

> **signature**: `string`

###### UniswapXOrder.swapper?

> `optional` **swapper**: `string`

###### UniswapXOrder.txHash?

> `optional` **txHash**: `string`

###### UniswapXOrder.type

> **type**: `"Dutch"` \| `"Dutch_V2"` \| `"Dutch_V3"` \| `"Priority"` \| `"DutchLimit"`

###### UniversalRouterVersion

> **UniversalRouterVersion**: `"1.2"` \| `"2.0"`

###### Default

```ts
2.0
@enum {string}
```

###### UpdatePlanRequest

> **UpdatePlanRequest**: `object`

###### UpdatePlanRequest.steps

> **steps**: `object`[]

###### Description

Array of steps with proofs to attach. Only steps being updated need to be included.

###### Urgency

> **Urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### Description

The urgency impacts the estimated gas price of the transaction. The higher the urgency, the higher the gas price, and the faster the transaction is likely to be selected from the mempool. The default value is `urgent`.

###### Default

```ts
urgent
@enum {string}
```

###### V2PoolInRoute

> **V2PoolInRoute**: `object`

V2 Route

###### V2PoolInRoute.address?

> `optional` **address**: `string`

###### V2PoolInRoute.amountIn?

> `optional` **amountIn**: `string`

###### V2PoolInRoute.amountOut?

> `optional` **amountOut**: `string`

###### V2PoolInRoute.reserve0?

> `optional` **reserve0**: `object`

###### V2PoolInRoute.reserve0.quotient?

> `optional` **quotient**: `string`

###### Description

The quantity of this token remaining in the pool, specified in the base units of the token.

###### V2PoolInRoute.reserve0.token?

> `optional` **token**: `object`

###### V2PoolInRoute.reserve0.token.address?

> `optional` **address**: `string`

###### V2PoolInRoute.reserve0.token.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V2PoolInRoute.reserve0.token.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V2PoolInRoute.reserve0.token.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V2PoolInRoute.reserve0.token.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V2PoolInRoute.reserve0.token.symbol?

> `optional` **symbol**: `string`

###### V2PoolInRoute.reserve1?

> `optional` **reserve1**: `object`

###### V2PoolInRoute.reserve1.quotient?

> `optional` **quotient**: `string`

###### Description

The quantity of this token remaining in the pool, specified in the base units of the token.

###### V2PoolInRoute.reserve1.token?

> `optional` **token**: `object`

###### V2PoolInRoute.reserve1.token.address?

> `optional` **address**: `string`

###### V2PoolInRoute.reserve1.token.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V2PoolInRoute.reserve1.token.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V2PoolInRoute.reserve1.token.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V2PoolInRoute.reserve1.token.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V2PoolInRoute.reserve1.token.symbol?

> `optional` **symbol**: `string`

###### V2PoolInRoute.tokenIn?

> `optional` **tokenIn**: `object`

###### V2PoolInRoute.tokenIn.address?

> `optional` **address**: `string`

###### V2PoolInRoute.tokenIn.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V2PoolInRoute.tokenIn.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V2PoolInRoute.tokenIn.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V2PoolInRoute.tokenIn.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V2PoolInRoute.tokenIn.symbol?

> `optional` **symbol**: `string`

###### V2PoolInRoute.tokenOut?

> `optional` **tokenOut**: `object`

###### V2PoolInRoute.tokenOut.address?

> `optional` **address**: `string`

###### V2PoolInRoute.tokenOut.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V2PoolInRoute.tokenOut.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V2PoolInRoute.tokenOut.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V2PoolInRoute.tokenOut.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V2PoolInRoute.tokenOut.symbol?

> `optional` **symbol**: `string`

###### V2PoolInRoute.type

> **type**: `string`

###### Default

```ts
v2-pool
```

###### V2Reserve

> **V2Reserve**: `object`

###### Description

The remaining reserve of this token in the pool.

###### V2Reserve.quotient?

> `optional` **quotient**: `string`

###### Description

The quantity of this token remaining in the pool, specified in the base units of the token.

###### V2Reserve.token?

> `optional` **token**: `object`

###### V2Reserve.token.address?

> `optional` **address**: `string`

###### V2Reserve.token.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V2Reserve.token.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V2Reserve.token.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V2Reserve.token.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V2Reserve.token.symbol?

> `optional` **symbol**: `string`

###### V3PoolInRoute

> **V3PoolInRoute**: `object`

V3 Route

###### V3PoolInRoute.address?

> `optional` **address**: `string`

###### V3PoolInRoute.amountIn?

> `optional` **amountIn**: `string`

###### V3PoolInRoute.amountOut?

> `optional` **amountOut**: `string`

###### V3PoolInRoute.fee?

> `optional` **fee**: `string`

###### V3PoolInRoute.liquidity?

> `optional` **liquidity**: `string`

###### V3PoolInRoute.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### V3PoolInRoute.tickCurrent?

> `optional` **tickCurrent**: `string`

###### V3PoolInRoute.tokenIn?

> `optional` **tokenIn**: `object`

###### V3PoolInRoute.tokenIn.address?

> `optional` **address**: `string`

###### V3PoolInRoute.tokenIn.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V3PoolInRoute.tokenIn.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V3PoolInRoute.tokenIn.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V3PoolInRoute.tokenIn.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V3PoolInRoute.tokenIn.symbol?

> `optional` **symbol**: `string`

###### V3PoolInRoute.tokenOut?

> `optional` **tokenOut**: `object`

###### V3PoolInRoute.tokenOut.address?

> `optional` **address**: `string`

###### V3PoolInRoute.tokenOut.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V3PoolInRoute.tokenOut.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V3PoolInRoute.tokenOut.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V3PoolInRoute.tokenOut.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V3PoolInRoute.tokenOut.symbol?

> `optional` **symbol**: `string`

###### V3PoolInRoute.type

> **type**: `string`

###### Default

```ts
v3-pool
```

###### V4PoolInRoute

> **V4PoolInRoute**: `object`

V4 Route

###### V4PoolInRoute.address

> **address**: `string`

###### V4PoolInRoute.amountIn?

> `optional` **amountIn**: `string`

###### V4PoolInRoute.amountOut?

> `optional` **amountOut**: `string`

###### V4PoolInRoute.fee

> **fee**: `string`

###### V4PoolInRoute.hooks

> **hooks**: `string`

###### Description

The address of the hook for the pool, if any. If the pool has no hook, this field will be the null address (e.g. 0x0000000000000000000000000000000000000000).

###### V4PoolInRoute.liquidity

> **liquidity**: `string`

###### V4PoolInRoute.sqrtRatioX96

> **sqrtRatioX96**: `string`

###### V4PoolInRoute.tickCurrent

> **tickCurrent**: `string`

###### V4PoolInRoute.tickSpacing

> **tickSpacing**: `number`

###### V4PoolInRoute.tokenIn

> **tokenIn**: `object`

###### V4PoolInRoute.tokenIn.address?

> `optional` **address**: `string`

###### V4PoolInRoute.tokenIn.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V4PoolInRoute.tokenIn.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V4PoolInRoute.tokenIn.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V4PoolInRoute.tokenIn.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V4PoolInRoute.tokenIn.symbol?

> `optional` **symbol**: `string`

###### V4PoolInRoute.tokenOut

> **tokenOut**: `object`

###### V4PoolInRoute.tokenOut.address?

> `optional` **address**: `string`

###### V4PoolInRoute.tokenOut.buyFeeBps?

> `optional` **buyFeeBps**: `string`

###### V4PoolInRoute.tokenOut.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### V4PoolInRoute.tokenOut.decimals?

> `optional` **decimals**: `string`

###### Description

The number of decimals supported by the token. This number is used to convert token amounts to the token's common representation.

###### V4PoolInRoute.tokenOut.sellFeeBps?

> `optional` **sellFeeBps**: `string`

###### V4PoolInRoute.tokenOut.symbol?

> `optional` **symbol**: `string`

###### V4PoolInRoute.type

> **type**: `string`

###### Default

```ts
v4-pool
```

###### WalletCheckDelegationRequestBody

> **WalletCheckDelegationRequestBody**: `object`

###### WalletCheckDelegationRequestBody.chainIds

> **chainIds**: (`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`)[]

###### Description

Array of chain IDs to check delegation status for.

###### WalletCheckDelegationRequestBody.walletAddresses?

> `optional` **walletAddresses**: `string`[]

###### Description

Array of wallet addresses to check delegation status for.

###### WalletCheckDelegationResponseBody

> **WalletCheckDelegationResponseBody**: `object`

###### WalletCheckDelegationResponseBody.delegationDetails

> **delegationDetails**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of wallet addresses to chain IDs to delegation details.

###### WalletCheckDelegationResponseBody.requestId

> **requestId**: `string`

###### WalletEncode7702RequestBody

> **WalletEncode7702RequestBody**: `object`

###### WalletEncode7702RequestBody.calls

> **calls**: `object`[]

###### Description

Array of transaction requests to be encoded. All transactions must have the same chainId.

###### WalletEncode7702RequestBody.smartContractDelegationAddress

> **smartContractDelegationAddress**: `string`

###### Description

The address of the smart contract delegation implementation to use.

###### WalletEncode7702RequestBody.walletAddress

> **walletAddress**: `string`

###### Description

The address of the wallet for which the transactions will be encoded.

###### WalletExecutionContext

> **WalletExecutionContext**: `object`

###### Description

Wallet execution context based on CAIP-25 Standard. Provides information about wallet capabilities and scopes.

###### WalletExecutionContext.properties?

> `optional` **properties**: `object`

###### WalletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### WalletExecutionContext.properties.walletInfo.name?

> `optional` **name**: `string`

###### Description

Name of the wallet.

###### WalletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: `string`

###### Description

Reverse domain name identifier for the wallet.

###### WalletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: `string`

###### Description

Unique identifier for the wallet.

###### WalletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### WalletInfo

> **WalletInfo**: `object`

###### Description

Information about the wallet.

###### WalletInfo.name?

> `optional` **name**: `string`

###### Description

Name of the wallet.

###### WalletInfo.rdns?

> `optional` **rdns**: `string`

###### Description

Reverse domain name identifier for the wallet.

###### WalletInfo.uuid?

> `optional` **uuid**: `string`

###### Description

Unique identifier for the wallet.

###### WalletProperties

> **WalletProperties**: `object`

###### Description

Properties describing the wallet.

###### WalletProperties.walletInfo?

> `optional` **walletInfo**: `object`

###### WalletProperties.walletInfo.name?

> `optional` **name**: `string`

###### Description

Name of the wallet.

###### WalletProperties.walletInfo.rdns?

> `optional` **rdns**: `string`

###### Description

Reverse domain name identifier for the wallet.

###### WalletProperties.walletInfo.uuid?

> `optional` **uuid**: `string`

###### Description

Unique identifier for the wallet.

###### WrapUnwrapQuote

> **WrapUnwrapQuote**: `object`

Wrap/Unwrap Quote

###### WrapUnwrapQuote.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### WrapUnwrapQuote.gasFee?

> `optional` **gasFee**: `string`

###### WrapUnwrapQuote.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### WrapUnwrapQuote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### WrapUnwrapQuote.gasPrice?

> `optional` **gasPrice**: `string`

###### WrapUnwrapQuote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### WrapUnwrapQuote.input?

> `optional` **input**: `object`

###### WrapUnwrapQuote.input.amount?

> `optional` **amount**: `string`

###### WrapUnwrapQuote.input.token?

> `optional` **token**: `string`

###### WrapUnwrapQuote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### WrapUnwrapQuote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### WrapUnwrapQuote.output?

> `optional` **output**: `object`

###### WrapUnwrapQuote.output.amount?

> `optional` **amount**: `string`

###### WrapUnwrapQuote.output.recipient?

> `optional` **recipient**: `string`

###### WrapUnwrapQuote.output.token?

> `optional` **token**: `string`

###### WrapUnwrapQuote.swapper?

> `optional` **swapper**: `string`

###### WrapUnwrapQuote.tradeType?

> `optional` **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

***

### operations

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2322](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2322)

#### Properties

##### aggregator\_quote

> **aggregator\_quote**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2345](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2345)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `object`

###### parameters.header.x-erc20eth-enabled?

> `optional` **x-erc20eth-enabled**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount

> **amount**: `string`

###### requestBody.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### requestBody.content.application/json.generatePermitAsTransaction?

> `optional` **generatePermitAsTransaction**: `boolean`

###### requestBody.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### requestBody.content.application/json.permitAmount?

> `optional` **permitAmount**: `"FULL"` \| `"EXACT"`

###### requestBody.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### requestBody.content.application/json.routingPreference?

> `optional` **routingPreference**: `"BEST_PRICE"` \| `"FASTEST"`

###### requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### requestBody.content.application/json.spreadOptimization?

> `optional` **spreadOptimization**: `"EXECUTION"` \| `"PRICE"`

###### requestBody.content.application/json.swapper

> **swapper**: `string`

###### requestBody.content.application/json.tokenIn

> **tokenIn**: `string`

###### requestBody.content.application/json.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.tokenOut

> **tokenOut**: `string`

###### requestBody.content.application/json.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### responses.200.content.application/json.permitGasFee?

> `optional` **permitGasFee**: `string`

###### responses.200.content.application/json.permitTransaction?

> `optional` **permitTransaction**: `object`

###### responses.200.content.application/json.permitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.permitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.permitTransaction.from

> **from**: `string`

###### responses.200.content.application/json.permitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.permitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.permitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.permitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.permitTransaction.to

> **to**: `string`

###### responses.200.content.application/json.permitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ... \| ...; `relativeBlocks?`: ... \| ...; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ... \| ...; `relativeBlocks?`: ... \| ...; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<`string`, `never`\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.routing

> **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### check\_approval

> **check\_approval**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2323](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2323)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount

> **amount**: `string`

###### requestBody.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.includeGasInfo?

> `optional` **includeGasInfo**: `boolean`

###### requestBody.content.application/json.token

> **token**: `string`

###### requestBody.content.application/json.tokenOut?

> `optional` **tokenOut**: `string`

###### requestBody.content.application/json.tokenOutChainId?

> `optional` **tokenOutChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### requestBody.content.application/json.walletAddress

> **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.approval

> **approval**: `object`

###### responses.200.content.application/json.approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.approval.from

> **from**: `string`

###### responses.200.content.application/json.approval.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.approval.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.approval.to

> **to**: `string`

###### responses.200.content.application/json.approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.cancel

> **cancel**: `object`

###### responses.200.content.application/json.cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.cancel.from

> **from**: `string`

###### responses.200.content.application/json.cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.cancel.to

> **to**: `string`

###### responses.200.content.application/json.cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.cancelGasFee?

> `optional` **cancelGasFee**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### check\_approval\_lp

> **check\_approval\_lp**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2563](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2563)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount0?

> `optional` **amount0**: `string`

###### Description

The amount of token0 to be added or removed from the position. To estimate the amount of token0 needed when adding a new position, use the /lp/create endpoint to simulate the position creation.

###### requestBody.content.application/json.amount1?

> `optional` **amount1**: `string`

###### Description

The amount of token1 to be added or removed from the position. To estimate the amount of token1 needed when adding a new position, use the /lp/create endpoint to simulate the position creation.

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.generatePermitAsTransaction?

> `optional` **generatePermitAsTransaction**: `boolean`

###### requestBody.content.application/json.positionAmount?

> `optional` **positionAmount**: `string`

###### Description

Only required when getting approval for removing a V2 position. Populated with the amount of the V2 position to be removed (eg. amount0*amount1).

###### requestBody.content.application/json.positionToken?

> `optional` **positionToken**: `string`

###### Description

The address of the NFT representing the position. Required when requesting approval for removing liquidity from a V2 position (provide address of V2 NFT). Required when requesting approval for migrating a V3 position to a V4 position (provide address of V3 NFT).

###### requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.token0?

> `optional` **token0**: `string`

###### requestBody.content.application/json.token1?

> `optional` **token1**: `string`

###### requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.gasFeePositionTokenApproval?

> `optional` **gasFeePositionTokenApproval**: `string`

###### responses.200.content.application/json.gasFeePositionTokenPermit?

> `optional` **gasFeePositionTokenPermit**: `string`

###### responses.200.content.application/json.gasFeeToken0Approval?

> `optional` **gasFeeToken0Approval**: `string`

###### responses.200.content.application/json.gasFeeToken0Cancel?

> `optional` **gasFeeToken0Cancel**: `string`

###### responses.200.content.application/json.gasFeeToken0Permit?

> `optional` **gasFeeToken0Permit**: `string`

###### responses.200.content.application/json.gasFeeToken1Approval?

> `optional` **gasFeeToken1Approval**: `string`

###### responses.200.content.application/json.gasFeeToken1Cancel?

> `optional` **gasFeeToken1Cancel**: `string`

###### responses.200.content.application/json.gasFeeToken1Permit?

> `optional` **gasFeeToken1Permit**: `string`

###### responses.200.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### responses.200.content.application/json.positionTokenApproval?

> `optional` **positionTokenApproval**: `object`

###### responses.200.content.application/json.positionTokenApproval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.positionTokenApproval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.positionTokenApproval.from

> **from**: `string`

###### responses.200.content.application/json.positionTokenApproval.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.positionTokenApproval.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.positionTokenApproval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.positionTokenApproval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.positionTokenApproval.to

> **to**: `string`

###### responses.200.content.application/json.positionTokenApproval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.positionTokenPermitTransaction?

> `optional` **positionTokenPermitTransaction**: `object`

###### responses.200.content.application/json.positionTokenPermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.positionTokenPermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.positionTokenPermitTransaction.from

> **from**: `string`

###### responses.200.content.application/json.positionTokenPermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.positionTokenPermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.positionTokenPermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.positionTokenPermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.positionTokenPermitTransaction.to

> **to**: `string`

###### responses.200.content.application/json.positionTokenPermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.content.application/json.token0Approval?

> `optional` **token0Approval**: `object`

###### responses.200.content.application/json.token0Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.token0Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.token0Approval.from

> **from**: `string`

###### responses.200.content.application/json.token0Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.token0Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.token0Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.token0Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.token0Approval.to

> **to**: `string`

###### responses.200.content.application/json.token0Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.token0Cancel?

> `optional` **token0Cancel**: `object`

###### responses.200.content.application/json.token0Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.token0Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.token0Cancel.from

> **from**: `string`

###### responses.200.content.application/json.token0Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.token0Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.token0Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.token0Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.token0Cancel.to

> **to**: `string`

###### responses.200.content.application/json.token0Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.token0PermitTransaction?

> `optional` **token0PermitTransaction**: `object`

###### responses.200.content.application/json.token0PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.token0PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.token0PermitTransaction.from

> **from**: `string`

###### responses.200.content.application/json.token0PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.token0PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.token0PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.token0PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.token0PermitTransaction.to

> **to**: `string`

###### responses.200.content.application/json.token0PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.token1Approval?

> `optional` **token1Approval**: `object`

###### responses.200.content.application/json.token1Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.token1Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.token1Approval.from

> **from**: `string`

###### responses.200.content.application/json.token1Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.token1Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.token1Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.token1Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.token1Approval.to

> **to**: `string`

###### responses.200.content.application/json.token1Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.token1Cancel?

> `optional` **token1Cancel**: `object`

###### responses.200.content.application/json.token1Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.token1Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.token1Cancel.from

> **from**: `string`

###### responses.200.content.application/json.token1Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.token1Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.token1Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.token1Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.token1Cancel.to

> **to**: `string`

###### responses.200.content.application/json.token1Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.token1PermitTransaction?

> `optional` **token1PermitTransaction**: `object`

###### responses.200.content.application/json.token1PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.token1PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.token1PermitTransaction.from

> **from**: `string`

###### responses.200.content.application/json.token1PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.token1PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.token1PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.token1PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.token1PermitTransaction.to

> **to**: `string`

###### responses.200.content.application/json.token1PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### claim\_lp\_fees

> **claim\_lp\_fees**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2651](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2651)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.collectAsWETH?

> `optional` **collectAsWETH**: `boolean`

###### requestBody.content.application/json.expectedTokenOwed0RawAmount?

> `optional` **expectedTokenOwed0RawAmount**: `string`

###### requestBody.content.application/json.expectedTokenOwed1RawAmount?

> `optional` **expectedTokenOwed1RawAmount**: `string`

###### requestBody.content.application/json.position?

> `optional` **position**: `object`

###### requestBody.content.application/json.position.pool

> **pool**: `object`

###### requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.tokenId?

> `optional` **tokenId**: `number`

###### requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.claim?

> `optional` **claim**: `object`

###### responses.200.content.application/json.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.claim.from

> **from**: `string`

###### responses.200.content.application/json.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.claim.to

> **to**: `string`

###### responses.200.content.application/json.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### claim\_lp\_rewards

> **claim\_lp\_rewards**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2695](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2695)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.distributor?

> `optional` **distributor**: `"MERKL"`

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.tokens?

> `optional` **tokens**: `string`[]

###### Description

The token addresses to claim rewards for.

###### requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.claim?

> `optional` **claim**: `object`

###### responses.200.content.application/json.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.claim.from

> **from**: `string`

###### responses.200.content.application/json.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.claim.to

> **to**: `string`

###### responses.200.content.application/json.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### create\_lp\_position

> **create\_lp\_position**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2585](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2585)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount0?

> `optional` **amount0**: `string`

###### requestBody.content.application/json.amount1?

> `optional` **amount1**: `string`

###### requestBody.content.application/json.batchPermitData?

> `optional` **batchPermitData**: `object`

###### requestBody.content.application/json.batchPermitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.batchPermitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.batchPermitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.defaultDependentAmount?

> `optional` **defaultDependentAmount**: `string`

###### requestBody.content.application/json.independentAmount?

> `optional` **independentAmount**: `string`

###### requestBody.content.application/json.independentToken?

> `optional` **independentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### requestBody.content.application/json.initialDependentAmount?

> `optional` **initialDependentAmount**: `string`

###### requestBody.content.application/json.initialPrice?

> `optional` **initialPrice**: `string`

###### requestBody.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### requestBody.content.application/json.position?

> `optional` **position**: `object`

###### requestBody.content.application/json.position.pool

> **pool**: `object`

###### requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### requestBody.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.create?

> `optional` **create**: `object`

###### responses.200.content.application/json.create.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.create.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.create.from

> **from**: `string`

###### responses.200.content.application/json.create.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.create.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.create.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.create.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.create.to

> **to**: `string`

###### responses.200.content.application/json.create.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### responses.200.content.application/json.dependentAmount?

> `optional` **dependentAmount**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### create\_plan

> **create\_plan**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2835](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2835)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.quote

> **quote**: `object`

###### requestBody.content.application/json.quote.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### requestBody.content.application/json.quote.gasEstimates?

> `optional` **gasEstimates**: `Record`\<`string`, `never`\>[]

###### Description

Gas estimates for each step in the chained flow.

###### requestBody.content.application/json.quote.gasFee?

> `optional` **gasFee**: `string`

###### requestBody.content.application/json.quote.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### requestBody.content.application/json.quote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### requestBody.content.application/json.quote.gasPrice?

> `optional` **gasPrice**: `string`

###### requestBody.content.application/json.quote.gasStrategies

> **gasStrategies**: `object`[]

###### Description

Gas strategies for the chained flow.

###### requestBody.content.application/json.quote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### requestBody.content.application/json.quote.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### requestBody.content.application/json.quote.input

> **input**: `object`

###### requestBody.content.application/json.quote.input.amount?

> `optional` **amount**: `string`

###### requestBody.content.application/json.quote.input.token?

> `optional` **token**: `string`

###### requestBody.content.application/json.quote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### requestBody.content.application/json.quote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### requestBody.content.application/json.quote.output

> **output**: `object`

###### requestBody.content.application/json.quote.output.amount?

> `optional` **amount**: `string`

###### requestBody.content.application/json.quote.output.recipient?

> `optional` **recipient**: `string`

###### requestBody.content.application/json.quote.output.token?

> `optional` **token**: `string`

###### requestBody.content.application/json.quote.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### requestBody.content.application/json.quote.quoteId

> **quoteId**: `string`

###### requestBody.content.application/json.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### requestBody.content.application/json.quote.steps?

> `optional` **steps**: `object`[]

###### Description

Truncated plan steps for the chained transaction flow.

###### requestBody.content.application/json.quote.swapper

> **swapper**: `string`

###### requestBody.content.application/json.quote.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire chained flow.

###### requestBody.content.application/json.quote.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.quote.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.quote.tradeType

> **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### requestBody.content.application/json.routing

> **routing**: `"CHAINED"`

###### Description

The routing type for the plan. Currently only CHAINED is supported for multi-step execution plans.

###### requestBody.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### requestBody.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### requestBody.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### requestBody.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ...

###### Description

Name of the wallet.

###### requestBody.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ...

###### Description

Reverse domain name identifier for the wallet.

###### requestBody.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ...

###### Description

Unique identifier for the wallet.

###### requestBody.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### responses.200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### responses.200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### responses.200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### responses.200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### responses.200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### responses.200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### responses.200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### responses.200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### responses.200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### responses.200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### responses.200.content.application/json.quoteId

> **quoteId**: `string`

###### responses.200.content.application/json.recipient

> **recipient**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### responses.200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### responses.200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### responses.200.content.application/json.swapper

> **swapper**: `string`

###### responses.200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### responses.200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### responses.200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ...

###### Description

Name of the wallet.

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ...

###### Description

Reverse domain name identifier for the wallet.

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ...

###### Description

Unique identifier for the wallet.

###### responses.200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### create\_send

> **create\_send**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2498](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2498)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount

> **amount**: `string`

###### requestBody.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.recipient

> **recipient**: `string`

###### requestBody.content.application/json.sender

> **sender**: `string`

###### requestBody.content.application/json.token

> **token**: `string`

###### requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.send

> **send**: `object`

###### responses.200.content.application/json.send.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.send.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.send.from

> **from**: `string`

###### responses.200.content.application/json.send.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.send.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.send.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.send.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.send.to

> **to**: `string`

###### responses.200.content.application/json.send.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### create\_swap\_5792\_transaction

> **create\_swap\_5792\_transaction**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2783](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2783)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `object`

###### parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.calls

> **calls**: `object`[]

###### responses.200.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.from

> **from**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### create\_swap\_7702\_transaction

> **create\_swap\_7702\_transaction**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2808](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2808)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `object`

###### parameters.header.x-erc20eth-enabled?

> `optional` **x-erc20eth-enabled**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.includeGasInfo

> **includeGasInfo**: `boolean`

###### Default

```ts
false
```

###### requestBody.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.smartContractDelegationAddress?

> `optional` **smartContractDelegationAddress**: `string`

###### requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.swap

> **swap**: `object`

###### responses.200.content.application/json.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.swap.from

> **from**: `string`

###### responses.200.content.application/json.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.swap.to

> **to**: `string`

###### responses.200.content.application/json.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### create\_swap\_transaction

> **create\_swap\_transaction**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2431](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2431)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `object`

###### parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.includeGasInfo

> **includeGasInfo**: `boolean`

###### Deprecated

###### Description

Use `refreshGasPrice` instead.

###### Default

```ts
false
```

###### requestBody.content.application/json.permitData?

> `optional` **permitData**: `object`

###### requestBody.content.application/json.permitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.permitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.permitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: (... \| ... \| ...)[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (`"SIMULATION_ERROR"` \| `"UNSUPPORTED_SIMULATION"` \| `"SIMULATION_UNAVAILABLE"` \| `"SLIPPAGE_TOO_LOW"` \| `"TRANSFER_FROM_FAILED"`)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### requestBody.content.application/json.refreshGasPrice

> **refreshGasPrice**: `boolean`

###### Description

If true, the gas price will be re-fetched from the network.

###### Default

```ts
false
```

###### requestBody.content.application/json.safetyMode?

> `optional` **safetyMode**: `"SAFE"`

###### requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### requestBody.content.application/json.simulateTransaction

> **simulateTransaction**: `boolean`

###### Description

If true, the transaction will be simulated. If the simulation results on an onchain error, endpoint will return an error.

###### Default

```ts
false
```

###### requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.swap

> **swap**: `object`

###### responses.200.content.application/json.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.swap.from

> **from**: `string`

###### responses.200.content.application/json.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.swap.to

> **to**: `string`

###### responses.200.content.application/json.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### decrease\_lp\_position

> **decrease\_lp\_position**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2629](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2629)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.collectAsWETH?

> `optional` **collectAsWETH**: `boolean`

###### requestBody.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.expectedTokenOwed0RawAmount?

> `optional` **expectedTokenOwed0RawAmount**: `string`

###### requestBody.content.application/json.expectedTokenOwed1RawAmount?

> `optional` **expectedTokenOwed1RawAmount**: `string`

###### requestBody.content.application/json.liquidity0?

> `optional` **liquidity0**: `string`

###### requestBody.content.application/json.liquidity1?

> `optional` **liquidity1**: `string`

###### requestBody.content.application/json.liquidityPercentageToDecrease?

> `optional` **liquidityPercentageToDecrease**: `number`

###### requestBody.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### requestBody.content.application/json.position?

> `optional` **position**: `object`

###### requestBody.content.application/json.position.pool

> **pool**: `object`

###### requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### requestBody.content.application/json.positionLiquidity?

> `optional` **positionLiquidity**: `string`

###### requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### requestBody.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### requestBody.content.application/json.tokenId?

> `optional` **tokenId**: `number`

###### requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### responses.200.content.application/json.decrease?

> `optional` **decrease**: `object`

###### responses.200.content.application/json.decrease.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.decrease.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.decrease.from

> **from**: `string`

###### responses.200.content.application/json.decrease.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.decrease.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.decrease.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.decrease.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.decrease.to

> **to**: `string`

###### responses.200.content.application/json.decrease.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### get\_limit\_order\_quote

> **get\_limit\_order\_quote**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2541](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2541)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount

> **amount**: `string`

###### requestBody.content.application/json.limitPrice?

> `optional` **limitPrice**: `string`

###### requestBody.content.application/json.orderDeadline?

> `optional` **orderDeadline**: `number`

###### requestBody.content.application/json.swapper

> **swapper**: `string`

###### requestBody.content.application/json.tokenIn

> **tokenIn**: `string`

###### requestBody.content.application/json.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.tokenOut

> **tokenOut**: `string`

###### requestBody.content.application/json.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### responses.200.content.application/json.quote

> **quote**: `object`

###### responses.200.content.application/json.quote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### responses.200.content.application/json.quote.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### responses.200.content.application/json.quote.encodedOrder

> **encodedOrder**: `string`

###### responses.200.content.application/json.quote.orderId

> **orderId**: `string`

###### responses.200.content.application/json.quote.orderInfo

> **orderInfo**: `object`

###### responses.200.content.application/json.quote.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### responses.200.content.application/json.quote.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### responses.200.content.application/json.quote.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.quote.orderInfo.deadline

> **deadline**: `number`

###### responses.200.content.application/json.quote.orderInfo.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### responses.200.content.application/json.quote.orderInfo.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### responses.200.content.application/json.quote.orderInfo.exclusiveFiller

> **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### responses.200.content.application/json.quote.orderInfo.exclusivityOverrideBps

> **exclusivityOverrideBps**: `string`

###### Description

The portion of the order which is eligible to be filled by the `exclusiveFiller`, specified in basis points.

###### responses.200.content.application/json.quote.orderInfo.input

> **input**: `object`

###### responses.200.content.application/json.quote.orderInfo.input.endAmount

> **endAmount**: `string`

###### responses.200.content.application/json.quote.orderInfo.input.startAmount

> **startAmount**: `string`

###### responses.200.content.application/json.quote.orderInfo.input.token?

> `optional` **token**: `string`

###### responses.200.content.application/json.quote.orderInfo.nonce

> **nonce**: `string`

###### responses.200.content.application/json.quote.orderInfo.outputs

> **outputs**: `object`[]

###### responses.200.content.application/json.quote.orderInfo.reactor

> **reactor**: `string`

###### responses.200.content.application/json.quote.orderInfo.swapper

> **swapper**: `string`

###### responses.200.content.application/json.quote.portionAmount?

> `optional` **portionAmount**: `string`

###### responses.200.content.application/json.quote.portionBips?

> `optional` **portionBips**: `number`

###### responses.200.content.application/json.quote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### responses.200.content.application/json.quote.quoteId?

> `optional` **quoteId**: `string`

###### responses.200.content.application/json.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.routing

> **routing**: `"LIMIT_ORDER"`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### get\_order

> **get\_order**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2396](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2396)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `object`

###### parameters.query.cursor?

> `optional` **cursor**: `string`

###### parameters.query.filler?

> `optional` **filler**: `string`

###### Description

Filter by filler address.

###### parameters.query.limit?

> `optional` **limit**: `number`

###### parameters.query.orderId?

> `optional` **orderId**: `string`

###### parameters.query.orderIds?

> `optional` **orderIds**: `string`

###### Description

A list of comma separated orderIds.

###### parameters.query.orderStatus?

> `optional` **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### Description

Filter by order status.

###### parameters.query.orderType?

> `optional` **orderType**: `"Dutch"` \| `"Dutch_V2"` \| `"Dutch_V1_V2"` \| `"Dutch_V3"` \| `"Limit"` \| `"Priority"`

###### Description

The default orderType is Dutch_V1_V2 and will grab both Dutch and Dutch_V2 orders.

###### parameters.query.sort?

> `optional` **sort**: `string`

###### Description

Sort query. For example: `sort=gt(UNIX_TIMESTAMP)`, `sort=between(1675872827, 1675872930)`, or `lt(1675872930)`.

###### parameters.query.sortKey?

> `optional` **sortKey**: `"createdAt"`

###### Description

Order the query results by the sort key.

###### parameters.query.swapper?

> `optional` **swapper**: `string`

###### Description

Filter by swapper address.

###### requestBody?

> `optional` **requestBody**: `undefined`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.cursor?

> `optional` **cursor**: `string`

###### responses.200.content.application/json.orders

> **orders**: `object`[]

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### get\_plan

> **get\_plan**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2857](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2857)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path

> **path**: `object`

###### parameters.path.planId

> **planId**: `string`

###### Description

The unique identifier of the plan to retrieve.

###### parameters.query?

> `optional` **query**: `object`

###### parameters.query.forceRefresh?

> `optional` **forceRefresh**: `boolean`

###### Description

Whether to force refresh the plan status. Defaults to false. Completed plans cannot be refreshed.

###### requestBody?

> `optional` **requestBody**: `undefined`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### responses.200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### responses.200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### responses.200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### responses.200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### responses.200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### responses.200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### responses.200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### responses.200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### responses.200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### responses.200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### responses.200.content.application/json.quoteId

> **quoteId**: `string`

###### responses.200.content.application/json.recipient

> **recipient**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### responses.200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### responses.200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### responses.200.content.application/json.swapper

> **swapper**: `string`

###### responses.200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### responses.200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### responses.200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ...

###### Description

Name of the wallet.

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ...

###### Description

Reverse domain name identifier for the wallet.

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ...

###### Description

Unique identifier for the wallet.

###### responses.200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.422

> **422**: `object`

###### responses.422.content

> **content**: `object`

###### responses.422.content.application/json

> **application/json**: `object`

###### responses.422.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.422.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnprocessableEntity
```

###### responses.422.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### get\_swappable\_tokens

> **get\_swappable\_tokens**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2520](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2520)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `object`

###### parameters.query.tokenIn?

> `optional` **tokenIn**: `string`

###### parameters.query.tokenInChainId?

> `optional` **tokenInChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody?

> `optional` **requestBody**: `undefined`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.tokens

> **tokens**: `object`[]

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### get\_swaps

> **get\_swaps**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2456](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2456)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query

> **query**: `object`

###### parameters.query.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### parameters.query.txHashes

> **txHashes**: `string`[]

###### Description

The transaction hashes.

###### requestBody?

> `optional` **requestBody**: `undefined`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.swaps?

> `optional` **swaps**: `object`[]

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### increase\_lp\_position

> **increase\_lp\_position**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2607](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2607)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount0?

> `optional` **amount0**: `string`

###### requestBody.content.application/json.amount1?

> `optional` **amount1**: `string`

###### requestBody.content.application/json.batchPermitData?

> `optional` **batchPermitData**: `object`

###### requestBody.content.application/json.batchPermitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.batchPermitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.batchPermitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.defaultDependentAmount?

> `optional` **defaultDependentAmount**: `string`

###### requestBody.content.application/json.independentAmount?

> `optional` **independentAmount**: `string`

###### requestBody.content.application/json.independentToken?

> `optional` **independentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### requestBody.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### requestBody.content.application/json.position?

> `optional` **position**: `object`

###### requestBody.content.application/json.position.pool

> **pool**: `object`

###### requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### requestBody.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### requestBody.content.application/json.tokenId?

> `optional` **tokenId**: `number`

###### requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### responses.200.content.application/json.dependentAmount?

> `optional` **dependentAmount**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.increase?

> `optional` **increase**: `object`

###### responses.200.content.application/json.increase.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.increase.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.increase.from

> **from**: `string`

###### responses.200.content.application/json.increase.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.increase.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.increase.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.increase.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.increase.to

> **to**: `string`

###### responses.200.content.application/json.increase.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### indicative\_quote

> **indicative\_quote**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2477](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2477)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount

> **amount**: `string`

###### requestBody.content.application/json.tokenIn

> **tokenIn**: `string`

###### requestBody.content.application/json.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.tokenOut

> **tokenOut**: `string`

###### requestBody.content.application/json.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.input

> **input**: `object`

###### responses.200.content.application/json.input.amount?

> `optional` **amount**: `string`

###### responses.200.content.application/json.input.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### responses.200.content.application/json.input.token?

> `optional` **token**: `string`

###### responses.200.content.application/json.output

> **output**: `object`

###### responses.200.content.application/json.output.amount?

> `optional` **amount**: `string`

###### responses.200.content.application/json.output.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### responses.200.content.application/json.output.token?

> `optional` **token**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### migrate\_lp\_position

> **migrate\_lp\_position**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2673](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2673)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.amount0

> **amount0**: `string`

###### requestBody.content.application/json.amount1

> **amount1**: `string`

###### requestBody.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### requestBody.content.application/json.expectedTokenOwed0RawAmount

> **expectedTokenOwed0RawAmount**: `string`

###### requestBody.content.application/json.expectedTokenOwed1RawAmount

> **expectedTokenOwed1RawAmount**: `string`

###### requestBody.content.application/json.initialPrice?

> `optional` **initialPrice**: `string`

###### requestBody.content.application/json.inputCurrentTick

> **inputCurrentTick**: `number`

###### requestBody.content.application/json.inputPoolLiquidity

> **inputPoolLiquidity**: `string`

###### requestBody.content.application/json.inputPosition

> **inputPosition**: `object`

###### requestBody.content.application/json.inputPosition.pool

> **pool**: `object`

###### requestBody.content.application/json.inputPosition.pool.fee?

> `optional` **fee**: `number`

###### requestBody.content.application/json.inputPosition.pool.hooks?

> `optional` **hooks**: `string`

###### requestBody.content.application/json.inputPosition.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.inputPosition.pool.token0

> **token0**: `string`

###### requestBody.content.application/json.inputPosition.pool.token1

> **token1**: `string`

###### requestBody.content.application/json.inputPosition.tickLower?

> `optional` **tickLower**: `number`

###### requestBody.content.application/json.inputPosition.tickUpper?

> `optional` **tickUpper**: `number`

###### requestBody.content.application/json.inputPositionLiquidity

> **inputPositionLiquidity**: `string`

###### requestBody.content.application/json.inputProtocol

> **inputProtocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.inputSqrtRatioX96

> **inputSqrtRatioX96**: `string`

###### requestBody.content.application/json.outputCurrentTick?

> `optional` **outputCurrentTick**: `number`

###### requestBody.content.application/json.outputPoolLiquidity?

> `optional` **outputPoolLiquidity**: `string`

###### requestBody.content.application/json.outputPosition

> **outputPosition**: `object`

###### requestBody.content.application/json.outputPosition.pool

> **pool**: `object`

###### requestBody.content.application/json.outputPosition.pool.fee?

> `optional` **fee**: `number`

###### requestBody.content.application/json.outputPosition.pool.hooks?

> `optional` **hooks**: `string`

###### requestBody.content.application/json.outputPosition.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.outputPosition.pool.token0

> **token0**: `string`

###### requestBody.content.application/json.outputPosition.pool.token1

> **token1**: `string`

###### requestBody.content.application/json.outputPosition.tickLower?

> `optional` **tickLower**: `number`

###### requestBody.content.application/json.outputPosition.tickUpper?

> `optional` **tickUpper**: `number`

###### requestBody.content.application/json.outputProtocol

> **outputProtocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### requestBody.content.application/json.outputSqrtRatioX96?

> `optional` **outputSqrtRatioX96**: `string`

###### requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### requestBody.content.application/json.signatureDeadline?

> `optional` **signatureDeadline**: `number`

###### requestBody.content.application/json.simulateTransaction

> **simulateTransaction**: `boolean`

###### Default

```ts
false
```

###### requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### requestBody.content.application/json.tokenId

> **tokenId**: `number`

###### requestBody.content.application/json.walletAddress

> **walletAddress**: `string`

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.migrate?

> `optional` **migrate**: `object`

###### responses.200.content.application/json.migrate.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.migrate.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.migrate.from

> **from**: `string`

###### responses.200.content.application/json.migrate.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.migrate.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.migrate.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.migrate.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.migrate.to

> **to**: `string`

###### responses.200.content.application/json.migrate.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### pool\_info

> **pool\_info**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2717](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2717)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### requestBody.content.application/json.currentPage?

> `optional` **currentPage**: `number`

###### requestBody.content.application/json.pageSize?

> `optional` **pageSize**: `number`

###### requestBody.content.application/json.poolParams?

> `optional` **poolParams**: `object`

###### requestBody.content.application/json.poolParams.fee?

> `optional` **fee**: `number`

###### Description

The fee of the pool, if the pool has a fee value.

###### requestBody.content.application/json.poolParams.hookAddress?

> `optional` **hookAddress**: `string`

###### Description

The address of the hook for the pool, if any.

###### requestBody.content.application/json.poolParams.tickSpacing?

> `optional` **tickSpacing**: `number`

###### requestBody.content.application/json.poolParams.token0?

> `optional` **token0**: `string`

###### requestBody.content.application/json.poolParams.token1?

> `optional` **token1**: `string`

###### requestBody.content.application/json.poolReferences?

> `optional` **poolReferences**: `object`[]

###### Description

Array of pool reference identifiers to query. Each reference should include the protocol, chainId, and either the pool address (V3), pool id (V4), or pair address (V2).

###### requestBody.content.application/json.protocol

> **protocol**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.currentPage?

> `optional` **currentPage**: `number`

###### responses.200.content.application/json.pageSize?

> `optional` **pageSize**: `number`

###### responses.200.content.application/json.pools?

> `optional` **pools**: `object`[]

###### Description

Array of pool information objects.

###### responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### post\_order

> **post\_order**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2372](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2372)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `object`

###### parameters.header.x-erc20eth-enabled?

> `optional` **x-erc20eth-enabled**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ... \| ...; `relativeBlocks?`: ... \| ...; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

###### requestBody.content.application/json.routing?

> `optional` **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### requestBody.content.application/json.signature

> **signature**: `string`

###### Description

The signed permit.

###### responses

> **responses**: `object`

###### responses.201

> **201**: `object`

###### responses.201.content

> **content**: `object`

###### responses.201.content.application/json

> **application/json**: `object`

###### responses.201.content.application/json.orderId

> **orderId**: `string`

###### responses.201.content.application/json.orderStatus

> **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### responses.201.content.application/json.requestId

> **requestId**: `string`

###### responses.201.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### update\_plan

> **update\_plan**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2882](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2882)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path

> **path**: `object`

###### parameters.path.planId

> **planId**: `string`

###### Description

The unique identifier of the plan to update.

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.steps

> **steps**: `object`[]

###### Description

Array of steps with proofs to attach. Only steps being updated need to be included.

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### responses.200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### responses.200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### responses.200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### responses.200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### responses.200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### responses.200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### responses.200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### responses.200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### responses.200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### responses.200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### responses.200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### responses.200.content.application/json.quoteId

> **quoteId**: `string`

###### responses.200.content.application/json.recipient

> **recipient**: `string`

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### responses.200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### responses.200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### responses.200.content.application/json.swapper

> **swapper**: `string`

###### responses.200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### responses.200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### responses.200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: `object`

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.name?

> `optional` **name**: ...

###### Description

Name of the wallet.

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.rdns?

> `optional` **rdns**: ...

###### Description

Reverse domain name identifier for the wallet.

###### responses.200.content.application/json.walletExecutionContext.properties.walletInfo.uuid?

> `optional` **uuid**: ...

###### Description

Unique identifier for the wallet.

###### responses.200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.422

> **422**: `object`

###### responses.422.content

> **content**: `object`

###### responses.422.content.application/json

> **application/json**: `object`

###### responses.422.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.422.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnprocessableEntity
```

###### responses.422.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### wallet\_check\_delegation

> **wallet\_check\_delegation**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2761](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2761)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.chainIds

> **chainIds**: (`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`)[]

###### Description

Array of chain IDs to check delegation status for.

###### requestBody.content.application/json.walletAddresses?

> `optional` **walletAddresses**: `string`[]

###### Description

Array of wallet addresses to check delegation status for.

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.delegationDetails

> **delegationDetails**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of wallet addresses to chain IDs to delegation details.

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

##### wallet\_encode\_7702

> **wallet\_encode\_7702**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2739](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2739)

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### requestBody?

> `optional` **requestBody**: `object`

###### requestBody.content

> **content**: `object`

###### requestBody.content.application/json

> **application/json**: `object`

###### requestBody.content.application/json.calls

> **calls**: `object`[]

###### Description

Array of transaction requests to be encoded. All transactions must have the same chainId.

###### requestBody.content.application/json.smartContractDelegationAddress

> **smartContractDelegationAddress**: `string`

###### Description

The address of the smart contract delegation implementation to use.

###### requestBody.content.application/json.walletAddress

> **walletAddress**: `string`

###### Description

The address of the wallet for which the transactions will be encoded.

###### responses

> **responses**: `object`

###### responses.200

> **200**: `object`

###### responses.200.content

> **content**: `object`

###### responses.200.content.application/json

> **application/json**: `object`

###### responses.200.content.application/json.encoded

> **encoded**: `object`

###### responses.200.content.application/json.encoded.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### responses.200.content.application/json.encoded.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### responses.200.content.application/json.encoded.from

> **from**: `string`

###### responses.200.content.application/json.encoded.gasLimit?

> `optional` **gasLimit**: `string`

###### responses.200.content.application/json.encoded.gasPrice?

> `optional` **gasPrice**: `string`

###### responses.200.content.application/json.encoded.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### responses.200.content.application/json.encoded.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### responses.200.content.application/json.encoded.to

> **to**: `string`

###### responses.200.content.application/json.encoded.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### responses.200.content.application/json.requestId

> **requestId**: `string`

###### responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.400

> **400**: `object`

###### responses.400.content

> **content**: `object`

###### responses.400.content.application/json

> **application/json**: `object`

###### responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.401

> **401**: `object`

###### responses.401.content

> **content**: `object`

###### responses.401.content.application/json

> **application/json**: `object`

###### responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.404

> **404**: `object`

###### responses.404.content

> **content**: `object`

###### responses.404.content.application/json

> **application/json**: `object`

###### responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.429

> **429**: `object`

###### responses.429.content

> **content**: `object`

###### responses.429.content.application/json

> **application/json**: `object`

###### responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.500

> **500**: `object`

###### responses.500.content

> **content**: `object`

###### responses.500.content.application/json

> **application/json**: `object`

###### responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### responses.504

> **504**: `object`

###### responses.504.content

> **content**: `object`

###### responses.504.content.application/json

> **application/json**: `object`

###### responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

***

### paths

Defined in: [src/lib/uniswap/generated/tradeApi.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L6)

This file was auto-generated by openapi-typescript.
Do not make direct changes to the file.

#### Properties

##### /check\_approval

> **/check\_approval**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L7)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Check if token approval is required

###### Description

Allows the requestor to check if the `walletAddress` has the required approval to transact the `token` up to the `amount` specified. If the `walletAddress` does not have the required approval, the response will include a transaction to approve the token spend. If the `walletAddress` has the required approval, the response will return the approval with a `null` value. If the parameter `includeGasInfo` is set to `true` and an approval is needed, then the response will include both the transaction and the gas fee for the approval transaction.

    Certain tokens may require that approval be reset before approving a new spend amount. If this condition is detected for the `walletAddress` and `token`, the response will include the necessary approval cancellation in the `cancel` paragraph. When `cancel` is not applicable, the paragraph will have a `null` value.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount

> **amount**: `string`

###### post.requestBody.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.includeGasInfo?

> `optional` **includeGasInfo**: `boolean`

###### post.requestBody.content.application/json.token

> **token**: `string`

###### post.requestBody.content.application/json.tokenOut?

> `optional` **tokenOut**: `string`

###### post.requestBody.content.application/json.tokenOutChainId?

> `optional` **tokenOutChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### post.requestBody.content.application/json.walletAddress

> **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.approval

> **approval**: `object`

###### post.responses.200.content.application/json.approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.approval.from

> **from**: `string`

###### post.responses.200.content.application/json.approval.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.approval.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.approval.to

> **to**: `string`

###### post.responses.200.content.application/json.approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.cancel

> **cancel**: `object`

###### post.responses.200.content.application/json.cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.cancel.from

> **from**: `string`

###### post.responses.200.content.application/json.cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.cancel.to

> **to**: `string`

###### post.responses.200.content.application/json.cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.cancelGasFee?

> `optional` **cancelGasFee**: `string`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /indicative\_quote

> **/indicative\_quote**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:141](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L141)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### ~~post~~

> **post**: `object`

Get an indicative quote

###### Deprecated

###### Description

Deprecated. Instead, use the /quote endpoint and specify the `routingPreference` parameter.  with value of `FASTEST`. See the Token Trading Workflow page for more details.

    This endpoint receives a fast indicative quote according to the provided details. The quote will not include any gas or fee information.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount

> **amount**: `string`

###### post.requestBody.content.application/json.tokenIn

> **tokenIn**: `string`

###### post.requestBody.content.application/json.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.tokenOut

> **tokenOut**: `string`

###### post.requestBody.content.application/json.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.input

> **input**: `object`

###### post.responses.200.content.application/json.input.amount?

> `optional` **amount**: `string`

###### post.responses.200.content.application/json.input.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.responses.200.content.application/json.input.token?

> `optional` **token**: `string`

###### post.responses.200.content.application/json.output

> **output**: `object`

###### post.responses.200.content.application/json.output.amount?

> `optional` **amount**: `string`

###### post.responses.200.content.application/json.output.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.responses.200.content.application/json.output.token?

> `optional` **token**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /limit\_order\_quote

> **/limit\_order\_quote**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:204](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L204)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Get a limit order quote

###### Description

Get a quote for a limit order according to the provided configuration.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount

> **amount**: `string`

###### post.requestBody.content.application/json.limitPrice?

> `optional` **limitPrice**: `string`

###### post.requestBody.content.application/json.orderDeadline?

> `optional` **orderDeadline**: `number`

###### post.requestBody.content.application/json.swapper

> **swapper**: `string`

###### post.requestBody.content.application/json.tokenIn

> **tokenIn**: `string`

###### post.requestBody.content.application/json.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.tokenOut

> **tokenOut**: `string`

###### post.requestBody.content.application/json.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### post.responses.200.content.application/json.quote

> **quote**: `object`

###### post.responses.200.content.application/json.quote.aggregatedOutputs?

> `optional` **aggregatedOutputs**: `object`[]

###### post.responses.200.content.application/json.quote.classicGasUseEstimateUSD?

> `optional` **classicGasUseEstimateUSD**: `string`

###### post.responses.200.content.application/json.quote.encodedOrder

> **encodedOrder**: `string`

###### post.responses.200.content.application/json.quote.orderId

> **orderId**: `string`

###### post.responses.200.content.application/json.quote.orderInfo

> **orderInfo**: `object`

###### post.responses.200.content.application/json.quote.orderInfo.additionalValidationContract?

> `optional` **additionalValidationContract**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.additionalValidationData?

> `optional` **additionalValidationData**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.quote.orderInfo.deadline

> **deadline**: `number`

###### post.responses.200.content.application/json.quote.orderInfo.decayEndTime?

> `optional` **decayEndTime**: `number`

###### Description

The unix timestamp at which the order will no longer be eligible to be filled by alternate fillers.

###### post.responses.200.content.application/json.quote.orderInfo.decayStartTime?

> `optional` **decayStartTime**: `number`

###### Description

The unix timestamp at which the order will be eligible to be filled by alternate fillers at a lower price. Noted that the fill amount will not be lower than the output `endAmount`.

###### post.responses.200.content.application/json.quote.orderInfo.exclusiveFiller

> **exclusiveFiller**: `string`

###### Description

The address of the filler who has priority to fill the order by the `decayStartTime`.

###### post.responses.200.content.application/json.quote.orderInfo.exclusivityOverrideBps

> **exclusivityOverrideBps**: `string`

###### Description

The portion of the order which is eligible to be filled by the `exclusiveFiller`, specified in basis points.

###### post.responses.200.content.application/json.quote.orderInfo.input

> **input**: `object`

###### post.responses.200.content.application/json.quote.orderInfo.input.endAmount

> **endAmount**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.input.startAmount

> **startAmount**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.input.token?

> `optional` **token**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.nonce

> **nonce**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.outputs

> **outputs**: `object`[]

###### post.responses.200.content.application/json.quote.orderInfo.reactor

> **reactor**: `string`

###### post.responses.200.content.application/json.quote.orderInfo.swapper

> **swapper**: `string`

###### post.responses.200.content.application/json.quote.portionAmount?

> `optional` **portionAmount**: `string`

###### post.responses.200.content.application/json.quote.portionBips?

> `optional` **portionBips**: `number`

###### post.responses.200.content.application/json.quote.portionRecipient?

> `optional` **portionRecipient**: `string`

###### post.responses.200.content.application/json.quote.quoteId?

> `optional` **quoteId**: `string`

###### post.responses.200.content.application/json.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.routing

> **routing**: `"LIMIT_ORDER"`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/approve

> **/lp/approve**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:224](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L224)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Check if tokens and permits need to be approved to add liquidity

###### Description

Checks if the wallet address has the required approvals. If the wallet address does not have the required approval, then the response will include the transactions to approve the tokens. If the wallet address has the required approval, then the response will be empty for the corresponding tokens. If the parameter `simulateTransaction` is set to `true`, then the response will include the gas fees for the approval transactions.

    Note that approval is required for both creating and removing positions in V2 pools. Approval is only required for creating positions in V3 and V4 pools.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount0?

> `optional` **amount0**: `string`

###### Description

The amount of token0 to be added or removed from the position. To estimate the amount of token0 needed when adding a new position, use the /lp/create endpoint to simulate the position creation.

###### post.requestBody.content.application/json.amount1?

> `optional` **amount1**: `string`

###### Description

The amount of token1 to be added or removed from the position. To estimate the amount of token1 needed when adding a new position, use the /lp/create endpoint to simulate the position creation.

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.generatePermitAsTransaction?

> `optional` **generatePermitAsTransaction**: `boolean`

###### post.requestBody.content.application/json.positionAmount?

> `optional` **positionAmount**: `string`

###### Description

Only required when getting approval for removing a V2 position. Populated with the amount of the V2 position to be removed (eg. amount0*amount1).

###### post.requestBody.content.application/json.positionToken?

> `optional` **positionToken**: `string`

###### Description

The address of the NFT representing the position. Required when requesting approval for removing liquidity from a V2 position (provide address of V2 NFT). Required when requesting approval for migrating a V3 position to a V4 position (provide address of V3 NFT).

###### post.requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.token0?

> `optional` **token0**: `string`

###### post.requestBody.content.application/json.token1?

> `optional` **token1**: `string`

###### post.requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.gasFeePositionTokenApproval?

> `optional` **gasFeePositionTokenApproval**: `string`

###### post.responses.200.content.application/json.gasFeePositionTokenPermit?

> `optional` **gasFeePositionTokenPermit**: `string`

###### post.responses.200.content.application/json.gasFeeToken0Approval?

> `optional` **gasFeeToken0Approval**: `string`

###### post.responses.200.content.application/json.gasFeeToken0Cancel?

> `optional` **gasFeeToken0Cancel**: `string`

###### post.responses.200.content.application/json.gasFeeToken0Permit?

> `optional` **gasFeeToken0Permit**: `string`

###### post.responses.200.content.application/json.gasFeeToken1Approval?

> `optional` **gasFeeToken1Approval**: `string`

###### post.responses.200.content.application/json.gasFeeToken1Cancel?

> `optional` **gasFeeToken1Cancel**: `string`

###### post.responses.200.content.application/json.gasFeeToken1Permit?

> `optional` **gasFeeToken1Permit**: `string`

###### post.responses.200.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### post.responses.200.content.application/json.positionTokenApproval?

> `optional` **positionTokenApproval**: `object`

###### post.responses.200.content.application/json.positionTokenApproval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.positionTokenApproval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.positionTokenApproval.from

> **from**: `string`

###### post.responses.200.content.application/json.positionTokenApproval.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.positionTokenApproval.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.positionTokenApproval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.positionTokenApproval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.positionTokenApproval.to

> **to**: `string`

###### post.responses.200.content.application/json.positionTokenApproval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.positionTokenPermitTransaction?

> `optional` **positionTokenPermitTransaction**: `object`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.positionTokenPermitTransaction.from

> **from**: `string`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.to

> **to**: `string`

###### post.responses.200.content.application/json.positionTokenPermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.content.application/json.token0Approval?

> `optional` **token0Approval**: `object`

###### post.responses.200.content.application/json.token0Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.token0Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.token0Approval.from

> **from**: `string`

###### post.responses.200.content.application/json.token0Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.token0Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.token0Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.token0Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.token0Approval.to

> **to**: `string`

###### post.responses.200.content.application/json.token0Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.token0Cancel?

> `optional` **token0Cancel**: `object`

###### post.responses.200.content.application/json.token0Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.token0Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.token0Cancel.from

> **from**: `string`

###### post.responses.200.content.application/json.token0Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.token0Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.token0Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.token0Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.token0Cancel.to

> **to**: `string`

###### post.responses.200.content.application/json.token0Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.token0PermitTransaction?

> `optional` **token0PermitTransaction**: `object`

###### post.responses.200.content.application/json.token0PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.token0PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.token0PermitTransaction.from

> **from**: `string`

###### post.responses.200.content.application/json.token0PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.token0PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.token0PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.token0PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.token0PermitTransaction.to

> **to**: `string`

###### post.responses.200.content.application/json.token0PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.token1Approval?

> `optional` **token1Approval**: `object`

###### post.responses.200.content.application/json.token1Approval.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.token1Approval.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.token1Approval.from

> **from**: `string`

###### post.responses.200.content.application/json.token1Approval.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.token1Approval.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.token1Approval.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.token1Approval.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.token1Approval.to

> **to**: `string`

###### post.responses.200.content.application/json.token1Approval.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.token1Cancel?

> `optional` **token1Cancel**: `object`

###### post.responses.200.content.application/json.token1Cancel.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.token1Cancel.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.token1Cancel.from

> **from**: `string`

###### post.responses.200.content.application/json.token1Cancel.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.token1Cancel.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.token1Cancel.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.token1Cancel.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.token1Cancel.to

> **to**: `string`

###### post.responses.200.content.application/json.token1Cancel.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.token1PermitTransaction?

> `optional` **token1PermitTransaction**: `object`

###### post.responses.200.content.application/json.token1PermitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.token1PermitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.token1PermitTransaction.from

> **from**: `string`

###### post.responses.200.content.application/json.token1PermitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.token1PermitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.token1PermitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.token1PermitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.token1PermitTransaction.to

> **to**: `string`

###### post.responses.200.content.application/json.token1PermitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/claim

> **/lp/claim**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:310](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L310)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Claim LP fees calldata

###### Description

The response will also have the transaction to claim the fees for an LP position for the corresponding pool. If the parameter `simulateTransaction` is set to `true`, then the response will include the gas fees for the claim transaction.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.collectAsWETH?

> `optional` **collectAsWETH**: `boolean`

###### post.requestBody.content.application/json.expectedTokenOwed0RawAmount?

> `optional` **expectedTokenOwed0RawAmount**: `string`

###### post.requestBody.content.application/json.expectedTokenOwed1RawAmount?

> `optional` **expectedTokenOwed1RawAmount**: `string`

###### post.requestBody.content.application/json.position?

> `optional` **position**: `object`

###### post.requestBody.content.application/json.position.pool

> **pool**: `object`

###### post.requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### post.requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### post.requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### post.requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### post.requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### post.requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### post.requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.tokenId?

> `optional` **tokenId**: `number`

###### post.requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.claim?

> `optional` **claim**: `object`

###### post.responses.200.content.application/json.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.claim.from

> **from**: `string`

###### post.responses.200.content.application/json.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.claim.to

> **to**: `string`

###### post.responses.200.content.application/json.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/claim\_rewards

> **/lp/claim\_rewards**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:350](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L350)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Claim LP rewards calldata

###### Description

The response will have the transaction to claim the rewards. If the parameter `simulateTransaction` is set to `true`, then the response will include the gas fees for the claim transaction.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.distributor?

> `optional` **distributor**: `"MERKL"`

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.tokens?

> `optional` **tokens**: `string`[]

###### Description

The token addresses to claim rewards for.

###### post.requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.claim?

> `optional` **claim**: `object`

###### post.responses.200.content.application/json.claim.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.claim.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.claim.from

> **from**: `string`

###### post.responses.200.content.application/json.claim.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.claim.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.claim.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.claim.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.claim.to

> **to**: `string`

###### post.responses.200.content.application/json.claim.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/create

> **/lp/create**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:246](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L246)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create pool and position calldata

###### Description

This request allows the caller to create a position in a pool or, if the pool does not yet exist, to create a new pool. If a new pool must be created, a transaction is returned for the pool creation. In either case, a transaction is returned to create the new position in the pool. If the parameter `simulateTransaction` is set to true, then the response will include the gas fee for the creation transaction(s).

    Different fields are required depending on the pool version (V2, V3, or V4) into which a new position will be created, in addition to the fields which are always required. When creating a position in a V2 pool, the `position` object must contain token0 and token1 addresses. When creating a position in a V3 pool, the `position` object must contain all fields except for `hooks` which are not supported in V3 pools. When creating a position in a V4 pool, all fields within the `position` object are required except for `hooks` which is optional. Note that both V3 and V4 pools require the population of `tickLower` and `tickUpper` fields. Furthermore, `poolLiquidity`, `currentTick`, and `sqrtRatioX96` are always required when creating a position in a V3 or V4 pool. All pool versions require the population of `amount0` and `amount1`, which specify the quantity of tokens being entered into the pool.

    When creating a pool, additional fields are required depending on the pool version being created, in addition to the fields which are always required. When creating a V3 or V4 pool, either `initialPrice` or `poolLiquidity`, `currentTick`, and `sqrtRatioX96` are required. When creating a V2 pool, only `initialPrice` is required. V3 and V4 pools require `amount0` and `amount1` fields to be populated, as the creation of the pool must include seeding of liquidity. V2 pools may optionally have `amount0` and `amount1` populated; V2 pools do not require liquidity to be seeded when creating the pool.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount0?

> `optional` **amount0**: `string`

###### post.requestBody.content.application/json.amount1?

> `optional` **amount1**: `string`

###### post.requestBody.content.application/json.batchPermitData?

> `optional` **batchPermitData**: `object`

###### post.requestBody.content.application/json.batchPermitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.batchPermitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.batchPermitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.defaultDependentAmount?

> `optional` **defaultDependentAmount**: `string`

###### post.requestBody.content.application/json.independentAmount?

> `optional` **independentAmount**: `string`

###### post.requestBody.content.application/json.independentToken?

> `optional` **independentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### post.requestBody.content.application/json.initialDependentAmount?

> `optional` **initialDependentAmount**: `string`

###### post.requestBody.content.application/json.initialPrice?

> `optional` **initialPrice**: `string`

###### post.requestBody.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### post.requestBody.content.application/json.position?

> `optional` **position**: `object`

###### post.requestBody.content.application/json.position.pool

> **pool**: `object`

###### post.requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### post.requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### post.requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### post.requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### post.requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### post.requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### post.requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.requestBody.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### post.requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.create?

> `optional` **create**: `object`

###### post.responses.200.content.application/json.create.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.create.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.create.from

> **from**: `string`

###### post.responses.200.content.application/json.create.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.create.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.create.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.create.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.create.to

> **to**: `string`

###### post.responses.200.content.application/json.create.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### post.responses.200.content.application/json.dependentAmount?

> `optional` **dependentAmount**: `string`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/decrease

> **/lp/decrease**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:290](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L290)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Decrease LP position calldata

###### Description

The response will also have the transaction to decrease the position for the corresponding pool. If the parameter `simulateTransaction` is set to `true`, then the response will include the gas fees for the decrease transaction.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.collectAsWETH?

> `optional` **collectAsWETH**: `boolean`

###### post.requestBody.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.expectedTokenOwed0RawAmount?

> `optional` **expectedTokenOwed0RawAmount**: `string`

###### post.requestBody.content.application/json.expectedTokenOwed1RawAmount?

> `optional` **expectedTokenOwed1RawAmount**: `string`

###### post.requestBody.content.application/json.liquidity0?

> `optional` **liquidity0**: `string`

###### post.requestBody.content.application/json.liquidity1?

> `optional` **liquidity1**: `string`

###### post.requestBody.content.application/json.liquidityPercentageToDecrease?

> `optional` **liquidityPercentageToDecrease**: `number`

###### post.requestBody.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### post.requestBody.content.application/json.position?

> `optional` **position**: `object`

###### post.requestBody.content.application/json.position.pool

> **pool**: `object`

###### post.requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### post.requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### post.requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### post.requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### post.requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### post.requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### post.requestBody.content.application/json.positionLiquidity?

> `optional` **positionLiquidity**: `string`

###### post.requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.requestBody.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### post.requestBody.content.application/json.tokenId?

> `optional` **tokenId**: `number`

###### post.requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### post.responses.200.content.application/json.decrease?

> `optional` **decrease**: `object`

###### post.responses.200.content.application/json.decrease.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.decrease.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.decrease.from

> **from**: `string`

###### post.responses.200.content.application/json.decrease.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.decrease.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.decrease.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.decrease.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.decrease.to

> **to**: `string`

###### post.responses.200.content.application/json.decrease.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/increase

> **/lp/increase**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:270](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L270)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Increase LP position calldata

###### Description

The response will also have the transaction to increase the position for the corresponding pool. If the parameter `simulateTransaction` is set to `true`, then the response will include the gas fees for the increase transaction.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount0?

> `optional` **amount0**: `string`

###### post.requestBody.content.application/json.amount1?

> `optional` **amount1**: `string`

###### post.requestBody.content.application/json.batchPermitData?

> `optional` **batchPermitData**: `object`

###### post.requestBody.content.application/json.batchPermitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.batchPermitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.batchPermitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.defaultDependentAmount?

> `optional` **defaultDependentAmount**: `string`

###### post.requestBody.content.application/json.independentAmount?

> `optional` **independentAmount**: `string`

###### post.requestBody.content.application/json.independentToken?

> `optional` **independentToken**: `"TOKEN_0"` \| `"TOKEN_1"`

###### post.requestBody.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### post.requestBody.content.application/json.position?

> `optional` **position**: `object`

###### post.requestBody.content.application/json.position.pool

> **pool**: `object`

###### post.requestBody.content.application/json.position.pool.fee?

> `optional` **fee**: `number`

###### post.requestBody.content.application/json.position.pool.hooks?

> `optional` **hooks**: `string`

###### post.requestBody.content.application/json.position.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.position.pool.token0

> **token0**: `string`

###### post.requestBody.content.application/json.position.pool.token1

> **token1**: `string`

###### post.requestBody.content.application/json.position.tickLower?

> `optional` **tickLower**: `number`

###### post.requestBody.content.application/json.position.tickUpper?

> `optional` **tickUpper**: `number`

###### post.requestBody.content.application/json.protocol?

> `optional` **protocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.requestBody.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### post.requestBody.content.application/json.tokenId?

> `optional` **tokenId**: `number`

###### post.requestBody.content.application/json.walletAddress?

> `optional` **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.currentTick?

> `optional` **currentTick**: `number`

###### post.responses.200.content.application/json.dependentAmount?

> `optional` **dependentAmount**: `string`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.increase?

> `optional` **increase**: `object`

###### post.responses.200.content.application/json.increase.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.increase.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.increase.from

> **from**: `string`

###### post.responses.200.content.application/json.increase.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.increase.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.increase.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.increase.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.increase.to

> **to**: `string`

###### post.responses.200.content.application/json.increase.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.poolLiquidity?

> `optional` **poolLiquidity**: `string`

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.content.application/json.sqrtRatioX96?

> `optional` **sqrtRatioX96**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/migrate

> **/lp/migrate**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:330](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L330)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Migrate LP position calldata

###### Description

The response will also have the transaction to migrate the position for the corresponding pool. If the parameter `simulateTransaction` is set to `true`, then the response will include the gas fees for the migrate transaction.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount0

> **amount0**: `string`

###### post.requestBody.content.application/json.amount1

> **amount1**: `string`

###### post.requestBody.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.expectedTokenOwed0RawAmount

> **expectedTokenOwed0RawAmount**: `string`

###### post.requestBody.content.application/json.expectedTokenOwed1RawAmount

> **expectedTokenOwed1RawAmount**: `string`

###### post.requestBody.content.application/json.initialPrice?

> `optional` **initialPrice**: `string`

###### post.requestBody.content.application/json.inputCurrentTick

> **inputCurrentTick**: `number`

###### post.requestBody.content.application/json.inputPoolLiquidity

> **inputPoolLiquidity**: `string`

###### post.requestBody.content.application/json.inputPosition

> **inputPosition**: `object`

###### post.requestBody.content.application/json.inputPosition.pool

> **pool**: `object`

###### post.requestBody.content.application/json.inputPosition.pool.fee?

> `optional` **fee**: `number`

###### post.requestBody.content.application/json.inputPosition.pool.hooks?

> `optional` **hooks**: `string`

###### post.requestBody.content.application/json.inputPosition.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.inputPosition.pool.token0

> **token0**: `string`

###### post.requestBody.content.application/json.inputPosition.pool.token1

> **token1**: `string`

###### post.requestBody.content.application/json.inputPosition.tickLower?

> `optional` **tickLower**: `number`

###### post.requestBody.content.application/json.inputPosition.tickUpper?

> `optional` **tickUpper**: `number`

###### post.requestBody.content.application/json.inputPositionLiquidity

> **inputPositionLiquidity**: `string`

###### post.requestBody.content.application/json.inputProtocol

> **inputProtocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.inputSqrtRatioX96

> **inputSqrtRatioX96**: `string`

###### post.requestBody.content.application/json.outputCurrentTick?

> `optional` **outputCurrentTick**: `number`

###### post.requestBody.content.application/json.outputPoolLiquidity?

> `optional` **outputPoolLiquidity**: `string`

###### post.requestBody.content.application/json.outputPosition

> **outputPosition**: `object`

###### post.requestBody.content.application/json.outputPosition.pool

> **pool**: `object`

###### post.requestBody.content.application/json.outputPosition.pool.fee?

> `optional` **fee**: `number`

###### post.requestBody.content.application/json.outputPosition.pool.hooks?

> `optional` **hooks**: `string`

###### post.requestBody.content.application/json.outputPosition.pool.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.outputPosition.pool.token0

> **token0**: `string`

###### post.requestBody.content.application/json.outputPosition.pool.token1

> **token1**: `string`

###### post.requestBody.content.application/json.outputPosition.tickLower?

> `optional` **tickLower**: `number`

###### post.requestBody.content.application/json.outputPosition.tickUpper?

> `optional` **tickUpper**: `number`

###### post.requestBody.content.application/json.outputProtocol

> **outputProtocol**: `"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`

###### post.requestBody.content.application/json.outputSqrtRatioX96?

> `optional` **outputSqrtRatioX96**: `string`

###### post.requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### post.requestBody.content.application/json.signatureDeadline?

> `optional` **signatureDeadline**: `number`

###### post.requestBody.content.application/json.simulateTransaction

> **simulateTransaction**: `boolean`

###### Default

```ts
false
```

###### post.requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.requestBody.content.application/json.tokenId

> **tokenId**: `number`

###### post.requestBody.content.application/json.walletAddress

> **walletAddress**: `string`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.migrate?

> `optional` **migrate**: `object`

###### post.responses.200.content.application/json.migrate.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.migrate.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.migrate.from

> **from**: `string`

###### post.responses.200.content.application/json.migrate.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.migrate.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.migrate.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.migrate.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.migrate.to

> **to**: `string`

###### post.responses.200.content.application/json.migrate.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /lp/pool\_info

> **/lp/pool\_info**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:370](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L370)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Fetch Pool Information

###### Description

Given either a pair address/pool address/pool Id return all the details pertaining to the pool.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### post.requestBody.content.application/json.currentPage?

> `optional` **currentPage**: `number`

###### post.requestBody.content.application/json.pageSize?

> `optional` **pageSize**: `number`

###### post.requestBody.content.application/json.poolParams?

> `optional` **poolParams**: `object`

###### post.requestBody.content.application/json.poolParams.fee?

> `optional` **fee**: `number`

###### Description

The fee of the pool, if the pool has a fee value.

###### post.requestBody.content.application/json.poolParams.hookAddress?

> `optional` **hookAddress**: `string`

###### Description

The address of the hook for the pool, if any.

###### post.requestBody.content.application/json.poolParams.tickSpacing?

> `optional` **tickSpacing**: `number`

###### post.requestBody.content.application/json.poolParams.token0?

> `optional` **token0**: `string`

###### post.requestBody.content.application/json.poolParams.token1?

> `optional` **token1**: `string`

###### post.requestBody.content.application/json.poolReferences?

> `optional` **poolReferences**: `object`[]

###### Description

Array of pool reference identifiers to query. Each reference should include the protocol, chainId, and either the pool address (V3), pool id (V4), or pair address (V2).

###### post.requestBody.content.application/json.protocol

> **protocol**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.currentPage?

> `optional` **currentPage**: `number`

###### post.responses.200.content.application/json.pageSize?

> `optional` **pageSize**: `number`

###### post.responses.200.content.application/json.pools?

> `optional` **pools**: `object`[]

###### Description

Array of pool information objects.

###### post.responses.200.content.application/json.requestId?

> `optional` **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /order

> **/order**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L55)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create a gasless order

###### Description

The order endpoint is used to submit a UniswapX intent. If the `routing` field in the response to a quote is any of `DUTCH_V2`, `DUTCH_V3`, `LIMIT_ORDER`, or `PRIORITY` this endpoint is used to submit your order to the UniswapX protocol to be filled by the filler network. These orders are gasless because the filler will pay the gas to complete the transaction.

    The order will be validated and, if valid, will be submitted to the filler network. The network will try to fill the order at the quoted `startAmount`. If the order is not filled at the `startAmount` by the `deadline`, the amount will start decaying until the `endAmount` is reached. The order will remain `open` until it is either filled, canceled, or has expired by remaining unfilled beyond the `decayEndTime`.

    For simplicity, the order request is identical to the quote response except for the addition of the signed permit.

    Native ETH on UniswapX: If the quote you are submitting uses native ETH as the input token (e.g. `tokenIn` is `0x0000000000000000000000000000000000000000`), include `x-erc20eth-enabled: true`. Native ETH input on UniswapX requires wallet support for EIP-7914 and sufficient native allowance. For 7702-delegated smart contract wallets, you can generate the required approval call(s) via `/swap_7702` when needed.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `object`

###### post.parameters.header.x-erc20eth-enabled?

> `optional` **x-erc20eth-enabled**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: ... \| ...; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ...; `relativeBlocks?`: ...; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

###### post.requestBody.content.application/json.routing?

> `optional` **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### post.requestBody.content.application/json.signature

> **signature**: `string`

###### Description

The signed permit.

###### post.responses

> **responses**: `object`

###### post.responses.201

> **201**: `object`

###### post.responses.201.content

> **content**: `object`

###### post.responses.201.content.application/json

> **application/json**: `object`

###### post.responses.201.content.application/json.orderId

> **orderId**: `string`

###### post.responses.201.content.application/json.orderStatus

> **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### post.responses.201.content.application/json.requestId

> **requestId**: `string`

###### post.responses.201.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /orders

> **/orders**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L81)

###### delete?

> `optional` **delete**: `undefined`

###### get

> **get**: `object`

Get gasless orders

###### Description

Retrieve one or more gasless orders filtered, optionally filered by query param(s). The request must at minimum include one of the following parameters: `orderId`, `orderIds`, `orderStatus`, `swapper`, or `filler`.

###### get.parameters

> **parameters**: `object`

###### get.parameters.cookie?

> `optional` **cookie**: `undefined`

###### get.parameters.header?

> `optional` **header**: `undefined`

###### get.parameters.path?

> `optional` **path**: `undefined`

###### get.parameters.query?

> `optional` **query**: `object`

###### get.parameters.query.cursor?

> `optional` **cursor**: `string`

###### get.parameters.query.filler?

> `optional` **filler**: `string`

###### Description

Filter by filler address.

###### get.parameters.query.limit?

> `optional` **limit**: `number`

###### get.parameters.query.orderId?

> `optional` **orderId**: `string`

###### get.parameters.query.orderIds?

> `optional` **orderIds**: `string`

###### Description

A list of comma separated orderIds.

###### get.parameters.query.orderStatus?

> `optional` **orderStatus**: `"error"` \| `"expired"` \| `"open"` \| `"cancelled"` \| `"filled"` \| `"unverified"` \| `"insufficient-funds"`

###### Description

Filter by order status.

###### get.parameters.query.orderType?

> `optional` **orderType**: `"Dutch"` \| `"Dutch_V2"` \| `"Dutch_V1_V2"` \| `"Dutch_V3"` \| `"Limit"` \| `"Priority"`

###### Description

The default orderType is Dutch_V1_V2 and will grab both Dutch and Dutch_V2 orders.

###### get.parameters.query.sort?

> `optional` **sort**: `string`

###### Description

Sort query. For example: `sort=gt(UNIX_TIMESTAMP)`, `sort=between(1675872827, 1675872930)`, or `lt(1675872930)`.

###### get.parameters.query.sortKey?

> `optional` **sortKey**: `"createdAt"`

###### Description

Order the query results by the sort key.

###### get.parameters.query.swapper?

> `optional` **swapper**: `string`

###### Description

Filter by swapper address.

###### get.requestBody?

> `optional` **requestBody**: `undefined`

###### get.responses

> **responses**: `object`

###### get.responses.200

> **200**: `object`

###### get.responses.200.content

> **content**: `object`

###### get.responses.200.content.application/json

> **application/json**: `object`

###### get.responses.200.content.application/json.cursor?

> `optional` **cursor**: `string`

###### get.responses.200.content.application/json.orders

> **orders**: `object`[]

###### get.responses.200.content.application/json.requestId

> **requestId**: `string`

###### get.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.400

> **400**: `object`

###### get.responses.400.content

> **content**: `object`

###### get.responses.400.content.application/json

> **application/json**: `object`

###### get.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### get.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.404

> **404**: `object`

###### get.responses.404.content

> **content**: `object`

###### get.responses.404.content.application/json

> **application/json**: `object`

###### get.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### get.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.429

> **429**: `object`

###### get.responses.429.content

> **content**: `object`

###### get.responses.429.content.application/json

> **application/json**: `object`

###### get.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### get.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.500

> **500**: `object`

###### get.responses.500.content

> **content**: `object`

###### get.responses.500.content.application/json

> **application/json**: `object`

###### get.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### get.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.504

> **504**: `object`

###### get.responses.504.content

> **content**: `object`

###### get.responses.504.content.application/json

> **application/json**: `object`

###### get.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### get.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post?

> `optional` **post**: `undefined`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /plan

> **/plan**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:472](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L472)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create an execution plan

###### Description

Creates a multi-step execution plan for chained transactions. The plan breaks down complex multi-chain or multi-transaction flows into sequential steps that can be executed by the client. Each step includes the method (transaction, message signature, or batch calls), payload, and current status. The response includes the current step index to track progress through the plan.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.quote

> **quote**: `object`

###### post.requestBody.content.application/json.quote.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### post.requestBody.content.application/json.quote.gasEstimates?

> `optional` **gasEstimates**: `Record`\<`string`, `never`\>[]

###### Description

Gas estimates for each step in the chained flow.

###### post.requestBody.content.application/json.quote.gasFee?

> `optional` **gasFee**: `string`

###### post.requestBody.content.application/json.quote.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### post.requestBody.content.application/json.quote.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### post.requestBody.content.application/json.quote.gasPrice?

> `optional` **gasPrice**: `string`

###### post.requestBody.content.application/json.quote.gasStrategies

> **gasStrategies**: `object`[]

###### Description

Gas strategies for the chained flow.

###### post.requestBody.content.application/json.quote.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### post.requestBody.content.application/json.quote.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### post.requestBody.content.application/json.quote.input

> **input**: `object`

###### post.requestBody.content.application/json.quote.input.amount?

> `optional` **amount**: `string`

###### post.requestBody.content.application/json.quote.input.token?

> `optional` **token**: `string`

###### post.requestBody.content.application/json.quote.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.requestBody.content.application/json.quote.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.requestBody.content.application/json.quote.output

> **output**: `object`

###### post.requestBody.content.application/json.quote.output.amount?

> `optional` **amount**: `string`

###### post.requestBody.content.application/json.quote.output.recipient?

> `optional` **recipient**: `string`

###### post.requestBody.content.application/json.quote.output.token?

> `optional` **token**: `string`

###### post.requestBody.content.application/json.quote.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### post.requestBody.content.application/json.quote.quoteId

> **quoteId**: `string`

###### post.requestBody.content.application/json.quote.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.requestBody.content.application/json.quote.steps?

> `optional` **steps**: `object`[]

###### Description

Truncated plan steps for the chained transaction flow.

###### post.requestBody.content.application/json.quote.swapper

> **swapper**: `string`

###### post.requestBody.content.application/json.quote.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire chained flow.

###### post.requestBody.content.application/json.quote.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.quote.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.quote.tradeType

> **tradeType**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### post.requestBody.content.application/json.routing

> **routing**: `"CHAINED"`

###### Description

The routing type for the plan. Currently only CHAINED is supported for multi-step execution plans.

###### post.requestBody.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### post.requestBody.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### post.requestBody.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: ... \| ...

###### post.requestBody.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### post.responses.200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### post.responses.200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### post.responses.200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### post.responses.200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### post.responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### post.responses.200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### post.responses.200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### post.responses.200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### post.responses.200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### post.responses.200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### post.responses.200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### post.responses.200.content.application/json.quoteId

> **quoteId**: `string`

###### post.responses.200.content.application/json.recipient

> **recipient**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.responses.200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### post.responses.200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### post.responses.200.content.application/json.swapper

> **swapper**: `string`

###### post.responses.200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### post.responses.200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### post.responses.200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### post.responses.200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### post.responses.200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: ... \| ...

###### post.responses.200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /plan/\{planId\}

> **/plan/\{planId\}**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:492](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L492)

###### delete?

> `optional` **delete**: `undefined`

###### get

> **get**: `object`

Get an execution plan

###### Description

Retrieves an existing execution plan by its ID. Returns the full plan with current status and all steps. If forceRefresh is set to true, the plan will be refreshed to check for any updates to step statuses. Note: Completed plans cannot be refreshed.

###### get.parameters

> **parameters**: `object`

###### get.parameters.cookie?

> `optional` **cookie**: `undefined`

###### get.parameters.header?

> `optional` **header**: `undefined`

###### get.parameters.path

> **path**: `object`

###### get.parameters.path.planId

> **planId**: `string`

###### Description

The unique identifier of the plan to retrieve.

###### get.parameters.query?

> `optional` **query**: `object`

###### get.parameters.query.forceRefresh?

> `optional` **forceRefresh**: `boolean`

###### Description

Whether to force refresh the plan status. Defaults to false. Completed plans cannot be refreshed.

###### get.requestBody?

> `optional` **requestBody**: `undefined`

###### get.responses

> **responses**: `object`

###### get.responses.200

> **200**: `object`

###### get.responses.200.content

> **content**: `object`

###### get.responses.200.content.application/json

> **application/json**: `object`

###### get.responses.200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### get.responses.200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### get.responses.200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### get.responses.200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### get.responses.200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### get.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### get.responses.200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### get.responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### get.responses.200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### get.responses.200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### get.responses.200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### get.responses.200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### get.responses.200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### get.responses.200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### get.responses.200.content.application/json.quoteId

> **quoteId**: `string`

###### get.responses.200.content.application/json.recipient

> **recipient**: `string`

###### get.responses.200.content.application/json.requestId

> **requestId**: `string`

###### get.responses.200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### get.responses.200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### get.responses.200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### get.responses.200.content.application/json.swapper

> **swapper**: `string`

###### get.responses.200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### get.responses.200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### get.responses.200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### get.responses.200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### get.responses.200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: ... \| ...

###### get.responses.200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### get.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.400

> **400**: `object`

###### get.responses.400.content

> **content**: `object`

###### get.responses.400.content.application/json

> **application/json**: `object`

###### get.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### get.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.401

> **401**: `object`

###### get.responses.401.content

> **content**: `object`

###### get.responses.401.content.application/json

> **application/json**: `object`

###### get.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### get.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.404

> **404**: `object`

###### get.responses.404.content

> **content**: `object`

###### get.responses.404.content.application/json

> **application/json**: `object`

###### get.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### get.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.422

> **422**: `object`

###### get.responses.422.content

> **content**: `object`

###### get.responses.422.content.application/json

> **application/json**: `object`

###### get.responses.422.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.422.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnprocessableEntity
```

###### get.responses.422.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.429

> **429**: `object`

###### get.responses.429.content

> **content**: `object`

###### get.responses.429.content.application/json

> **application/json**: `object`

###### get.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### get.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.500

> **500**: `object`

###### get.responses.500.content

> **content**: `object`

###### get.responses.500.content.application/json

> **application/json**: `object`

###### get.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### get.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.504

> **504**: `object`

###### get.responses.504.content

> **content**: `object`

###### get.responses.504.content.application/json

> **application/json**: `object`

###### get.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### get.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch

> **patch**: `object`

Update an existing plan with step proofs

###### Description

Updates an existing execution plan by submitting proof of completed plan steps (transaction hashes or signatures). The endpoint retrieves the existing plan, attaches proofs to specified steps, verifies the proofs, and potentially regenerates remaining steps if needed. Returns the full updated plan with current status. Note: Order IDs are not accepted in requests; they are system-generated after receiving a signature.

###### patch.parameters

> **parameters**: `object`

###### patch.parameters.cookie?

> `optional` **cookie**: `undefined`

###### patch.parameters.header?

> `optional` **header**: `undefined`

###### patch.parameters.path

> **path**: `object`

###### patch.parameters.path.planId

> **planId**: `string`

###### Description

The unique identifier of the plan to update.

###### patch.parameters.query?

> `optional` **query**: `undefined`

###### patch.requestBody?

> `optional` **requestBody**: `object`

###### patch.requestBody.content

> **content**: `object`

###### patch.requestBody.content.application/json

> **application/json**: `object`

###### patch.requestBody.content.application/json.steps

> **steps**: `object`[]

###### Description

Array of steps with proofs to attach. Only steps being updated need to be included.

###### patch.responses

> **responses**: `object`

###### patch.responses.200

> **200**: `object`

###### patch.responses.200.content

> **content**: `object`

###### patch.responses.200.content.application/json

> **application/json**: `object`

###### patch.responses.200.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### patch.responses.200.content.application/json.completedAt?

> `optional` **completedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan completed.

###### patch.responses.200.content.application/json.createdAt?

> `optional` **createdAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was created.

###### patch.responses.200.content.application/json.currentStepIndex

> **currentStepIndex**: `number`

###### Description

The index of the current step that needs to be executed (0-based).

###### patch.responses.200.content.application/json.expectedOutput

> **expectedOutput**: `string`

###### patch.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### patch.responses.200.content.application/json.gasFeeQuote?

> `optional` **gasFeeQuote**: `string`

###### patch.responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### patch.responses.200.content.application/json.gasStrategies?

> `optional` **gasStrategies**: `object`[]

###### Description

Gas strategies used for the plan.

###### patch.responses.200.content.application/json.gasUseEstimate?

> `optional` **gasUseEstimate**: `string`

###### patch.responses.200.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### patch.responses.200.content.application/json.lastUserActionAt?

> `optional` **lastUserActionAt**: `string`

Format: date-time

###### Description

Timestamp of the last user action on this plan.

###### patch.responses.200.content.application/json.planId

> **planId**: `string`

###### Description

A unique identifier for this execution plan.

###### patch.responses.200.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### patch.responses.200.content.application/json.quoteId

> **quoteId**: `string`

###### patch.responses.200.content.application/json.recipient

> **recipient**: `string`

###### patch.responses.200.content.application/json.requestId

> **requestId**: `string`

###### patch.responses.200.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### patch.responses.200.content.application/json.status

> **status**: `"FAILED"` \| `"ACTIVE"` \| `"AWAITING_ACTION"` \| `"IN_PROGRESS"` \| `"COMPLETED"`

###### patch.responses.200.content.application/json.steps

> **steps**: `object`[]

###### Description

The sequential steps that need to be executed to complete the plan.

###### patch.responses.200.content.application/json.swapper

> **swapper**: `string`

###### patch.responses.200.content.application/json.timeEstimateMs?

> `optional` **timeEstimateMs**: `number`

###### Description

Estimated time in milliseconds to complete the entire plan.

###### patch.responses.200.content.application/json.updatedAt?

> `optional` **updatedAt**: `string`

Format: date-time

###### Description

Timestamp when the plan was last updated.

###### patch.responses.200.content.application/json.walletExecutionContext?

> `optional` **walletExecutionContext**: `object`

###### patch.responses.200.content.application/json.walletExecutionContext.properties?

> `optional` **properties**: `object`

###### patch.responses.200.content.application/json.walletExecutionContext.properties.walletInfo?

> `optional` **walletInfo**: ... \| ...

###### patch.responses.200.content.application/json.walletExecutionContext.scopes

> **scopes**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of scope identifiers to their scope data.

###### patch.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.400

> **400**: `object`

###### patch.responses.400.content

> **content**: `object`

###### patch.responses.400.content.application/json

> **application/json**: `object`

###### patch.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### patch.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.401

> **401**: `object`

###### patch.responses.401.content

> **content**: `object`

###### patch.responses.401.content.application/json

> **application/json**: `object`

###### patch.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### patch.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.404

> **404**: `object`

###### patch.responses.404.content

> **content**: `object`

###### patch.responses.404.content.application/json

> **application/json**: `object`

###### patch.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### patch.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.422

> **422**: `object`

###### patch.responses.422.content

> **content**: `object`

###### patch.responses.422.content.application/json

> **application/json**: `object`

###### patch.responses.422.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.422.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnprocessableEntity
```

###### patch.responses.422.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.429

> **429**: `object`

###### patch.responses.429.content

> **content**: `object`

###### patch.responses.429.content.application/json

> **application/json**: `object`

###### patch.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### patch.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.500

> **500**: `object`

###### patch.responses.500.content

> **content**: `object`

###### patch.responses.500.content.application/json

> **application/json**: `object`

###### patch.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### patch.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### patch.responses.504

> **504**: `object`

###### patch.responses.504.content

> **content**: `object`

###### patch.responses.504.content.application/json

> **application/json**: `object`

###### patch.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### patch.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### patch.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post?

> `optional` **post**: `undefined`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /quote

> **/quote**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L29)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Get a quote

###### Description

Requests a quote according to the specified swap parameters. This endpoint may be used to get a quote for a swap, a bridge, or a wrap/unwrap. The resulting response includes a quote for the swap and the proposed route by which the quote was achieved. The response will also include estimated gas fees for the proposed quote route. If the proposed route is via a Uniswap Protocol pool, the response may include a permit2 message for the swapper to sign prior to making a /swap request. The proposed route will also be simulated. If the simulation fails, the response will include an error message or `txFailureReason`.

    Certain routing options may be whitelisted by the requestor through the use of the `protocols` field. Further, the requestor may ask for the best price route or for the fastest price route through the 'routingPreference' field. Note that the fastest price route refers to the speed with which a quote is returned, not the number of transactions that may be required to get from the input token and chain to the output token and chain. Further note that all `routingPreference` values except for `FASTEST` and `BEST_PRICE` are deprecated. For more information on the `protocols` and `routingPreference` fields, see the [Token Trading Workflow](https://uniswap-docs.readme.io/reference/trading-flow#swap-routing) explanation of Swap Routing.

    API integrators using this API for the benefit of customer end users may request a service fee be taken from the output token and deposited to a fee collection address. To request this, please reach out to your Uniswap Labs contact. This optional fee is associated to the API key and is always taken from the output token. Note if there is a fee and the `type` is `EXACT_INPUT`, the output amount quoted will **not** include the fee subtraction. If there is a fee and the `type` is `EXACT_OUTPUT`, the input amount quoted will **not** include the fee addition. Instead, in both cases, the fee will be recorded in the `portionBips` and `portionAmount` fields.

    Native ETH on UniswapX: UniswapX routes (e.g. `DUTCH_V2`, `DUTCH_V3`, `PRIORITY`) can use native ETH as the input token by setting `tokenIn` to the native currency address (e.g. `0x0000000000000000000000000000000000000000`) and passing `x-erc20eth-enabled: true`. Native ETH input on UniswapX requires wallet support for EIP-7914, a smart wallet activated on your desired network, and a sufficient native allowance (set via /swap_7702 if x-erc20eth-enabled header is set to `true`). If these requirements are not met, UniswapX quotes for native input may be omitted and the response may fall back to `CLASSIC` routing instead.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `object`

###### post.parameters.header.x-erc20eth-enabled?

> `optional` **x-erc20eth-enabled**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### post.parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount

> **amount**: `string`

###### post.requestBody.content.application/json.autoSlippage?

> `optional` **autoSlippage**: `"DEFAULT"`

###### post.requestBody.content.application/json.generatePermitAsTransaction?

> `optional` **generatePermitAsTransaction**: `boolean`

###### post.requestBody.content.application/json.hooksOptions?

> `optional` **hooksOptions**: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`

###### post.requestBody.content.application/json.permitAmount?

> `optional` **permitAmount**: `"FULL"` \| `"EXACT"`

###### post.requestBody.content.application/json.protocols?

> `optional` **protocols**: (`"V2"` \| `"V3"` \| `"V4"` \| `"UNISWAPX"` \| `"UNISWAPX_V2"` \| `"UNISWAPX_V3"`)[]

###### post.requestBody.content.application/json.routingPreference?

> `optional` **routingPreference**: `"BEST_PRICE"` \| `"FASTEST"`

###### post.requestBody.content.application/json.slippageTolerance?

> `optional` **slippageTolerance**: `number`

###### post.requestBody.content.application/json.spreadOptimization?

> `optional` **spreadOptimization**: `"EXECUTION"` \| `"PRICE"`

###### post.requestBody.content.application/json.swapper

> **swapper**: `string`

###### post.requestBody.content.application/json.tokenIn

> **tokenIn**: `string`

###### post.requestBody.content.application/json.tokenInChainId

> **tokenInChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.tokenOut

> **tokenOut**: `string`

###### post.requestBody.content.application/json.tokenOutChainId

> **tokenOutChainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.type

> **type**: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`

###### post.requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.permitData

> **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### post.responses.200.content.application/json.permitGasFee?

> `optional` **permitGasFee**: `string`

###### post.responses.200.content.application/json.permitTransaction?

> `optional` **permitTransaction**: `object`

###### post.responses.200.content.application/json.permitTransaction.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.permitTransaction.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.permitTransaction.from

> **from**: `string`

###### post.responses.200.content.application/json.permitTransaction.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.permitTransaction.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.permitTransaction.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.permitTransaction.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.permitTransaction.to

> **to**: `string`

###### post.responses.200.content.application/json.permitTransaction.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: ... \| ...; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: ... \| ...; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ...; `relativeBlocks?`: ...; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \} \| \{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<..., ...\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (... \| ... \| ... \| ... \| ... \| ...)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `deadline`: `number`; `decayEndTime?`: `number`; `decayStartTime?`: `number`; `exclusiveFiller`: `string`; `exclusivityOverrideBps`: `string`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: ... \| ...; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `endAmount`: `string`; `startAmount`: `string`; `token?`: ... \| ...; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner?`: `string`; `deadline`: `number`; `input`: \{ `adjustmentPerGweiBaseFee`: `string`; `curve`: \{ `relativeAmounts?`: ...; `relativeBlocks?`: ...; \}; `maxAmount`: `string`; `startAmount`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `startingBaseFee?`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `aggregatedOutputs?`: `object`[]; `classicGasUseEstimateUSD?`: `string`; `deadlineBufferSecs?`: `number`; `encodedOrder`: `string`; `expectedAmountIn?`: `string`; `expectedAmountOut?`: `string`; `orderId`: `string`; `orderInfo`: \{ `additionalValidationContract?`: `string`; `additionalValidationData?`: `string`; `auctionStartBlock`: `string`; `baselinePriorityFeeWei`: `string`; `chainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `cosigner`: `string`; `deadline`: `number`; `input`: \{ `amount`: `string`; `mpsPerPriorityFeeWei`: `string`; `token`: `string`; \}; `nonce`: `string`; `outputs`: `object`[]; `reactor`: `string`; `swapper`: `string`; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `slippageTolerance?`: `number`; \}

\{ `autoSlippage?`: `"DEFAULT"`; `gasEstimates?`: `Record`\<..., ...\>[]; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasStrategies`: `object`[]; `gasUseEstimate?`: `string`; `hooksOptions?`: `"V4_HOOKS_INCLUSIVE"` \| `"V4_HOOKS_ONLY"` \| `"V4_NO_HOOKS"`; `input`: \{ `amount?`: `string`; `token?`: `string`; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output`: \{ `amount?`: `string`; `recipient?`: `string`; `token?`: `string`; \}; `protocols?`: (... \| ... \| ... \| ... \| ... \| ...)[]; `quoteId`: `string`; `slippageTolerance?`: `number`; `steps?`: `object`[]; `swapper`: `string`; `timeEstimateMs?`: `number`; `tokenInChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tokenOutChainId`: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`; `tradeType`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.routing

> **routing**: `"DUTCH_LIMIT"` \| `"CLASSIC"` \| `"DUTCH_V2"` \| `"DUTCH_V3"` \| `"BRIDGE"` \| `"LIMIT_ORDER"` \| `"PRIORITY"` \| `"WRAP"` \| `"UNWRAP"` \| `"CHAINED"`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /send

> **/send**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:164](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L164)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create send calldata

###### Description

This endpoint will generate a calldata for a send transaction based on the inputs. The calldata may be signed by the `sender` to cause the specified `amount` of the `token` to be transfered from the `sender` to the `recipient`. The successful response always includes estimated gas for the transaction.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.amount

> **amount**: `string`

###### post.requestBody.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.requestBody.content.application/json.recipient

> **recipient**: `string`

###### post.requestBody.content.application/json.sender

> **sender**: `string`

###### post.requestBody.content.application/json.token

> **token**: `string`

###### post.requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.gasFeeUSD?

> `optional` **gasFeeUSD**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.send

> **send**: `object`

###### post.responses.200.content.application/json.send.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.send.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.send.from

> **from**: `string`

###### post.responses.200.content.application/json.send.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.send.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.send.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.send.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.send.to

> **to**: `string`

###### post.responses.200.content.application/json.send.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /swap

> **/swap**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L101)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create swap calldata

###### Description

Create the calldata for a swap transaction (including wrap/unwrap) against the Uniswap Protocols. If the `quote` parameter includes the fee parameters, then the calldata will include the fee disbursement. The gas estimates will be **more precise** when the the response calldata would be valid if submitted on-chain.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `object`

###### post.parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.includeGasInfo

> **includeGasInfo**: `boolean`

###### Deprecated

###### Description

Use `refreshGasPrice` instead.

###### Default

```ts
false
```

###### post.requestBody.content.application/json.permitData?

> `optional` **permitData**: `object`

###### post.requestBody.content.application/json.permitData.domain?

> `optional` **domain**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.permitData.types?

> `optional` **types**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.permitData.values?

> `optional` **values**: `Record`\<`string`, `never`\>

###### post.requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### post.requestBody.content.application/json.refreshGasPrice

> **refreshGasPrice**: `boolean`

###### Description

If true, the gas price will be re-fetched from the network.

###### Default

```ts
false
```

###### post.requestBody.content.application/json.safetyMode?

> `optional` **safetyMode**: `"SAFE"`

###### post.requestBody.content.application/json.signature?

> `optional` **signature**: `string`

###### Description

The signed permit.

###### post.requestBody.content.application/json.simulateTransaction

> **simulateTransaction**: `boolean`

###### Description

If true, the transaction will be simulated. If the simulation results on an onchain error, endpoint will return an error.

###### Default

```ts
false
```

###### post.requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.swap

> **swap**: `object`

###### post.responses.200.content.application/json.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.swap.from

> **from**: `string`

###### post.responses.200.content.application/json.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.swap.to

> **to**: `string`

###### post.responses.200.content.application/json.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /swap\_5792

> **/swap\_5792**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:430](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L430)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create swap EIP 5792 calldata

###### Description

Create the EIP 5792 calldata for a swap transaction (including wrap/unwrap and bridging) against the Uniswap Protocols. If the `quote` parameter includes the fee parameters, then the calldata will include the fee disbursement. The gas estimates will be **more precise** when the response calldata would be valid if submitted on-chain.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `object`

###### post.parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### post.requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### post.requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.calls

> **calls**: `object`[]

###### post.responses.200.content.application/json.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.from

> **from**: `string`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /swap\_7702

> **/swap\_7702**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:450](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L450)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Create swap EIP 7702 calldata

###### Description

Create the EIP 7702 calldata for a swap transaction (including wrap/unwrap and bridging) against the Uniswap Protocols. If the `quote` parameter includes the fee parameters, then the calldata will include the fee disbursement. The gas estimates will be **more precise** when the the response calldata would be valid if submitted on-chain.

    Native ETH / UniswapX setup: When `x-erc20eth-enabled` is `true` and the input token is native ETH, the response may include an additional native approval call (e.g. an `approveNative` step) to enable ERC20-ETH (EIP-7914) spending for the wallet. This native allowance is a prerequisite for native ETH input on UniswapX (`/quote` → `/order`) for supported wallets.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `object`

###### post.parameters.header.x-erc20eth-enabled?

> `optional` **x-erc20eth-enabled**: `boolean`

###### Description

Enable native ETH input support for UniswapX via ERC20-ETH (EIP-7914). When set to true and `tokenIn` is the native currency address (e.g. `0x0000000000000000000000000000000000000000`), the API may return UniswapX routes that spend native ETH for supported wallets.

###### post.parameters.header.x-universal-router-version?

> `optional` **x-universal-router-version**: `"1.2"` \| `"2.0"`

###### Description

The version of the Universal Router to use for the swap journey. *MUST* be consistent throughout the API calls.

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.deadline?

> `optional` **deadline**: `number`

###### post.requestBody.content.application/json.includeGasInfo

> **includeGasInfo**: `boolean`

###### Default

```ts
false
```

###### post.requestBody.content.application/json.permitData?

> `optional` **permitData**: \{ `domain?`: `Record`\<`string`, `never`\>; `types?`: `Record`\<`string`, `never`\>; `values?`: `Record`\<`string`, `never`\>; \} \| `null`

###### post.requestBody.content.application/json.quote

> **quote**: \{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \} \| \{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### Type Declaration

\{ `aggregatedOutputs?`: `object`[]; `blockNumber?`: `string`; `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `priceImpact?`: `number`; `quoteId?`: `string`; `route?`: ...[][]; `routeString?`: `string`; `slippage?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; `txFailureReasons?`: (... \| ... \| ... \| ... \| ...)[]; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `gasFee?`: `string`; `gasFeeQuote?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

\{ `chainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `destinationChainId?`: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`; `estimatedFillTimeMs?`: `number`; `exclusiveRelayer?`: `string`; `exclusivityDeadline?`: `number`; `fillDeadline?`: `number`; `gasFee?`: `string`; `gasFeeUSD?`: `string`; `gasPrice?`: `string`; `gasUseEstimate?`: `string`; `input?`: \{ `amount?`: ... \| ...; `token?`: ... \| ...; \}; `maxFeePerGas?`: `string`; `maxPriorityFeePerGas?`: `string`; `output?`: \{ `amount?`: ... \| ...; `recipient?`: ... \| ...; `token?`: ... \| ...; \}; `portionAmount?`: `string`; `portionBips?`: `number`; `portionRecipient?`: `string`; `quoteId?`: `string`; `quoteTimestamp?`: `number`; `swapper?`: `string`; `tradeType?`: `"EXACT_INPUT"` \| `"EXACT_OUTPUT"`; \}

###### post.requestBody.content.application/json.simulateTransaction?

> `optional` **simulateTransaction**: `boolean`

###### post.requestBody.content.application/json.smartContractDelegationAddress?

> `optional` **smartContractDelegationAddress**: `string`

###### post.requestBody.content.application/json.urgency?

> `optional` **urgency**: `"normal"` \| `"fast"` \| `"urgent"`

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.gasFee?

> `optional` **gasFee**: `string`

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.content.application/json.swap

> **swap**: `object`

###### post.responses.200.content.application/json.swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.swap.from

> **from**: `string`

###### post.responses.200.content.application/json.swap.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.swap.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.swap.to

> **to**: `string`

###### post.responses.200.content.application/json.swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /swappable\_tokens

> **/swappable\_tokens**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:184](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L184)

###### delete?

> `optional` **delete**: `undefined`

###### get

> **get**: `object`

Get bridgable tokens

###### Description

Returns the list of destination bridge chains for a given token on a given chain.

###### get.parameters

> **parameters**: `object`

###### get.parameters.cookie?

> `optional` **cookie**: `undefined`

###### get.parameters.header?

> `optional` **header**: `undefined`

###### get.parameters.path?

> `optional` **path**: `undefined`

###### get.parameters.query?

> `optional` **query**: `object`

###### get.parameters.query.tokenIn?

> `optional` **tokenIn**: `string`

###### get.parameters.query.tokenInChainId?

> `optional` **tokenInChainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### get.requestBody?

> `optional` **requestBody**: `undefined`

###### get.responses

> **responses**: `object`

###### get.responses.200

> **200**: `object`

###### get.responses.200.content

> **content**: `object`

###### get.responses.200.content.application/json

> **application/json**: `object`

###### get.responses.200.content.application/json.requestId

> **requestId**: `string`

###### get.responses.200.content.application/json.tokens

> **tokens**: `object`[]

###### get.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.400

> **400**: `object`

###### get.responses.400.content

> **content**: `object`

###### get.responses.400.content.application/json

> **application/json**: `object`

###### get.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### get.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.401

> **401**: `object`

###### get.responses.401.content

> **content**: `object`

###### get.responses.401.content.application/json

> **application/json**: `object`

###### get.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### get.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.404

> **404**: `object`

###### get.responses.404.content

> **content**: `object`

###### get.responses.404.content.application/json

> **application/json**: `object`

###### get.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### get.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.429

> **429**: `object`

###### get.responses.429.content

> **content**: `object`

###### get.responses.429.content.application/json

> **application/json**: `object`

###### get.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### get.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.500

> **500**: `object`

###### get.responses.500.content

> **content**: `object`

###### get.responses.500.content.application/json

> **application/json**: `object`

###### get.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### get.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.504

> **504**: `object`

###### get.responses.504.content

> **content**: `object`

###### get.responses.504.content.application/json

> **application/json**: `object`

###### get.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### get.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post?

> `optional` **post**: `undefined`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /swaps

> **/swaps**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L121)

###### delete?

> `optional` **delete**: `undefined`

###### get

> **get**: `object`

Get swaps status

###### Description

Get the status of a swap or bridge transactions.

###### get.parameters

> **parameters**: `object`

###### get.parameters.cookie?

> `optional` **cookie**: `undefined`

###### get.parameters.header?

> `optional` **header**: `undefined`

###### get.parameters.path?

> `optional` **path**: `undefined`

###### get.parameters.query

> **query**: `object`

###### get.parameters.query.chainId?

> `optional` **chainId**: `1` \| `8453` \| `42161` \| `10` \| `137` \| `56` \| `130` \| `196` \| `324` \| `480` \| `1868` \| `10143` \| `42220` \| `43114` \| `81457` \| `7777777` \| `1301` \| `84532` \| `11155111` \| `143`

###### get.parameters.query.txHashes

> **txHashes**: `string`[]

###### Description

The transaction hashes.

###### get.requestBody?

> `optional` **requestBody**: `undefined`

###### get.responses

> **responses**: `object`

###### get.responses.200

> **200**: `object`

###### get.responses.200.content

> **content**: `object`

###### get.responses.200.content.application/json

> **application/json**: `object`

###### get.responses.200.content.application/json.requestId

> **requestId**: `string`

###### get.responses.200.content.application/json.swaps?

> `optional` **swaps**: `object`[]

###### get.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.400

> **400**: `object`

###### get.responses.400.content

> **content**: `object`

###### get.responses.400.content.application/json

> **application/json**: `object`

###### get.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### get.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.404

> **404**: `object`

###### get.responses.404.content

> **content**: `object`

###### get.responses.404.content.application/json

> **application/json**: `object`

###### get.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### get.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.429

> **429**: `object`

###### get.responses.429.content

> **content**: `object`

###### get.responses.429.content.application/json

> **application/json**: `object`

###### get.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### get.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.500

> **500**: `object`

###### get.responses.500.content

> **content**: `object`

###### get.responses.500.content.application/json

> **application/json**: `object`

###### get.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### get.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### get.responses.504

> **504**: `object`

###### get.responses.504.content

> **content**: `object`

###### get.responses.504.content.application/json

> **application/json**: `object`

###### get.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### get.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### get.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post?

> `optional` **post**: `undefined`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /wallet/check\_delegation

> **/wallet/check\_delegation**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:410](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L410)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Get wallet delegation info

###### Description

Gets the current delegation status and message for a smart contract wallet across different chains. Returns delegation information for each chain ID in the request.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.chainIds

> **chainIds**: (`1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`)[]

###### Description

Array of chain IDs to check delegation status for.

###### post.requestBody.content.application/json.walletAddresses?

> `optional` **walletAddresses**: `string`[]

###### Description

Array of wallet addresses to check delegation status for.

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.delegationDetails

> **delegationDetails**: `object`

###### Index Signature

\[`key`: `string`\]: `object`

###### Description

Map of wallet addresses to chain IDs to delegation details.

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

##### /wallet/encode\_7702

> **/wallet/encode\_7702**: `object`

Defined in: [src/lib/uniswap/generated/tradeApi.ts:390](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L390)

###### delete?

> `optional` **delete**: `undefined`

###### get?

> `optional` **get**: `undefined`

###### head?

> `optional` **head**: `undefined`

###### options?

> `optional` **options**: `undefined`

###### parameters

> **parameters**: `object`

###### parameters.cookie?

> `optional` **cookie**: `undefined`

###### parameters.header?

> `optional` **header**: `undefined`

###### parameters.path?

> `optional` **path**: `undefined`

###### parameters.query?

> `optional` **query**: `undefined`

###### patch?

> `optional` **patch**: `undefined`

###### post

> **post**: `object`

Encode wallet transactions

###### Description

Encodes a list of transactions into a single transaction for smart contract wallet execution. All transactions must have the same chainId.

###### post.parameters

> **parameters**: `object`

###### post.parameters.cookie?

> `optional` **cookie**: `undefined`

###### post.parameters.header?

> `optional` **header**: `undefined`

###### post.parameters.path?

> `optional` **path**: `undefined`

###### post.parameters.query?

> `optional` **query**: `undefined`

###### post.requestBody?

> `optional` **requestBody**: `object`

###### post.requestBody.content

> **content**: `object`

###### post.requestBody.content.application/json

> **application/json**: `object`

###### post.requestBody.content.application/json.calls

> **calls**: `object`[]

###### Description

Array of transaction requests to be encoded. All transactions must have the same chainId.

###### post.requestBody.content.application/json.smartContractDelegationAddress

> **smartContractDelegationAddress**: `string`

###### Description

The address of the smart contract delegation implementation to use.

###### post.requestBody.content.application/json.walletAddress

> **walletAddress**: `string`

###### Description

The address of the wallet for which the transactions will be encoded.

###### post.responses

> **responses**: `object`

###### post.responses.200

> **200**: `object`

###### post.responses.200.content

> **content**: `object`

###### post.responses.200.content.application/json

> **application/json**: `object`

###### post.responses.200.content.application/json.encoded

> **encoded**: `object`

###### post.responses.200.content.application/json.encoded.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### post.responses.200.content.application/json.encoded.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### post.responses.200.content.application/json.encoded.from

> **from**: `string`

###### post.responses.200.content.application/json.encoded.gasLimit?

> `optional` **gasLimit**: `string`

###### post.responses.200.content.application/json.encoded.gasPrice?

> `optional` **gasPrice**: `string`

###### post.responses.200.content.application/json.encoded.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### post.responses.200.content.application/json.encoded.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### post.responses.200.content.application/json.encoded.to

> **to**: `string`

###### post.responses.200.content.application/json.encoded.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

###### post.responses.200.content.application/json.requestId

> **requestId**: `string`

###### post.responses.200.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.400

> **400**: `object`

###### post.responses.400.content

> **content**: `object`

###### post.responses.400.content.application/json

> **application/json**: `object`

###### post.responses.400.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.400.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
RequestValidationError
```

###### post.responses.400.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.401

> **401**: `object`

###### post.responses.401.content

> **content**: `object`

###### post.responses.401.content.application/json

> **application/json**: `object`

###### post.responses.401.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.401.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
UnauthorizedError
```

###### post.responses.401.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.404

> **404**: `object`

###### post.responses.404.content

> **content**: `object`

###### post.responses.404.content.application/json

> **application/json**: `object`

###### post.responses.404.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.404.content.application/json.errorCode?

> `optional` **errorCode**: `"ResourceNotFound"` \| `"QuoteAmountTooLowError"` \| `"TokenBalanceNotAvailable"` \| `"InsufficientBalance"`

###### post.responses.404.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.429

> **429**: `object`

###### post.responses.429.content

> **content**: `object`

###### post.responses.429.content.application/json

> **application/json**: `object`

###### post.responses.429.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.429.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Ratelimited
```

###### post.responses.429.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.500

> **500**: `object`

###### post.responses.500.content

> **content**: `object`

###### post.responses.500.content.application/json

> **application/json**: `object`

###### post.responses.500.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.500.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
InternalServerError
```

###### post.responses.500.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### post.responses.504

> **504**: `object`

###### post.responses.504.content

> **content**: `object`

###### post.responses.504.content.application/json

> **application/json**: `object`

###### post.responses.504.content.application/json.detail?

> `optional` **detail**: `string`

###### post.responses.504.content.application/json.errorCode

> **errorCode**: `string`

###### Default

```ts
Timeout
```

###### post.responses.504.headers

> **headers**: `object`

###### Index Signature

\[`name`: `string`\]: `unknown`

###### put?

> `optional` **put**: `undefined`

###### trace?

> `optional` **trace**: `undefined`

## Type Aliases

### $defs

> **$defs** = `Record`\<`string`, `never`\>

Defined in: [src/lib/uniswap/generated/tradeApi.ts:2321](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L2321)

***

### webhooks

> **webhooks** = `Record`\<`string`, `never`\>

Defined in: [src/lib/uniswap/generated/tradeApi.ts:517](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/generated/tradeApi.ts#L517)
