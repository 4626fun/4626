[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/canonicalWalletResolver

# server/\_lib/wallet/canonicalWalletResolver

## Type Aliases

### PersistedWalletIdentity

> **PersistedWalletIdentity** = `object`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L28)

#### Properties

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L30)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L31)

##### privyUserId

> **privyUserId**: `string` \| `null`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L32)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L29)

***

### ProfileWalletAuthority

> **ProfileWalletAuthority** = `object`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L35)

#### Properties

##### activeOwnerWalletAddress

> **activeOwnerWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L38)

##### canonicalSmartWalletAddress

> **canonicalSmartWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L37)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L36)

## Functions

### isAuthorizedWalletForProfile()

> **isAuthorizedWalletForProfile**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L125)

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

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L105)

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

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L146)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`ProfileWalletAuthority`](#profilewalletauthority) \| `null`\>

***

### resolveCanonicalSmartWalletAddress()

> **resolveCanonicalSmartWalletAddress**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:357](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L357)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolvePersistedWalletIdentity()

> **resolvePersistedWalletIdentity**(`address`): `Promise`\<[`PersistedWalletIdentity`](#persistedwalletidentity) \| `null`\>

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:306](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L306)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`PersistedWalletIdentity`](#persistedwalletidentity) \| `null`\>

***

### resolvePersistedWalletIdentityForProfileId()

> **resolvePersistedWalletIdentityForProfileId**(`profileId`): `Promise`\<[`PersistedWalletIdentity`](#persistedwalletidentity) \| `null`\>

Defined in: [server/\_lib/wallet/canonicalWalletResolver.ts:325](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalWalletResolver.ts#L325)

#### Parameters

##### profileId

`number`

#### Returns

`Promise`\<[`PersistedWalletIdentity`](#persistedwalletidentity) \| `null`\>
