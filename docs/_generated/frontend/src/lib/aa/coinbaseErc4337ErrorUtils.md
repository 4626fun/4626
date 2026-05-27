[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/coinbaseErc4337ErrorUtils

# src/lib/aa/coinbaseErc4337ErrorUtils

## Functions

### classifyUserOpErrorCode()

> **classifyUserOpErrorCode**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L47)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### ensureUserOperationSucceeded()

> **ensureUserOperationSucceeded**(`receipt`, `context`): `void`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:144](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L144)

#### Parameters

##### receipt

`unknown`

##### context

`string`

#### Returns

`void`

***

### extractRevertInfo()

> **extractRevertInfo**(`e`): `object`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L59)

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

### formatMetaMessages()

> **formatMetaMessages**(`error`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:248](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L248)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### getErrorDiagnosticMessage()

> **getErrorDiagnosticMessage**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L91)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### getRpcErrorDetails()

> **getRpcErrorDetails**(`error`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L136)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### isAccountNonceMismatchError()

> **isAccountNonceMismatchError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L30)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isExpectedUserOpTimeoutError()

> **isExpectedUserOpTimeoutError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:267](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L267)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isImmediateUserOpRetrySuppressedError()

> **isImmediateUserOpRetrySuppressedError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:220](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L220)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isLikelyVerificationGasLimitError()

> **isLikelyVerificationGasLimitError**(`message`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L81)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isPaymasterAuthPolicyError()

> **isPaymasterAuthPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:231](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L231)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterPolicyError()

> **isPaymasterPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:195](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L195)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterRoutingPolicyError()

> **isPaymasterRoutingPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:242](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L242)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterStakeError()

> **isPaymasterStakeError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:168](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L168)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterUnavailableError()

> **isPaymasterUnavailableError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:179](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L179)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isRpcRateLimitError()

> **isRpcRateLimitError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L35)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
