[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/ensResolver

# server/\_lib/identity/ensResolver

## Type Aliases

### EnsProfile

> **EnsProfile** = `object`

Defined in: [server/\_lib/identity/ensResolver.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L12)

#### Properties

##### avatar?

> `optional` **avatar**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L15)

##### description?

> `optional` **description**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L17)

##### discord?

> `optional` **discord**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L20)

##### displayName?

> `optional` **displayName**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L16)

##### email?

> `optional` **email**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L21)

##### github?

> `optional` **github**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L19)

##### name

> **name**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L14)

ENS primary name (e.g. "vitalik.eth"). Null if no reverse record.

##### twitter?

> `optional` **twitter**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L18)

##### url?

> `optional` **url**: `string` \| `null`

Defined in: [server/\_lib/identity/ensResolver.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L22)

## Functions

### getEnsName()

> **getEnsName**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/identity/ensResolver.ts:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L44)

Resolve the primary ENS name for an address.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### getEnsProfile()

> **getEnsProfile**(`address`): `Promise`\<[`EnsProfile`](#ensprofile)\>

Defined in: [server/\_lib/identity/ensResolver.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/ensResolver.ts#L59)

Resolve full ENS profile with text records.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`EnsProfile`](#ensprofile)\>
