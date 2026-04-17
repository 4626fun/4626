[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/canonicalCswDelegation

# server/\_lib/wallet/canonicalCswDelegation

## Type Aliases

### BootstrapDelegationState

> **BootstrapDelegationState** = `object`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L31)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L35)

##### chainId

> **chainId**: `8453`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L32)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L36)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L37)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L34)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L33)

## Functions

### bootstrapCanonicalDelegationState()

> **bootstrapCanonicalDelegationState**(`params`): `Promise`\<[`BootstrapDelegationState`](#bootstrapdelegationstate)\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:531](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L531)

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

> **confirmOwnerState**(`params`): `Promise`\<\{ `canonicalCswAddress`: `string`; `confirmationState`: `"owner_confirmed"` \| `"pending_tx"` \| `"owner_not_found_yet"` \| `"tx_failed"`; `isOwner`: `boolean`; `ownerAddress`: `string`; \}\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:594](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L594)

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

###### txHash?

`string` \| `null`

#### Returns

`Promise`\<\{ `canonicalCswAddress`: `string`; `confirmationState`: `"owner_confirmed"` \| `"pending_tx"` \| `"owner_not_found_yet"` \| `"tx_failed"`; `isOwner`: `boolean`; `ownerAddress`: `string`; \}\>

***

### extractDelegationFlags()

> **extractDelegationFlags**(`error`): `object`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:677](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L677)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:453](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L453)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:348](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L348)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`string`\>

***

### loadCanonicalDelegationState()

> **loadCanonicalDelegationState**(`params`): `Promise`\<`PersistedDelegationState` \| `null`\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:522](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L522)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:368](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L368)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:438](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L438)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:353](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L353)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
