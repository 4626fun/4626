[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/aa/coinbaseErc4337ErrorUtils

# src/lib/aa/coinbaseErc4337ErrorUtils

## Functions

### classifyUserOpErrorCode()

> **classifyUserOpErrorCode**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L30)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### ensureUserOperationSucceeded()

> **ensureUserOperationSucceeded**(`receipt`, `context`): `void`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:126](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L126)

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

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L41)

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

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:230](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L230)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### getErrorDiagnosticMessage()

> **getErrorDiagnosticMessage**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L73)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### getRpcErrorDetails()

> **getRpcErrorDetails**(`error`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L118)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### isExpectedUserOpTimeoutError()

> **isExpectedUserOpTimeoutError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:249](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L249)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isImmediateUserOpRetrySuppressedError()

> **isImmediateUserOpRetrySuppressedError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:202](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L202)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isLikelyVerificationGasLimitError()

> **isLikelyVerificationGasLimitError**(`message`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L63)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isPaymasterAuthPolicyError()

> **isPaymasterAuthPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:213](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L213)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterPolicyError()

> **isPaymasterPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:177](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L177)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterRoutingPolicyError()

> **isPaymasterRoutingPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:224](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L224)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterStakeError()

> **isPaymasterStakeError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:150](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L150)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterUnavailableError()

> **isPaymasterUnavailableError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:161](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L161)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
