[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/\_shared

# server/zora/\_shared

## Variables

### DEFAULT\_CHAIN\_ID

> `const` **DEFAULT\_CHAIN\_ID**: `8453` = `8453`

Defined in: [server/zora/\_shared.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L6)

## Functions

### getNumberQuery()

> **getNumberQuery**(`req`, `key`): `number` \| `null`

Defined in: [server/zora/\_shared.ts:50](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L50)

#### Parameters

##### req

`VercelRequest`

##### key

`string`

#### Returns

`number` \| `null`

***

### getStringQuery()

> **getStringQuery**(`req`, `key`): `string` \| `null`

Defined in: [server/zora/\_shared.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L44)

#### Parameters

##### req

`VercelRequest`

##### key

`string`

#### Returns

`string` \| `null`

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/zora/\_shared.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L25)

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

Defined in: [server/zora/\_shared.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L57)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### requireServerKey()

> **requireServerKey**(): `string` \| `null`

Defined in: [server/zora/\_shared.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L38)

#### Returns

`string` \| `null`

***

### setCache()

> **setCache**(`res`, `seconds`): `void`

Defined in: [server/zora/\_shared.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L34)

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

Defined in: [server/zora/\_shared.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L8)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`void`

***

### setPublicCors()

> **setPublicCors**(`res`): `void`

Defined in: [server/zora/\_shared.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/_shared.ts#L19)

Wildcard CORS for fully public, read-only endpoints (token image, token metadata).
These carry no credentials and must be fetchable from any origin — including
Uniswap, DEX aggregators, wallets, and token metadata indexers.

Do NOT use this for authenticated or mutation endpoints.

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`
