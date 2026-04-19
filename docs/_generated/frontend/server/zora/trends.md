[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/trends

# server/zora/trends

## Classes

### TrendInsufficientFundsError

Defined in: [server/zora/trends.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L22)

Sentinel error thrown by `reserveTrendTicker` when the agent wallet cannot
cover the trend-deploy gas cost. Callers (`commands.ts`, `_trendReserve.ts`,
`trendLaunchSentinel.ts`) map this to a friendly user refusal. This is
defensive: the underlying fix is Architecture B (smart-wallet UserOperation
routing), tracked in docs/architecture-b-design.md.

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new TrendInsufficientFundsError**(`message`): [`TrendInsufficientFundsError`](#trendinsufficientfundserror)

Defined in: [server/zora/trends.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L24)

###### Parameters

###### message

`string`

###### Returns

[`TrendInsufficientFundsError`](#trendinsufficientfundserror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: `"insufficient_funds"` = `'insufficient_funds'`

Defined in: [server/zora/trends.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L23)

## Type Aliases

### TrendPreflightResult

> **TrendPreflightResult** = `object`

Defined in: [server/zora/trends.ts:45](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L45)

#### Properties

##### deployed

> **deployed**: `boolean`

Defined in: [server/zora/trends.ts:49](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L49)

##### deployedBytecode

> **deployedBytecode**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trends.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L50)

##### predictedAddress

> **predictedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L48)

##### ticker

> **ticker**: `string`

Defined in: [server/zora/trends.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L46)

##### tickerHash

> **tickerHash**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L47)

***

### TrendReserveResult

> **TrendReserveResult** = `object`

Defined in: [server/zora/trends.ts:53](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L53)

#### Properties

##### deployed

> **deployed**: `boolean`

Defined in: [server/zora/trends.ts:58](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L58)

##### deployedAddress

> **deployedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L57)

##### predictedAddress

> **predictedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:56](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L56)

##### status

> **status**: `"already_deployed"` \| `"submitted"` \| `"deployed"`

Defined in: [server/zora/trends.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L62)

##### ticker

> **ticker**: `string`

Defined in: [server/zora/trends.ts:54](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L54)

##### tickerHash

> **tickerHash**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:55](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L55)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/zora/trends.ts:59](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L59)

##### walletAddress

> **walletAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trends.ts:60](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L60)

##### walletId

> **walletId**: `string` \| `null`

Defined in: [server/zora/trends.ts:61](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L61)

***

### TrendValidationResult

> **TrendValidationResult** = \{ `ok`: `true`; `ticker`: `string`; `tickerHash`: `` `0x${string}` ``; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [server/zora/trends.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L41)

## Functions

### normalizeTrendTicker()

> **normalizeTrendTicker**(`input`): `string` \| `null`

Defined in: [server/zora/trends.ts:87](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L87)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### preflightTrendTicker()

> **preflightTrendTicker**(`params`): `Promise`\<[`TrendPreflightResult`](#trendpreflightresult)\>

Defined in: [server/zora/trends.ts:104](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L104)

#### Parameters

##### params

###### ticker

`string`

#### Returns

`Promise`\<[`TrendPreflightResult`](#trendpreflightresult)\>

***

### reserveTrendTicker()

> **reserveTrendTicker**(`params`): `Promise`\<[`TrendReserveResult`](#trendreserveresult)\>

Defined in: [server/zora/trends.ts:133](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L133)

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

Defined in: [server/zora/trends.ts:95](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trends.ts#L95)

#### Parameters

##### input

`string`

#### Returns

[`TrendValidationResult`](#trendvalidationresult)
