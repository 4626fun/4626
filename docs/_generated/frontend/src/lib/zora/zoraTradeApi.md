[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/zoraTradeApi

# src/lib/zora/zoraTradeApi

## Type Aliases

### ZoraTradeQuotePayload

> **ZoraTradeQuotePayload** = `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L41)

#### Properties

##### call

> **call**: `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L42)

###### data

> **data**: `string`

###### target

> **target**: `string`

###### value

> **value**: `string`

##### permits?

> `optional` **permits**: [`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

Defined in: [src/lib/zora/zoraTradeApi.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L43)

##### quote?

> `optional` **quote**: `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L44)

###### amountOut?

> `optional` **amountOut**: `string`

###### slippage?

> `optional` **slippage**: `number`

***

### ZoraTradeQuotePermit

> **ZoraTradeQuotePermit** = `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L27)

#### Properties

##### permit

> **permit**: `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L29)

###### details

> **details**: `object`

###### details.amount

> **amount**: `string`

###### details.expiration

> **expiration**: `number`

###### details.nonce

> **nonce**: `number`

###### details.token

> **token**: `string`

###### sigDeadline

> **sigDeadline**: `string`

###### spender

> **spender**: `string`

##### signature

> **signature**: `string`

Defined in: [src/lib/zora/zoraTradeApi.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L28)

## Variables

### ZORA\_PERMIT\_SIGNATURE\_PLACEHOLDER

> `const` **ZORA\_PERMIT\_SIGNATURE\_PLACEHOLDER**: `"REPLACE_WITH_PERMIT_SIGNATURE"` = `'REPLACE_WITH_PERMIT_SIGNATURE'`

Defined in: [src/lib/zora/zoraTradeApi.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L50)

Zora embeds this in calldata and permit.signature until a real Permit2 sig is supplied.

## Functions

### assertZoraRouterCallExecutesFromCsw()

> **assertZoraRouterCallExecutesFromCsw**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/zora/zoraTradeApi.ts:350](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L350)

Production-RPC eth_call: CSW → Zora router (catches stale/malformed route bytes before UserOp submit).

#### Parameters

##### params

###### call

\{ `data`: `string`; `target`: `string`; `value?`: `string` \| `null`; \}

###### call.data

`string`

###### call.target

`string`

###### call.value?

`string` \| `null`

###### executionAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`void`\>

***

### buildSwapFromZoraQuote()

> **buildSwapFromZoraQuote**(`params`): `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:372](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L372)

#### Parameters

##### params

###### chainId

`number`

###### executionAddress

`string`

###### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)

#### Returns

`object`

##### gasFee?

> `optional` **gasFee**: `string`

##### requestId

> **requestId**: `string`

##### swap

> **swap**: `object`

###### swap.chainId

> **chainId**: `1` \| `10` \| `56` \| `130` \| `137` \| `143` \| `196` \| `324` \| `480` \| `1301` \| `1868` \| `8453` \| `10143` \| `42161` \| `42220` \| `43114` \| `81457` \| `84532` \| `7777777` \| `11155111`

###### swap.data

> **data**: `string`

###### Description

The calldata for the transaction.

###### swap.from

> **from**: `string`

###### swap.gasLimit?

> `optional` **gasLimit**: `string`

###### swap.gasPrice?

> `optional` **gasPrice**: `string`

###### swap.maxFeePerGas?

> `optional` **maxFeePerGas**: `string`

###### swap.maxPriorityFeePerGas?

> `optional` **maxPriorityFeePerGas**: `string`

###### swap.to

> **to**: `string`

###### swap.value

> **value**: `string`

###### Description

The quantity of ETH tokens approved for spending by the transaction, denominated in wei. Note that by default Uniswap Labs sets this to the maximum approvable spend.

***

### buildZoraSlippageEscalationLadder()

> **buildZoraSlippageEscalationLadder**(`slippagePct`): `number`[]

Defined in: [src/lib/zora/zoraTradeApi.ts:152](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L152)

Retry simulation with higher slippage when the router reverts (thin pools / stale minOut).

#### Parameters

##### slippagePct

`number`

#### Returns

`number`[]

***

### executeZoraCswQuoteWithEscalation()

> **executeZoraCswQuoteWithEscalation**(`params`): `Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

Defined in: [src/lib/zora/zoraTradeApi.ts:714](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L714)

Sign Permit2, refresh Zora calldata, and production-simulate CSW → router.
Escalates slippage (e.g. 0.5% → 2% → 5%) when simulation fails on thin creator pools.

#### Parameters

##### params

###### amountIn

`string`

###### executionAddress?

`string` \| `null`

###### onStatus?

(`message`) => `void`

###### publicClient

\{ `getBytecode?`: (`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>; `readContract`: (`args`) => `Promise`\<`unknown`\>; \}

###### publicClient.getBytecode?

(`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)

###### sender

`string`

###### signerAddress

`string`

###### slippagePct

`number`

###### tokenIn

`string`

###### tokenOut

`string`

###### walletClient

`ZoraCswWalletClient`

#### Returns

`Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

***

### fetchZoraTradeQuoteFromApi()

> **fetchZoraTradeQuoteFromApi**(`params`): `Promise`\<[`ZoraTradeQuotePayload`](#zoratradequotepayload)\>

Defined in: [src/lib/zora/zoraTradeApi.ts:211](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L211)

#### Parameters

##### params

###### amountIn

`string`

###### sender

`string`

###### signatures?

[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

###### slippagePct

`number`

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

`Promise`\<[`ZoraTradeQuotePayload`](#zoratradequotepayload)\>

***

### formatZoraRouterSimulationFailure()

> **formatZoraRouterSimulationFailure**(`error`): `Error`

Defined in: [src/lib/zora/zoraTradeApi.ts:266](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L266)

Map a production `eth_call` failure from the Zora Universal Router into user-facing copy.

#### Parameters

##### error

`unknown`

#### Returns

`Error`

***

### isDeployedSmartWalletExecutionAddress()

> **isDeployedSmartWalletExecutionAddress**(`executionAddress?`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/zoraTradeApi.ts:538](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L538)

#### Parameters

##### executionAddress?

`string` | `null`

#### Returns

`Promise`\<`boolean`\>

***

### isZoraBundlerSendRetryable()

> **isZoraBundlerSendRetryable**(`error`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L165)

Bundler rejected a UserOp after local Zora eth_call passed — refresh quote and retry once.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isZoraPermitSignaturePlaceholder()

> **isZoraPermitSignaturePlaceholder**(`signature`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L52)

#### Parameters

##### signature

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isZoraProviderQuote()

> **isZoraProviderQuote**(`value`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L79)

#### Parameters

##### value

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse) | `null` | `undefined`

#### Returns

`boolean`

***

### isZoraRouterSimulationRetryable()

> **isZoraRouterSimulationRetryable**(`error`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:188](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L188)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### mergePermitWithChainNonce()

> **mergePermitWithChainNonce**(`permit`, `chainNonce`): `object`

Defined in: [src/lib/zora/zoraTradeApi.ts:473](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L473)

Permit payload sent to Zora must match the typed-data fields we signed (incl. on-chain nonce).

#### Parameters

##### permit

###### details

\{ `amount`: `string`; `expiration`: `number`; `nonce`: `number`; `token`: `string`; \}

###### details.amount

`string`

###### details.expiration

`number`

###### details.nonce

`number`

###### details.token

`string`

###### sigDeadline

`string`

###### spender

`string`

##### chainNonce

`number`

#### Returns

`object`

##### details

> **details**: `object`

###### details.amount

> **amount**: `string`

###### details.expiration

> **expiration**: `number`

###### details.nonce

> **nonce**: `number`

###### details.token

> **token**: `string`

##### sigDeadline

> **sigDeadline**: `string`

##### spender

> **spender**: `string`

***

### normalizeZoraTradeTokenAddress()

> **normalizeZoraTradeTokenAddress**(`address`): `string`

Defined in: [src/lib/zora/zoraTradeApi.ts:415](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L415)

#### Parameters

##### address

`string`

#### Returns

`string`

***

### pickNextZoraBundlerRetrySlippagePct()

> **pickNextZoraBundlerRetrySlippagePct**(`slippagePct`): `number`

Defined in: [src/lib/zora/zoraTradeApi.ts:143](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L143)

Next slippage step after a bundler send failure when prepare-time simulation already passed.

#### Parameters

##### slippagePct

`number`

#### Returns

`number`

***

### prepareZoraQuoteForExecute()

> **prepareZoraQuoteForExecute**(`params`): `Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

Defined in: [src/lib/zora/zoraTradeApi.ts:816](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L816)

Before submitting a Zora swap from a CSW, refresh router calldata and re-sign Permit2 when
the on-chain nonce no longer matches the quote (common after review → confirm delay).

#### Parameters

##### params

###### amountIn

`string`

###### executionAddress?

`string` \| `null`

###### onStatus?

(`message`) => `void`

###### publicClient

\{ `getBytecode?`: (`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>; `readContract`: (`args`) => `Promise`\<`unknown`\>; \}

###### publicClient.getBytecode?

(`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)

###### sender

`string`

###### signerAddress

`string`

###### slippagePct

`number`

###### tokenIn

`string`

###### tokenOut

`string`

###### walletClient

`ZoraCswWalletClient`

#### Returns

`Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

***

### quoteNeedsZoraPermitFinalization()

> **quoteNeedsZoraPermitFinalization**(`quote`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L62)

#### Parameters

##### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse) | `null` | `undefined`

#### Returns

`boolean`

***

### readZoraCallFromQuote()

> **readZoraCallFromQuote**(`quote`): \{ `data`: `string`; `target`: `string`; `value`: `string`; \} \| `null`

Defined in: [src/lib/zora/zoraTradeApi.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L85)

#### Parameters

##### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse) | `null` | `undefined`

#### Returns

\{ `data`: `string`; `target`: `string`; `value`: `string`; \} \| `null`

***

### readZoraPermitsFromQuote()

> **readZoraPermitsFromQuote**(`quote`): [`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

Defined in: [src/lib/zora/zoraTradeApi.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L93)

#### Parameters

##### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse) | `null` | `undefined`

#### Returns

[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

***

### readZoraQuotedSlippagePct()

> **readZoraQuotedSlippagePct**(`quote`): `number` \| `null`

Defined in: [src/lib/zora/zoraTradeApi.ts:134](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L134)

Slippage percent (0.5 = 0.5%) recorded on the last Zora quote refresh, if present.

#### Parameters

##### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse) | `null` | `undefined`

#### Returns

`number` \| `null`

***

### refreshZoraTradeQuoteWithPermits()

> **refreshZoraTradeQuoteWithPermits**(`params`): `Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

Defined in: [src/lib/zora/zoraTradeApi.ts:862](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L862)

#### Parameters

##### params

###### amountIn

`string`

###### sender

`string`

###### signatures

[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

###### slippagePct

`number`

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

`Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

***

### refreshZoraTradeQuoteWithSimulation()

> **refreshZoraTradeQuoteWithSimulation**(`params`): `Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

Defined in: [src/lib/zora/zoraTradeApi.ts:837](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L837)

Refresh Zora router calldata with signed permits, then simulate CSW → router on production Base RPC.

#### Parameters

##### params

###### amountIn

`string`

###### sender

`string`

###### signatures

[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

###### slippagePct

`number`

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

`Promise`\<[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)\>

***

### shouldUseZoraTradeRoute()

> **shouldUseZoraTradeRoute**(`body`, `preferZoraTradeRoute`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:408](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L408)

#### Parameters

##### body

[`TradeQuoteRequest`](../uniswap/tradingApi.md#tradequoterequest)

##### preferZoraTradeRoute

`boolean`

#### Returns

`boolean`

***

### signZoraQuotePermits()

> **signZoraQuotePermits**(`params`): `Promise`\<[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]\>

Defined in: [src/lib/zora/zoraTradeApi.ts:652](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L652)

#### Parameters

##### params

###### executionAddress?

`string` \| `null`

CSW that holds sell tokens and executes the Zora call; required for ERC-20 sells.

###### forceResignPermits?

`boolean`

Re-sign every permit (e.g. CSW submit after a prior personal_sign quote).

###### publicClient

\{ `getBytecode?`: (`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>; `readContract`: (`args`) => `Promise`\<`unknown`\>; \}

###### publicClient.getBytecode?

(`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### quote

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)

###### signerAddress

`string`

Privy embedded EOA (or external signer) that signs Permit2 typed data.

###### walletClient

\{ `request?`: (`args`) => `Promise`\<`unknown`\>; `signMessage?`: (`args`) => `Promise`\<`string`\>; `signTypedData`: (`args`) => `Promise`\<`string`\>; \}

###### walletClient.request?

(`args`) => `Promise`\<`unknown`\>

###### walletClient.signMessage?

(`args`) => `Promise`\<`string`\>

###### walletClient.signTypedData

(`args`) => `Promise`\<`string`\>

#### Returns

`Promise`\<[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]\>

***

### zoraCallDataContainsPermitPlaceholder()

> **zoraCallDataContainsPermitPlaceholder**(`data`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L58)

#### Parameters

##### data

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### zoraPermitNeedsResign()

> **zoraPermitNeedsResign**(`params`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/zoraTradeApi.ts:507](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L507)

True when a CSW-held sell needs a fresh Permit2 signature (placeholder or on-chain nonce drift).

#### Parameters

##### params

###### executionAddress?

`string` \| `null`

###### item

[`ZoraTradeQuotePermit`](#zoratradequotepermit)

###### publicClient

\{ `getBytecode?`: (`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>; `readContract`: (`args`) => `Promise`\<`unknown`\>; \}

###### publicClient.getBytecode?

(`args`) => `Promise`\<`` `0x${string}` `` \| `undefined`\>

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

#### Returns

`Promise`\<`boolean`\>

***

### zoraPermitNonceDrifted()

> **zoraPermitNonceDrifted**(`quotedNonce`, `chainNonce`): `boolean`

Defined in: [src/lib/zora/zoraTradeApi.ts:534](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L534)

#### Parameters

##### quotedNonce

`number`

##### chainNonce

`number`

#### Returns

`boolean`

***

### zoraTradeQuoteToResponse()

> **zoraTradeQuoteToResponse**(`params`): [`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)

Defined in: [src/lib/zora/zoraTradeApi.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/zoraTradeApi.ts#L98)

#### Parameters

##### params

###### amountIn

`string`

###### payload

[`ZoraTradeQuotePayload`](#zoratradequotepayload)

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

[`TradeQuoteResponse`](../uniswap/tradingApi.md#tradequoteresponse)
