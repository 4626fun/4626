[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/uniswap/swapQuoteSanitize

# src/lib/uniswap/swapQuoteSanitize

## Functions

### coerceSwapTransactionValue()

> **coerceSwapTransactionValue**(`value`): `string`

Defined in: [src/lib/uniswap/swapQuoteSanitize.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapQuoteSanitize.ts#L67)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### normalizeSwapApiResponsePayload()

> **normalizeSwapApiResponsePayload**(`payload`): `unknown`

Defined in: [src/lib/uniswap/swapQuoteSanitize.ts:177](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapQuoteSanitize.ts#L177)

#### Parameters

##### payload

`unknown`

#### Returns

`unknown`

***

### normalizeSwapTransactionRecord()

> **normalizeSwapTransactionRecord**(`tx`): `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/swapQuoteSanitize.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapQuoteSanitize.ts#L96)

#### Parameters

##### tx

`Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

***

### sanitizeClassicQuoteForSwap()

> **sanitizeClassicQuoteForSwap**(`quote`): `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/swapQuoteSanitize.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapQuoteSanitize.ts#L145)

#### Parameters

##### quote

`Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

***

### sanitizeCreateSwapRequestPayload()

> **sanitizeCreateSwapRequestPayload**(`body`): `Record`\<`string`, `unknown`\>

Defined in: [src/lib/uniswap/swapQuoteSanitize.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/swapQuoteSanitize.ts#L165)

#### Parameters

##### body

`Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>
