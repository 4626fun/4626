[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/trust

# server/\_lib/infra/trust

## Functions

### extractPrivyVerifiedEmail()

> **extractPrivyVerifiedEmail**(`user`): `string` \| `null`

Defined in: [server/\_lib/infra/trust.ts:84](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L84)

#### Parameters

##### user

`unknown`

#### Returns

`string` \| `null`

***

### getTrustedRequestOrigins()

> **getTrustedRequestOrigins**(`req?`): `Set`\<`string`\>

Defined in: [server/\_lib/infra/trust.ts:134](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L134)

#### Parameters

##### req?

`VercelRequest`

#### Returns

`Set`\<`string`\>

***

### isAddressLike()

> **isAddressLike**(`value`): `` value is `0x${string}` ``

Defined in: [server/\_lib/infra/trust.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L25)

#### Parameters

##### value

`string`

#### Returns

`` value is `0x${string}` ``

***

### isServerAdminAddress()

> **isServerAdminAddress**(`address`): `boolean`

Defined in: [server/\_lib/infra/trust.ts:185](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L185)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### isTrustedRequestOrigin()

> **isTrustedRequestOrigin**(`req`, `origin`): `boolean`

Defined in: [server/\_lib/infra/trust.ts:164](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L164)

#### Parameters

##### req

`VercelRequest` | `undefined`

##### origin

`string`

#### Returns

`boolean`

***

### normalizeAddress()

> **normalizeAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/infra/trust.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L29)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### normalizeEmail()

> **normalizeEmail**(`value`): `string` \| `null`

Defined in: [server/\_lib/infra/trust.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L35)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### normalizeOrigin()

> **normalizeOrigin**(`value`): `string` \| `null`

Defined in: [server/\_lib/infra/trust.ts:108](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L108)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`

***

### readServerAdminAddressSet()

> **readServerAdminAddressSet**(): `Set`\<`string`\>

Defined in: [server/\_lib/infra/trust.ts:170](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/trust.ts#L170)

#### Returns

`Set`\<`string`\>
