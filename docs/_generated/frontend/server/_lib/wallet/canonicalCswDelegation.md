[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/canonicalCswDelegation

# server/\_lib/wallet/canonicalCswDelegation

## Type Aliases

### BootstrapDelegationState

> **BootstrapDelegationState** = `object`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L47)

#### Properties

##### baseSubAccount

> **baseSubAccount**: [`BaseSubAccountSummary`](executionTrack.md#basesubaccountsummary)

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L54)

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L51)

##### chainId

> **chainId**: `8453`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L48)

##### executionTrack

> **executionTrack**: [`ExecutionTrack`](executionTrack.md#executiontrack)

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L55)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L52)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L53)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L50)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L49)

## Functions

### bootstrapCanonicalDelegationState()

> **bootstrapCanonicalDelegationState**(`params`): `Promise`\<[`BootstrapDelegationState`](#bootstrapdelegationstate)\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:665](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L665)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:769](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L769)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:852](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L852)

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

### getBaseRpcUrls()

> **getBaseRpcUrls**(): `string`[]

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L130)

#### Returns

`string`[]

***

### getPrivyEmbeddedEOA()

> **getPrivyEmbeddedEOA**(`params`): `Promise`\<`string`\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:572](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L572)

#### Parameters

##### params

###### baseSubAccountAddress?

`string` \| `null`

###### canonicalCswAddress?

`string` \| `null`

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:414](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L414)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`string`\>

***

### loadCanonicalDelegationState()

> **loadCanonicalDelegationState**(`params`): `Promise`\<`PersistedDelegationState` \| `null`\>

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:656](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L656)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:434](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L434)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:539](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L539)

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

Defined in: [server/\_lib/wallet/canonicalCswDelegation.ts:419](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/canonicalCswDelegation.ts#L419)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
