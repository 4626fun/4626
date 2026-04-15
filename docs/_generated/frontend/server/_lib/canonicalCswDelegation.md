[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/canonicalCswDelegation

# server/\_lib/canonicalCswDelegation

## Type Aliases

### BootstrapDelegationState

> **BootstrapDelegationState** = `object`

Defined in: [server/\_lib/canonicalCswDelegation.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L31)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [server/\_lib/canonicalCswDelegation.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L35)

##### chainId

> **chainId**: `8453`

Defined in: [server/\_lib/canonicalCswDelegation.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L32)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [server/\_lib/canonicalCswDelegation.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L36)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [server/\_lib/canonicalCswDelegation.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L37)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/canonicalCswDelegation.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L34)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/canonicalCswDelegation.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L33)

## Functions

### bootstrapCanonicalDelegationState()

> **bootstrapCanonicalDelegationState**(`params`): `Promise`\<[`BootstrapDelegationState`](#bootstrapdelegationstate)\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:505](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L505)

#### Parameters

##### params

###### db

`Db`

###### req

`VercelRequest`

#### Returns

`Promise`\<[`BootstrapDelegationState`](#bootstrapdelegationstate)\>

***

### confirmOwnerState()

> **confirmOwnerState**(`params`): `Promise`\<\{ `canonicalCswAddress`: `string`; `isOwner`: `boolean`; `ownerAddress`: `string`; \}\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:568](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L568)

#### Parameters

##### params

###### cswAddress?

`string` \| `null`

###### db

`Db`

###### ownerAddress?

`string` \| `null`

###### req

`VercelRequest`

#### Returns

`Promise`\<\{ `canonicalCswAddress`: `string`; `isOwner`: `boolean`; `ownerAddress`: `string`; \}\>

***

### extractDelegationFlags()

> **extractDelegationFlags**(`error`): `object`

Defined in: [server/\_lib/canonicalCswDelegation.ts:637](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L637)

#### Parameters

##### error

`unknown`

#### Returns

`object`

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

***

### getPrivyEmbeddedEOA()

> **getPrivyEmbeddedEOA**(`params`): `Promise`\<`string`\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:452](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L452)

#### Parameters

##### params

###### db

`Db`

###### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

###### profileId

`number`

#### Returns

`Promise`\<`string`\>

***

### getPrivyUserIdFromRequest()

> **getPrivyUserIdFromRequest**(`req`): `Promise`\<`string`\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:347](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L347)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`string`\>

***

### loadCanonicalDelegationState()

> **loadCanonicalDelegationState**(`params`): `Promise`\<`PersistedDelegationState` \| `null`\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:496](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L496)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

#### Returns

`Promise`\<`PersistedDelegationState` \| `null`\>

***

### resolveCanonicalCsw()

> **resolveCanonicalCsw**(`params`): `Promise`\<\{ `canonicalCswAddress`: `string`; `canonicalSource`: `string`; `profileId`: `number`; \}\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:367](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L367)

#### Parameters

##### params

###### db

`Db`

###### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

###### privyUserId

`string`

#### Returns

`Promise`\<\{ `canonicalCswAddress`: `string`; `canonicalSource`: `string`; `profileId`: `number`; \}\>

***

### resolveConfirmOwnerCanonicalCsw()

> **resolveConfirmOwnerCanonicalCsw**(`params`): `string`

Defined in: [server/\_lib/canonicalCswDelegation.ts:437](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L437)

#### Parameters

##### params

###### persistedCanonicalCswAddress

`string`

###### requestedCswAddress?

`string` \| `null`

#### Returns

`string`

***

### verifyPrivyRequest()

> **verifyPrivyRequest**(`req`): `Promise`\<`PrivyRequestContext`\>

Defined in: [server/\_lib/canonicalCswDelegation.ts:352](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/canonicalCswDelegation.ts#L352)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
