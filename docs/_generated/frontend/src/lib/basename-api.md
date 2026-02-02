[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/basename-api

# src/lib/basename-api

## Interfaces

### BasenameInfo

Defined in: [lib/basename-api.ts:9](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L9)

#### Properties

##### avatar?

> `optional` **avatar**: `string` \| `null`

Defined in: [lib/basename-api.ts:11](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L11)

##### description?

> `optional` **description**: `string` \| `null`

Defined in: [lib/basename-api.ts:13](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L13)

##### discord?

> `optional` **discord**: `string` \| `null`

Defined in: [lib/basename-api.ts:16](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L16)

##### displayName?

> `optional` **displayName**: `string` \| `null`

Defined in: [lib/basename-api.ts:12](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L12)

##### email?

> `optional` **email**: `string` \| `null`

Defined in: [lib/basename-api.ts:17](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L17)

##### github?

> `optional` **github**: `string` \| `null`

Defined in: [lib/basename-api.ts:15](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L15)

##### name

> **name**: `string` \| `null`

Defined in: [lib/basename-api.ts:10](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L10)

##### twitter?

> `optional` **twitter**: `string` \| `null`

Defined in: [lib/basename-api.ts:14](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L14)

##### url?

> `optional` **url**: `string` \| `null`

Defined in: [lib/basename-api.ts:18](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L18)

## Functions

### formatBasename()

> **formatBasename**(`name`): `string`

Defined in: [lib/basename-api.ts:101](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L101)

Format Basename for display (remove .base.eth suffix for cleaner look)

#### Parameters

##### name

`string` | `null`

#### Returns

`string`

***

### getBasename()

> **getBasename**(`address`, `chainId`): `Promise`\<`string` \| `null`\>

Defined in: [lib/basename-api.ts:24](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L24)

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

Defined in: [lib/basename-api.ts:51](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L51)

Get Basename with full profile info

#### Parameters

##### address

`string`

##### chainId

`number` = `base.id`

#### Returns

`Promise`\<[`BasenameInfo`](#basenameinfo)\>

***

### hasBasename()

> **hasBasename**(`address`): `Promise`\<`boolean`\>

Defined in: [lib/basename-api.ts:109](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/basename-api.ts#L109)

Check if address has a Basename

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`boolean`\>
