[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/trends

# server/zora/trends

## Type Aliases

### TrendPreflightResult

> **TrendPreflightResult** = `object`

Defined in: [server/zora/trends.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L24)

#### Properties

##### deployed

> **deployed**: `boolean`

Defined in: [server/zora/trends.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L28)

##### deployedBytecode

> **deployedBytecode**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trends.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L29)

##### predictedAddress

> **predictedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L27)

##### ticker

> **ticker**: `string`

Defined in: [server/zora/trends.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L25)

##### tickerHash

> **tickerHash**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L26)

***

### TrendReserveResult

> **TrendReserveResult** = `object`

Defined in: [server/zora/trends.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L32)

#### Properties

##### deployed

> **deployed**: `boolean`

Defined in: [server/zora/trends.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L37)

##### deployedAddress

> **deployedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L36)

##### predictedAddress

> **predictedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L35)

##### status

> **status**: `"already_deployed"` \| `"submitted"` \| `"deployed"`

Defined in: [server/zora/trends.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L41)

##### ticker

> **ticker**: `string`

Defined in: [server/zora/trends.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L33)

##### tickerHash

> **tickerHash**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L34)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/zora/trends.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L38)

##### walletAddress

> **walletAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trends.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L39)

##### walletId

> **walletId**: `string` \| `null`

Defined in: [server/zora/trends.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L40)

***

### TrendValidationResult

> **TrendValidationResult** = \{ `ok`: `true`; `ticker`: `string`; `tickerHash`: `` `0x${string}` ``; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [server/zora/trends.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L20)

## Functions

### normalizeTrendTicker()

> **normalizeTrendTicker**(`input`): `string` \| `null`

Defined in: [server/zora/trends.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L66)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### preflightTrendTicker()

> **preflightTrendTicker**(`params`): `Promise`\<[`TrendPreflightResult`](#trendpreflightresult)\>

Defined in: [server/zora/trends.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L83)

#### Parameters

##### params

###### ticker

`string`

#### Returns

`Promise`\<[`TrendPreflightResult`](#trendpreflightresult)\>

***

### reserveTrendTicker()

> **reserveTrendTicker**(`params`): `Promise`\<[`TrendReserveResult`](#trendreserveresult)\>

Defined in: [server/zora/trends.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L112)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### groupId

`string`

###### ticker

`string`

###### waitForReceipt?

`boolean`

#### Returns

`Promise`\<[`TrendReserveResult`](#trendreserveresult)\>

***

### validateTrendTicker()

> **validateTrendTicker**(`input`): [`TrendValidationResult`](#trendvalidationresult)

Defined in: [server/zora/trends.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/zora/trends.ts#L74)

#### Parameters

##### input

`string`

#### Returns

[`TrendValidationResult`](#trendvalidationresult)
