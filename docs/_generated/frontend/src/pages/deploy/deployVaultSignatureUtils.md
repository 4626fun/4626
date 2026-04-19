[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/deploy/deployVaultSignatureUtils

# src/pages/deploy/deployVaultSignatureUtils

## Type Aliases

### SignatureExtraction

> **SignatureExtraction** = `object`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L46)

#### Properties

##### signature

> **signature**: `Hex` \| `null`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L46)

##### source

> **source**: `string` \| `null`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L46)

***

### SignatureMeta

> **SignatureMeta** = `object`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L18)

#### Properties

##### byteLength

> **byteLength**: `number` \| `null`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L20)

##### is64Bytes

> **is64Bytes**: `boolean`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L21)

##### is65Bytes

> **is65Bytes**: `boolean`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L22)

##### signatureLength

> **signatureLength**: `number`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L19)

## Functions

### debugSignatureReady()

> **debugSignatureReady**(`context`, `signature`, `details?`): `void`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:95](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L95)

#### Parameters

##### context

`string`

##### signature

`` `0x${string}` ``

##### details?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### ensureSignatureHex()

> **ensureSignatureHex**(`value`, `context`): `` `0x${string}` ``

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:81](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L81)

#### Parameters

##### value

`unknown`

##### context

`string`

#### Returns

`` `0x${string}` ``

***

### errorMessage()

> **errorMessage**(`error`): `string`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:120](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L120)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### extractSignatureHex()

> **extractSignatureHex**(`value`, `depth`): [`SignatureExtraction`](#signatureextraction)

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L48)

#### Parameters

##### value

`unknown`

##### depth

`number` = `0`

#### Returns

[`SignatureExtraction`](#signatureextraction)

***

### isTransientRpcFailure()

> **isTransientRpcFailure**(`error`): `boolean`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:125](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L125)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isUserRejectedErrorMessage()

> **isUserRejectedErrorMessage**(`error`): `boolean`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:108](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L108)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### logNonEoaSignature()

> **logNonEoaSignature**(`signature`, `context`): [`SignatureMeta`](#signaturemeta)

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L35)

#### Parameters

##### signature

`` `0x${string}` ``

##### context

`string`

#### Returns

[`SignatureMeta`](#signaturemeta)

***

### setAaDebugMode()

> **setAaDebugMode**(`enabled`): `void`

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:14](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L14)

Host component calls this once at init to route debug logs through the shared logger.

#### Parameters

##### enabled

`boolean`

#### Returns

`void`

***

### signatureMeta()

> **signatureMeta**(`signature`): [`SignatureMeta`](#signaturemeta)

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L25)

#### Parameters

##### signature

`` `0x${string}` ``

#### Returns

[`SignatureMeta`](#signaturemeta)

***

### withTimeout()

> **withTimeout**\<`T`\>(`promise`, `ms`, `label`): `Promise`\<`T`\>

Defined in: [src/pages/deploy/deployVaultSignatureUtils.ts:148](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/deploy/deployVaultSignatureUtils.ts#L148)

#### Type Parameters

##### T

`T`

#### Parameters

##### promise

`Promise`\<`T`\>

##### ms

`number`

##### label

`string`

#### Returns

`Promise`\<`T`\>
