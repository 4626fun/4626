[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/trust

# server/\_lib/infra/trust

## Functions

### extractPrivyVerifiedEmail()

> **extractPrivyVerifiedEmail**(`user`): `string` \| `null`

Defined in: [server/\_lib/infra/trust.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L88)

#### Parameters

##### user

`unknown`

#### Returns

`string` \| `null`

***

### getTrustedRequestOrigins()

> **getTrustedRequestOrigins**(`req?`): `Set`\<`string`\>

Defined in: [server/\_lib/infra/trust.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L138)

#### Parameters

##### req?

`VercelRequest`

#### Returns

`Set`\<`string`\>

***

### isAddressLike()

> **isAddressLike**(`value`): `` value is `0x${string}` ``

Defined in: [server/\_lib/infra/trust.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L29)

#### Parameters

##### value

`string`

#### Returns

`` value is `0x${string}` ``

***

### isServerAdminAddress()

> **isServerAdminAddress**(`address`): `boolean`

Defined in: [server/\_lib/infra/trust.ts:190](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L190)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### isTrustedRequestOrigin()

> **isTrustedRequestOrigin**(`req`, `origin`): `boolean`

Defined in: [server/\_lib/infra/trust.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L169)

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

Defined in: [server/\_lib/infra/trust.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L33)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### normalizeEmail()

> **normalizeEmail**(`value`): `string` \| `null`

Defined in: [server/\_lib/infra/trust.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L39)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### normalizeOrigin()

> **normalizeOrigin**(`value`): `string` \| `null`

Defined in: [server/\_lib/infra/trust.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L112)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`

***

### readServerAdminAddressSet()

> **readServerAdminAddressSet**(): `Set`\<`string`\>

Defined in: [server/\_lib/infra/trust.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/trust.ts#L175)

#### Returns

`Set`\<`string`\>
