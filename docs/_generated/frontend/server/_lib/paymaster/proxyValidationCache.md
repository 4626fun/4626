[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/paymaster/proxyValidationCache

# server/\_lib/paymaster/proxyValidationCache

## Variables

### PAYMASTER\_PROXY\_VALIDATION\_CACHE\_MS

> `const` **PAYMASTER\_PROXY\_VALIDATION\_CACHE\_MS**: `45000` = `45_000`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L4)

Shared TTL for paymaster proxy validation caches (swap, ownership, allowlist).

## Functions

### clearProxyValidationCachesForTests()

> **clearProxyValidationCachesForTests**(): `void`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L100)

Test-only: clears in-memory caches between vitest cases.

#### Returns

`void`

***

### readSessionAllowlistCache()

> **readSessionAllowlistCache**(`key`): `boolean`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L91)

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### readSessionOwnershipCache()

> **readSessionOwnershipCache**(`key`): `boolean`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L78)

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### readSponsoredSwapValidationCache()

> **readSponsoredSwapValidationCache**(`sender`, `callData`): `SponsoredSwapValidationCacheEntry` \| `null`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L40)

#### Parameters

##### sender

`string`

##### callData

`` `0x${string}` ``

#### Returns

`SponsoredSwapValidationCacheEntry` \| `null`

***

### sessionAllowlistCacheKey()

> **sessionAllowlistCacheKey**(`sessionAddress`, `creatorToken`): `string`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L86)

#### Parameters

##### sessionAddress

`string`

##### creatorToken

`string` | `null` | `undefined`

#### Returns

`string`

***

### sessionOwnershipCacheKey()

> **sessionOwnershipCacheKey**(`params`): `string`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L66)

#### Parameters

##### params

###### initCode

`` `0x${string}` `` \| `null`

###### sender

`string`

###### sessionAddress

`string`

#### Returns

`string`

***

### sponsoredSwapValidationCacheKey()

> **sponsoredSwapValidationCacheKey**(`sender`, `callData`): `string`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L36)

#### Parameters

##### sender

`string`

##### callData

`` `0x${string}` ``

#### Returns

`string`

***

### writeSessionAllowlistCache()

> **writeSessionAllowlistCache**(`key`): `void`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L95)

#### Parameters

##### key

`string`

#### Returns

`void`

***

### writeSessionOwnershipCache()

> **writeSessionOwnershipCache**(`key`): `void`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L82)

#### Parameters

##### key

`string`

#### Returns

`void`

***

### writeSponsoredSwapValidationCache()

> **writeSponsoredSwapValidationCache**(`sender`, `callData`, `validated`): `void`

Defined in: [server/\_lib/paymaster/proxyValidationCache.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/paymaster/proxyValidationCache.ts#L53)

#### Parameters

##### sender

`string`

##### callData

`` `0x${string}` ``

##### validated

###### expectedCreatorToken?

`string` \| `null`

###### mode

`string`

#### Returns

`void`
