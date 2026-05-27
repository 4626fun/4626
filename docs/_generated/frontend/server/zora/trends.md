[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/zora/trends

# server/zora/trends

## Classes

### TrendInsufficientFundsError

Defined in: [server/zora/trends.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L26)

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

Defined in: [server/zora/trends.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L28)

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

Defined in: [server/zora/trends.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L27)

## Type Aliases

### TrendPreflightResult

> **TrendPreflightResult** = `object`

Defined in: [server/zora/trends.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L49)

#### Properties

##### deployed

> **deployed**: `boolean`

Defined in: [server/zora/trends.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L53)

##### deployedBytecode

> **deployedBytecode**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trends.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L54)

##### predictedAddress

> **predictedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L52)

##### ticker

> **ticker**: `string`

Defined in: [server/zora/trends.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L50)

##### tickerHash

> **tickerHash**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L51)

***

### TrendReserveArchBRefusal

> **TrendReserveArchBRefusal** = `object`

Defined in: [server/zora/trends.ts:283](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L283)

Typed refusal surfaced when `reserveTrendTickerViaUserOp` cannot proceed
(TEE attestation denied, factory address mismatch, UserOp submitter
refusal). Callers (`commands.ts`) map `.response` straight to the user.

#### Properties

##### code

> **code**: `"tee_attestation_denied"` \| `"factory_target_mismatch"` \| `"userop_refused"`

Defined in: [server/zora/trends.ts:285](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L285)

##### ok

> **ok**: `false`

Defined in: [server/zora/trends.ts:284](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L284)

##### response

> **response**: `string`

Defined in: [server/zora/trends.ts:289](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L289)

***

### TrendReserveArchBResult

> **TrendReserveArchBResult** = `object` & [`TrendReserveResult`](#trendreserveresult) & `object` \| [`TrendReserveArchBRefusal`](#trendreservearchbrefusal)

Defined in: [server/zora/trends.ts:292](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L292)

***

### TrendReserveResult

> **TrendReserveResult** = `object`

Defined in: [server/zora/trends.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L57)

#### Properties

##### deployed

> **deployed**: `boolean`

Defined in: [server/zora/trends.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L62)

##### deployedAddress

> **deployedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L61)

##### predictedAddress

> **predictedAddress**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L60)

##### status

> **status**: `"already_deployed"` \| `"submitted"` \| `"deployed"`

Defined in: [server/zora/trends.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L66)

##### ticker

> **ticker**: `string`

Defined in: [server/zora/trends.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L58)

##### tickerHash

> **tickerHash**: `` `0x${string}` ``

Defined in: [server/zora/trends.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L59)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/zora/trends.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L63)

##### walletAddress

> **walletAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trends.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L64)

##### walletId

> **walletId**: `string` \| `null`

Defined in: [server/zora/trends.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L65)

***

### TrendValidationResult

> **TrendValidationResult** = \{ `ok`: `true`; `ticker`: `string`; `tickerHash`: `` `0x${string}` ``; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [server/zora/trends.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L45)

## Functions

### normalizeTrendTicker()

> **normalizeTrendTicker**(`input`): `string` \| `null`

Defined in: [server/zora/trends.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L91)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### preflightTrendTicker()

> **preflightTrendTicker**(`params`): `Promise`\<[`TrendPreflightResult`](#trendpreflightresult)\>

Defined in: [server/zora/trends.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L108)

#### Parameters

##### params

###### ticker

`string`

#### Returns

`Promise`\<[`TrendPreflightResult`](#trendpreflightresult)\>

***

### reserveTrendTicker()

> **reserveTrendTicker**(`params`): `Promise`\<[`TrendReserveResult`](#trendreserveresult)\>

Defined in: [server/zora/trends.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L137)

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

### reserveTrendTickerViaUserOp()

> **reserveTrendTickerViaUserOp**(`params`): `Promise`\<[`TrendReserveArchBResult`](#trendreservearchbresult)\>

Defined in: [server/zora/trends.ts:312](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L312)

Route a TrendCoin deploy through the command issuer's Coinbase Smart
Wallet via `submitUserOpOrRefuse` (Phase 4).

Key differences from the legacy agent-EOA path:
- Deployer is the CSW, not a Privy-managed EOA. No agent-wallet funding
  is required.
- Caps + preflight + daily ledger are enforced inside `submitUserOpOrRefuse`.
- No custom idempotency key; the CSW UserOp nonce prevents double-execution.
- TEE attestation is required before the UserOp is built.
- Factory target is re-checked against env/default before dispatch
  (defense in depth against env drift).

#### Parameters

##### params

###### groupId

`string`

###### issuer

[`CommandIssuerContext`](../_lib/wallet/commandIssuerContext.md#commandissuercontext)

###### ticker

`string`

###### waitForReceipt?

`boolean`

#### Returns

`Promise`\<[`TrendReserveArchBResult`](#trendreservearchbresult)\>

***

### validateTrendTicker()

> **validateTrendTicker**(`input`): [`TrendValidationResult`](#trendvalidationresult)

Defined in: [server/zora/trends.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trends.ts#L99)

#### Parameters

##### input

`string`

#### Returns

[`TrendValidationResult`](#trendvalidationresult)
