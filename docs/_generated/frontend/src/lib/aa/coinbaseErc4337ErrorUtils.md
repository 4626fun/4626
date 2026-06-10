[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/coinbaseErc4337ErrorUtils

# src/lib/aa/coinbaseErc4337ErrorUtils

## Classes

### PreflightSimulationRejectionError

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:432](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L432)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new PreflightSimulationRejectionError**(`message?`): [`PreflightSimulationRejectionError`](#preflightsimulationrejectionerror)

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1082

###### Parameters

###### message?

`string`

###### Returns

[`PreflightSimulationRejectionError`](#preflightsimulationrejectionerror)

###### Inherited from

`Error.constructor`

##### Constructor

> **new PreflightSimulationRejectionError**(`message?`, `options?`): [`PreflightSimulationRejectionError`](#preflightsimulationrejectionerror)

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1082

###### Parameters

###### message?

`string`

###### options?

`ErrorOptions`

###### Returns

[`PreflightSimulationRejectionError`](#preflightsimulationrejectionerror)

###### Inherited from

`Error.constructor`

#### Properties

##### name

> `readonly` **name**: `"PreflightSimulationRejectionError"` = `'PreflightSimulationRejectionError'`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:433](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L433)

###### Overrides

`Error.name`

## Functions

### buildPreflightSimulationRejectionError()

> **buildPreflightSimulationRejectionError**(`params`): `Error`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:529](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L529)

#### Parameters

##### params

###### firstCallTo?

`string`

###### simResult

\{ `directCallResult?`: \{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; \}; `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; \}

###### simResult.directCallResult?

\{ `error?`: `string`; `errorName?`: `string`; `revertData?`: `` `0x${string}` ``; \}

###### simResult.directCallResult.error?

`string`

###### simResult.directCallResult.errorName?

`string`

###### simResult.directCallResult.revertData?

`` `0x${string}` ``

###### simResult.error?

`string`

###### simResult.errorName?

`string`

###### simResult.revertData?

`` `0x${string}` ``

#### Returns

`Error`

***

### buildUserOpGasEstimateFailureError()

> **buildUserOpGasEstimateFailureError**(`error`, `firstCallTo?`): `Error`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:397](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L397)

#### Parameters

##### error

`unknown`

##### firstCallTo?

`string`

#### Returns

`Error`

***

### classifyUserOpErrorCode()

> **classifyUserOpErrorCode**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L64)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### ensureUserOperationSucceeded()

> **ensureUserOperationSucceeded**(`receipt`, `context`): `void`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:221](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L221)

#### Parameters

##### receipt

`unknown`

##### context

`string`

#### Returns

`void`

***

### extractExecutionFailedInnerSelector()

> **extractExecutionFailedInnerSelector**(`revertData?`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:503](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L503)

#### Parameters

##### revertData?

`` `0x${string}` ``

#### Returns

`string` \| `null`

***

### extractRevertInfo()

> **extractRevertInfo**(`e`): `object`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:137](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L137)

#### Parameters

##### e

`unknown`

#### Returns

`object`

##### error

> **error**: `string`

##### errorName?

> `optional` **errorName**: `string`

##### revertData?

> `optional` **revertData**: `` `0x${string}` ``

***

### extractUserOpReceiptTxHash()

> **extractUserOpReceiptTxHash**(`receipt`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L6)

Bundlers vary receipt shape — read tx hash from nested or top-level fields.

#### Parameters

##### receipt

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### formatMetaMessages()

> **formatMetaMessages**(`error`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:590](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L590)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### getErrorDiagnosticMessage()

> **getErrorDiagnosticMessage**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:168](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L168)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### getRpcErrorDetails()

> **getRpcErrorDetails**(`error`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:213](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L213)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### isAccountNonceMismatchError()

> **isAccountNonceMismatchError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L47)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isActionableBundlerSimulationRevert()

> **isActionableBundlerSimulationRevert**(`revertData`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:358](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L358)

#### Parameters

##### revertData

`` `0x${string}` `` | `undefined`

#### Returns

`boolean`

***

### isDeterministicUserOpExecutionError()

> **isDeterministicUserOpExecutionError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:309](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L309)

Bundler/EntryPoint failures that will not succeed on immediate retry.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isEchoedBundlerUserOpCallData()

> **isEchoedBundlerUserOpCallData**(`revertData`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:353](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L353)

Long `0xb61d27f6…` payloads are echoed callData, not a decodable on-chain revert.

#### Parameters

##### revertData

`` `0x${string}` `` | `undefined`

#### Returns

`boolean`

***

### isExecutionRevertedLikeError()

> **isExecutionRevertedLikeError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:325](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L325)

Broad match for bundler/RPC errors that will not succeed on immediate retry.

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isExpectedUserOpTimeoutError()

> **isExpectedUserOpTimeoutError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:609](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L609)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isImmediateUserOpRetrySuppressedError()

> **isImmediateUserOpRetrySuppressedError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:297](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L297)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isLikelyVerificationGasLimitError()

> **isLikelyVerificationGasLimitError**(`message`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:158](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L158)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isPaymasterAuthPolicyError()

> **isPaymasterAuthPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:573](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L573)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterPolicyError()

> **isPaymasterPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:272](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L272)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterRoutingPolicyError()

> **isPaymasterRoutingPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:584](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L584)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterStakeError()

> **isPaymasterStakeError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:245](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L245)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterUnavailableError()

> **isPaymasterUnavailableError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:256](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L256)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPreflightSimulationRejection()

> **isPreflightSimulationRejection**(`error`): `error is PreflightSimulationRejectionError`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:436](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L436)

#### Parameters

##### error

`unknown`

#### Returns

`error is PreflightSimulationRejectionError`

***

### isRpcInvalidParametersEstimateError()

> **isRpcInvalidParametersEstimateError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:365](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L365)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isRpcRateLimitError()

> **isRpcRateLimitError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L52)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### mapUserOpExecutionFailureMessage()

> **mapUserOpExecutionFailureMessage**(`error`, `context?`): `Error` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:475](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L475)

#### Parameters

##### error

`unknown`

##### context?

###### firstCallTo?

`string`

#### Returns

`Error` \| `null`

***

### parseUserOpGasLimitField()

> **parseUserOpGasLimitField**(`value`): `bigint` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:440](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L440)

#### Parameters

##### value

`unknown`

#### Returns

`bigint` \| `null`

***

### resolveUserOpCallGasLimit()

> **resolveUserOpCallGasLimit**(`params`): `bigint` \| `undefined`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:457](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L457)

Prefer bundler-estimated call gas (buffered) over a static Zora floor when both exist.

#### Parameters

##### params

###### bufferDenominator?

`bigint`

###### bufferNumerator?

`bigint`

###### estimatedCallGasLimit?

`bigint` \| `null`

###### floorCallGasLimit?

`bigint` \| `null`

#### Returns

`bigint` \| `undefined`

***

### shouldAdvisorySkipBundlerGasEstimate()

> **shouldAdvisorySkipBundlerGasEstimate**(`params`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:375](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L375)

Bundler gas estimate can fail while eth_call preflight still passes (stub sig, paymaster stub, state drift).
When a Zora floor callGasLimit is configured, proceed with that floor only for non-actionable estimate noise
(invalid RPC params + echoed UserOp callData). Real execution reverts must block send.

#### Parameters

##### params

###### error

`unknown`

###### firstCallTo?

`string`

###### floorCallGasLimit?

`bigint` \| `null`

#### Returns

`boolean`
