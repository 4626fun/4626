[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/coinbaseErc4337Signature

# src/lib/aa/coinbaseErc4337Signature

## Functions

### ensureSignatureHex()

> **ensureSignatureHex**(`value`, `context`, `onExtracted?`): `` `0x${string}` ``

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L65)

#### Parameters

##### value

`unknown`

##### context

`string`

##### onExtracted?

(`signature`, `source`) => `void`

#### Returns

`` `0x${string}` ``

***

### extractSignatureHex()

> **extractSignatureHex**(`value`, `depth`): `SignatureExtraction`

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L32)

#### Parameters

##### value

`unknown`

##### depth

`number` = `0`

#### Returns

`SignatureExtraction`

***

### getHexByteLength()

> **getHexByteLength**(`hex`): `number` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L9)

#### Parameters

##### hex

`string`

#### Returns

`number` \| `null`

***

### isHexString()

> **isHexString**(`value`): `` value is `0x${string}` ``

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L5)

#### Parameters

##### value

`unknown`

#### Returns

`` value is `0x${string}` ``

***

### isUserOpHashLike()

> **isUserOpHashLike**(`value`): `boolean`

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L26)

#### Parameters

##### value

`unknown`

#### Returns

`boolean`

***

### runSignatureExtractionHarness()

> **runSignatureExtractionHarness**(): (\{ `byteLength`: `null`; `name`: `string`; `ok`: `boolean`; `signatureLength`: `null`; `source`: `string` \| `null`; \} \| \{ `byteLength`: `number` \| `null`; `name`: `string`; `ok`: `boolean`; `signatureLength`: `number`; `source`: `string` \| `null`; \})[]

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L78)

#### Returns

(\{ `byteLength`: `null`; `name`: `string`; `ok`: `boolean`; `signatureLength`: `null`; `source`: `string` \| `null`; \} \| \{ `byteLength`: `number` \| `null`; `name`: `string`; `ok`: `boolean`; `signatureLength`: `number`; `source`: `string` \| `null`; \})[]

***

### signatureMeta()

> **signatureMeta**(`signature`): `object`

Defined in: [src/lib/aa/coinbaseErc4337Signature.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Signature.ts#L16)

#### Parameters

##### signature

`` `0x${string}` ``

#### Returns

`object`

##### byteLength

> **byteLength**: `number` \| `null`

##### is64Bytes

> **is64Bytes**: `boolean`

##### is65Bytes

> **is65Bytes**: `boolean`

##### signatureLength

> **signatureLength**: `number` = `signature.length`
