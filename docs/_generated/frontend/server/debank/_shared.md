[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/debank/\_shared

# server/debank/\_shared

## Functions

### getStringQuery()

> **getStringQuery**(`req`, `key`): `string` \| `null`

Defined in: [server/debank/\_shared.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L29)

#### Parameters

##### req

`VercelRequest`

##### key

`string`

#### Returns

`string` \| `null`

***

### getTrustedClientIp()

> **getTrustedClientIp**(`req`): `string`

Defined in: [server/debank/\_shared.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L58)

Resolve the client IP using trusted proxy headers first.

Production uses provider-populated headers (`x-vercel-forwarded-for`, `x-real-ip`).
We intentionally avoid untrusted `x-forwarded-for` in production to prevent easy
rate-limit key spoofing. Local dev can still fall back to `x-forwarded-for`.

#### Parameters

##### req

`VercelRequest`

#### Returns

`string`

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/debank/\_shared.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L10)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`boolean`

***

### isAddressLike()

> **isAddressLike**(`value`): `boolean`

Defined in: [server/debank/\_shared.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L35)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### requireDebankAccessKey()

> **requireDebankAccessKey**(): `string` \| `null`

Defined in: [server/debank/\_shared.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L23)

#### Returns

`string` \| `null`

***

### setCache()

> **setCache**(`res`, `seconds`): `void`

Defined in: [server/debank/\_shared.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L19)

#### Parameters

##### res

`VercelResponse`

##### seconds

`number` = `300`

#### Returns

`void`

***

### setCors()

> **setCors**(`req`, `res`): `void`

Defined in: [server/debank/\_shared.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/debank/_shared.ts#L6)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`void`
