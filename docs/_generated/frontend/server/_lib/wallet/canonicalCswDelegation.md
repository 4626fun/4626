[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/canonicalCswDelegation

# server/\_lib/wallet/canonicalCswDelegation

## Type Aliases

### BootstrapDelegationState

> **BootstrapDelegationState** = `object`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:37](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L37)

#### Properties

##### baseSubAccount

> **baseSubAccount**: [`BaseSubAccountSummary`](executionTrack.md#basesubaccountsummary)

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L44)

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L41)

##### chainId

> **chainId**: `8453`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:38](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L38)

##### executionTrack

> **executionTrack**: [`ExecutionTrack`](executionTrack.md#executiontrack)

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L45)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:42](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L42)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:43](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L43)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:40](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L40)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L39)

## Functions

### bootstrapCanonicalDelegationState()

> **bootstrapCanonicalDelegationState**(`params`): `Promise`\<[`BootstrapDelegationState`](#bootstrapdelegationstate)\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:539](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L539)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:624](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L624)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:707](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L707)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:461](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L461)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:356](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L356)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`string`\>

***

### loadCanonicalDelegationState()

> **loadCanonicalDelegationState**(`params`): `Promise`\<`PersistedDelegationState` \| `null`\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:530](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L530)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:376](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L376)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:446](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L446)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:361](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L361)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
