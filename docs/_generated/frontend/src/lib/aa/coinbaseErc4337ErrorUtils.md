[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/aa/coinbaseErc4337ErrorUtils

# src/lib/aa/coinbaseErc4337ErrorUtils

## Functions

### classifyUserOpErrorCode()

> **classifyUserOpErrorCode**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L29)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### ensureUserOperationSucceeded()

> **ensureUserOperationSucceeded**(`receipt`, `context`): `void`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L125)

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

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L40)

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

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:218](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L218)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### getErrorDiagnosticMessage()

> **getErrorDiagnosticMessage**(`error`): `string`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L72)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### getRpcErrorDetails()

> **getRpcErrorDetails**(`error`): `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L117)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### isExpectedUserOpTimeoutError()

> **isExpectedUserOpTimeoutError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:237](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L237)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isLikelyVerificationGasLimitError()

> **isLikelyVerificationGasLimitError**(`message`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L62)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isPaymasterAuthPolicyError()

> **isPaymasterAuthPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:201](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L201)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterPolicyError()

> **isPaymasterPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:176](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L176)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterRoutingPolicyError()

> **isPaymasterRoutingPolicyError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:212](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L212)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterStakeError()

> **isPaymasterStakeError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:149](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L149)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPaymasterUnavailableError()

> **isPaymasterUnavailableError**(`error`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337ErrorUtils.ts:160](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337ErrorUtils.ts#L160)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
