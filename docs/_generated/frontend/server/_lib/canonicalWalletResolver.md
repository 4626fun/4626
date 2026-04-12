[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/canonicalWalletResolver

# server/\_lib/canonicalWalletResolver

## Type Aliases

### PersistedWalletIdentity

> **PersistedWalletIdentity** = `object`

Defined in: [server/\_lib/canonicalWalletResolver.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L28)

#### Properties

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/canonicalWalletResolver.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L30)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/canonicalWalletResolver.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L31)

##### privyUserId

> **privyUserId**: `string` \| `null`

Defined in: [server/\_lib/canonicalWalletResolver.ts:32](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L32)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/canonicalWalletResolver.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L29)

***

### ProfileWalletAuthority

> **ProfileWalletAuthority** = `object`

Defined in: [server/\_lib/canonicalWalletResolver.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L35)

#### Properties

##### activeOwnerWalletAddress

> **activeOwnerWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/canonicalWalletResolver.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L38)

##### canonicalSmartWalletAddress

> **canonicalSmartWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/canonicalWalletResolver.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L37)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/canonicalWalletResolver.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L36)

## Functions

### isAuthorizedWalletForProfile()

> **isAuthorizedWalletForProfile**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/canonicalWalletResolver.ts:119](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L119)

#### Parameters

##### params

###### address

`string`

###### allowActiveOwner?

`boolean`

###### allowCanonical?

`boolean`

###### db

\{ `sql`: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `any`[]; \}\>; \}

###### db.sql

(`strings`, ...`values`) => `Promise`\<\{ `rows`: `any`[]; \}\>

###### profileId

`number`

#### Returns

`Promise`\<`boolean`\>

***

### readProfileWalletAuthority()

> **readProfileWalletAuthority**(`params`): `Promise`\<[`ProfileWalletAuthority`](#profilewalletauthority) \| `null`\>

Defined in: [server/\_lib/canonicalWalletResolver.ts:99](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L99)

#### Parameters

##### params

###### db

\{ `sql`: (`strings`, ...`values`) => `Promise`\<\{ `rows`: `any`[]; \}\>; \}

###### db.sql

(`strings`, ...`values`) => `Promise`\<\{ `rows`: `any`[]; \}\>

###### profileId

`number`

#### Returns

`Promise`\<[`ProfileWalletAuthority`](#profilewalletauthority) \| `null`\>

***

### resolveAuthorizedWalletProfile()

> **resolveAuthorizedWalletProfile**(`address`): `Promise`\<[`ProfileWalletAuthority`](#profilewalletauthority) \| `null`\>

Defined in: [server/\_lib/canonicalWalletResolver.ts:140](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L140)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`ProfileWalletAuthority`](#profilewalletauthority) \| `null`\>

***

### resolveCanonicalSmartWalletAddress()

> **resolveCanonicalSmartWalletAddress**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/canonicalWalletResolver.ts:268](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L268)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolvePersistedWalletIdentity()

> **resolvePersistedWalletIdentity**(`address`): `Promise`\<[`PersistedWalletIdentity`](#persistedwalletidentity) \| `null`\>

Defined in: [server/\_lib/canonicalWalletResolver.ts:249](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/canonicalWalletResolver.ts#L249)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`PersistedWalletIdentity`](#persistedwalletidentity) \| `null`\>
