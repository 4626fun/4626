[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lens/lensGrove

# server/\_lib/lens/lensGrove

## Type Aliases

### GroveSigner

> **GroveSigner** = `object`

Defined in: [server/\_lib/lens/lensGrove.ts:212](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L212)

Signer for mutable Grove operations (matches the SDK's `Signer` interface).

#### Properties

##### address

> **address**: `HexAddress`

Defined in: [server/\_lib/lens/lensGrove.ts:214](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L214)

##### signMessage()

> **signMessage**: (`args`) => `Promise`\<`string`\>

Defined in: [server/\_lib/lens/lensGrove.ts:213](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L213)

###### Parameters

###### args

###### message

`string`

###### Returns

`Promise`\<`string`\>

***

### GroveUploadAttempt

> **GroveUploadAttempt** = \{ `ok`: `true`; `result`: [`GroveUploadResult`](#groveuploadresult); \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [server/\_lib/lens/lensGrove.ts:91](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L91)

***

### GroveUploadResult

> **GroveUploadResult** = `object`

Defined in: [server/\_lib/lens/lensGrove.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L45)

#### Properties

##### gatewayUrl

> **gatewayUrl**: `string`

Defined in: [server/\_lib/lens/lensGrove.ts:47](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L47)

##### lensUri

> **lensUri**: `string`

Defined in: [server/\_lib/lens/lensGrove.ts:48](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L48)

##### statusUrl

> **statusUrl**: `string` \| `null`

Defined in: [server/\_lib/lens/lensGrove.ts:49](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L49)

##### storageKey

> **storageKey**: `string`

Defined in: [server/\_lib/lens/lensGrove.ts:46](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L46)

***

### MutableAclType

> **MutableAclType** = `"wallet"` \| `"lensAccount"`

Defined in: [server/\_lib/lens/lensGrove.ts:151](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L151)

## Variables

### BASE\_CHAIN\_ID

> `const` **BASE\_CHAIN\_ID**: `8453` = `8453`

Defined in: [server/\_lib/lens/lensGrove.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L11)

***

### LENS\_MAINNET\_CHAIN\_ID

> `const` **LENS\_MAINNET\_CHAIN\_ID**: `232` = `232`

Defined in: [server/\_lib/lens/lensGrove.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L10)

## Functions

### getGroveChainId()

> **getGroveChainId**(): `number`

Defined in: [server/\_lib/lens/lensGrove.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L17)

Returns the configured Grove chain ID from the environment.
Defaults to Lens Mainnet (232). Set `GROVE_CHAIN_ID=8453` for Base-specific data.

#### Returns

`number`

***

### getStorageClient()

> **getStorageClient**(): `StorageClient`

Defined in: [server/\_lib/lens/lensGrove.ts:32](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L32)

#### Returns

`StorageClient`

***

### resolveLensUri()

> **resolveLensUri**(`uri`): `string`

Defined in: [server/\_lib/lens/lensGrove.ts:275](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L275)

#### Parameters

##### uri

`string`

#### Returns

`string`

***

### tryUploadImmutableFile()

> **tryUploadImmutableFile**(`file`, `chainId`): `Promise`\<[`GroveUploadAttempt`](#groveuploadattempt)\>

Defined in: [server/\_lib/lens/lensGrove.ts:127](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L127)

Try to upload a file to Grove with one automatic retry.
Returns `{ ok: true, result }` on success or `{ ok: false, error }` on
failure — never throws.

#### Parameters

##### file

`File`

##### chainId

`number` = `LENS_MAINNET_CHAIN_ID`

#### Returns

`Promise`\<[`GroveUploadAttempt`](#groveuploadattempt)\>

***

### tryUploadImmutableJson()

> **tryUploadImmutableJson**(`data`, `chainId`): `Promise`\<[`GroveUploadAttempt`](#groveuploadattempt)\>

Defined in: [server/\_lib/lens/lensGrove.ts:100](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L100)

Try to upload JSON to Grove with one automatic retry.
Returns `{ ok: true, result }` on success or `{ ok: false, error }` on
failure — never throws.

#### Parameters

##### data

`unknown`

##### chainId

`number` = `LENS_MAINNET_CHAIN_ID`

#### Returns

`Promise`\<[`GroveUploadAttempt`](#groveuploadattempt)\>

***

### tryUploadMutableJson()

> **tryUploadMutableJson**(`data`, `opts`): `Promise`\<[`GroveUploadAttempt`](#groveuploadattempt)\>

Defined in: [server/\_lib/lens/lensGrove.ts:247](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L247)

Graceful mutable JSON upload — retry once, return null on failure.

#### Parameters

##### data

`unknown`

##### opts

###### aclType

[`MutableAclType`](#mutableacltype)

###### address

`string`

###### chainId?

`number`

#### Returns

`Promise`\<[`GroveUploadAttempt`](#groveuploadattempt)\>

***

### updateMutableJson()

> **updateMutableJson**(`storageKey`, `data`, `signer`, `opts`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [server/\_lib/lens/lensGrove.ts:223](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L223)

Update existing mutable JSON content on Grove.

Requires the storage key from a previous mutable upload, the new data,
a signer that matches the original ACL, and the ACL for the updated content.

#### Parameters

##### storageKey

`string`

##### data

`unknown`

##### signer

[`GroveSigner`](#grovesigner)

##### opts

###### aclType

[`MutableAclType`](#mutableacltype)

###### address

`string`

###### chainId?

`number`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

***

### uploadImmutableFile()

> **uploadImmutableFile**(`file`, `chainId`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [server/\_lib/lens/lensGrove.ts:78](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L78)

#### Parameters

##### file

`File`

##### chainId

`number` = `LENS_MAINNET_CHAIN_ID`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

***

### uploadImmutableJson()

> **uploadImmutableJson**(`data`, `chainId`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [server/\_lib/lens/lensGrove.ts:65](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L65)

#### Parameters

##### data

`unknown`

##### chainId

`number` = `LENS_MAINNET_CHAIN_ID`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

***

### uploadMutableFile()

> **uploadMutableFile**(`file`, `opts`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [server/\_lib/lens/lensGrove.ts:190](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L190)

Upload a file to Grove with a mutable ACL.

#### Parameters

##### file

`File`

##### opts

###### aclType

[`MutableAclType`](#mutableacltype)

###### address

`string`

###### chainId?

`number`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

***

### uploadMutableJson()

> **uploadMutableJson**(`data`, `opts`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [server/\_lib/lens/lensGrove.ts:168](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/lens/lensGrove.ts#L168)

Upload JSON to Grove with a mutable ACL.

- `wallet` ACL: only the specified wallet address can update/delete.
- `lensAccount` ACL: only the specified Lens account can update/delete.

Use for content that changes over time: agent metadata, creator profiles,
vault configuration, etc.

#### Parameters

##### data

`unknown`

##### opts

###### aclType

[`MutableAclType`](#mutableacltype)

###### address

`string`

###### chainId?

`number`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>
