[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/zoraTradeQuote

# server/\_lib/zora/zoraTradeQuote

## Type Aliases

### ZoraTradeCurrency

> **ZoraTradeCurrency** = \{ `type`: `"eth"`; \} \| \{ `address`: `string`; `type`: `"erc20"`; \}

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L7)

***

### ZoraTradeQuoteCall

> **ZoraTradeQuoteCall** = `object`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L11)

#### Properties

##### data

> **data**: `string`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L13)

##### target

> **target**: `string`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L12)

##### value

> **value**: `string`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L14)

***

### ZoraTradeQuotePermit

> **ZoraTradeQuotePermit** = `object`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L17)

#### Properties

##### permit

> **permit**: `object`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L19)

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

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L18)

***

### ZoraTradeQuoteResult

> **ZoraTradeQuoteResult** = `object`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L31)

#### Properties

##### call

> **call**: [`ZoraTradeQuoteCall`](#zoratradequotecall)

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L32)

##### permits?

> `optional` **permits**: [`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L33)

##### quote?

> `optional` **quote**: `object`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L34)

###### amountOut?

> `optional` **amountOut**: `string`

###### slippage?

> `optional` **slippage**: `number`

###### tokenIn?

> `optional` **tokenIn**: `object`

###### tokenIn.address?

> `optional` **address**: `string`

###### tokenIn.type?

> `optional` **type**: `string`

## Functions

### fetchZoraTradeQuote()

> **fetchZoraTradeQuote**(`params`): `Promise`\<[`ZoraTradeQuoteResult`](#zoratradequoteresult)\>

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L60)

#### Parameters

##### params

###### amountIn

`string`

###### sender

`string`

###### signatures?

[`ZoraTradeQuotePermit`](#zoratradequotepermit)[]

###### slippage?

`number`

###### tokenIn

`string`

###### tokenOut

`string`

#### Returns

`Promise`\<[`ZoraTradeQuoteResult`](#zoratradequoteresult)\>

***

### getZoraPlatformReferrerAddress()

> **getZoraPlatformReferrerAddress**(): `string` \| `undefined`

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L41)

#### Returns

`string` \| `undefined`

***

### toZoraTradeCurrency()

> **toZoraTradeCurrency**(`tokenAddress`): [`ZoraTradeCurrency`](#zoratradecurrency)

Defined in: [server/\_lib/zora/zoraTradeQuote.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/zoraTradeQuote.ts#L51)

#### Parameters

##### tokenAddress

`string`

#### Returns

[`ZoraTradeCurrency`](#zoratradecurrency)
