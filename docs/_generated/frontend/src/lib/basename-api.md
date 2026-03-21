[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/basename-api

# src/lib/basename-api

## Interfaces

### BasenameInfo

Defined in: [src/lib/basename-api.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L11)

#### Properties

##### avatar?

> `optional` **avatar**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L13)

##### description?

> `optional` **description**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:15](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L15)

##### discord?

> `optional` **discord**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:18](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L18)

##### displayName?

> `optional` **displayName**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L14)

##### email?

> `optional` **email**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:19](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L19)

##### github?

> `optional` **github**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:17](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L17)

##### name

> **name**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:12](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L12)

##### twitter?

> `optional` **twitter**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L16)

##### url?

> `optional` **url**: `string` \| `null`

Defined in: [src/lib/basename-api.ts:20](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L20)

## Functions

### formatBasename()

> **formatBasename**(`name`): `string`

Defined in: [src/lib/basename-api.ts:567](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L567)

Format Basename for display (remove .base.eth suffix for cleaner look)

#### Parameters

##### name

`string` | `null`

#### Returns

`string`

***

### getBasename()

> **getBasename**(`address`, `chainId`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/basename-api.ts:296](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L296)

Get Basename for an address

#### Parameters

##### address

`string`

##### chainId

`number` = `base.id`

#### Returns

`Promise`\<`string` \| `null`\>

***

### getBasenameProfile()

> **getBasenameProfile**(`address`, `chainId`): `Promise`\<[`BasenameInfo`](#basenameinfo)\>

Defined in: [src/lib/basename-api.ts:426](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L426)

Get Basename with full profile info

#### Parameters

##### address

`string`

##### chainId

`number` = `base.id`

#### Returns

`Promise`\<[`BasenameInfo`](#basenameinfo)\>

***

### getBasenameProfileByName()

> **getBasenameProfileByName**(`input`): `Promise`\<[`BasenameInfo`](#basenameinfo)\>

Defined in: [src/lib/basename-api.ts:502](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L502)

Get Basename profile info directly from a basename handle.
Accepts "akita", "@akita", or "akita.base.eth".

#### Parameters

##### input

`string`

#### Returns

`Promise`\<[`BasenameInfo`](#basenameinfo)\>

***

### hasBasename()

> **hasBasename**(`address`): `Promise`\<`boolean`\>

Defined in: [src/lib/basename-api.ts:575](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L575)

Check if address has a Basename

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`boolean`\>

***

### isExpectedBasenameLookupError()

> **isExpectedBasenameLookupError**(`error`): `boolean`

Defined in: [src/lib/basename-api.ts:246](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L246)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### resolveBasenameAddress()

> **resolveBasenameAddress**(`input`, `chainId`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/basename-api.ts:372](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/basename-api.ts#L372)

Resolve a Basename handle (or full basename) to an EVM address.
Accepts:
- "akita"
- "@akita"
- "akita.base.eth"
- "0x..." (passes through normalized checksum)

#### Parameters

##### input

`string`

##### chainId

`number` = `base.id`

#### Returns

`Promise`\<`string` \| `null`\>
