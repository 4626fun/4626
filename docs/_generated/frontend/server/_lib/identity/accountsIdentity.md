[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/identity/accountsIdentity

# server/\_lib/identity/accountsIdentity

## Type Aliases

### AccountLinkProvider

> **AccountLinkProvider** = `"google"` \| `"apple"` \| `"twitter"` \| `"telegram"` \| `"tiktok"` \| `"external_eoa"` \| `"email"` \| `"zora_cross_app"`

Defined in: [server/\_lib/identity/accountsIdentity.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L36)

***

### AccountScore

> **AccountScore** = `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L46)

#### Properties

##### multipliers?

> `optional` **multipliers**: `Record`\<`string`, `number`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L50)

##### points

> **points**: `number`

Defined in: [server/\_lib/identity/accountsIdentity.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L48)

Canonical public points (waitlist, leaderboard, tray, lottery).

##### tier

> **tier**: `number`

Defined in: [server/\_lib/identity/accountsIdentity.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L49)

***

### AccountsMePayload

> **AccountsMePayload** = `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L53)

#### Properties

##### accountSignals

> **accountSignals**: `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L65)

###### baseSubAccount

> **baseSubAccount**: [`BaseSubAccountSummary`](../wallet/executionTrack.md#basesubaccountsummary)

Sub-account status on the user-initiated frontend execution track.
See `docs/4626-connection-methods.md` Section 2.

###### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

###### creatorCoin

> **creatorCoin**: \{ `address`: `string`; \} \| `null`

###### executionTrack

> **executionTrack**: [`ExecutionTrack`](../wallet/executionTrack.md#executiontrack)

Derived execution track. Values: `sub-account`, `legacy-owner-install`,
`migration-pending`, `none-yet`. See `executionTrack.ts` for the
classification rules. Prefer this field over deriving the track from
individual signals on the client.

###### lastResolvedAt

> **lastResolvedAt**: `string` \| `null`

###### linked

> **linked**: `boolean`

###### privyEmbeddedEoaIsOwnerOfCanonicalCsw

> **privyEmbeddedEoaIsOwnerOfCanonicalCsw**: `boolean` \| `null`

Cached legacy-track signal. True iff the Privy embedded EOA is
installed as a direct owner of the parent CSW. Read from
`profile_wallets.privy_is_owner` (populated by
`/api/onboarding/bootstrap`). Null when the cache has not been
primed yet or the account has no canonical CSW.

###### zoraHandle

> **zoraHandle**: `string` \| `null`

##### appAccessStatus

> **appAccessStatus**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L57)

##### baseSubAccount

> **baseSubAccount**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L63)

Raw `profiles.base_sub_account` column. May legitimately mirror the
canonical CSW for legacy accounts; prefer `accountSignals.baseSubAccount`
for distinctness + registration signal.

##### email

> **email**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L55)

##### emailVerified

> **emailVerified**: `boolean`

Defined in: [server/\_lib/identity/accountsIdentity.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L56)

##### linkedMethods

> **linkedMethods**: `Record`\<`string`, `string`[]\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L64)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/identity/accountsIdentity.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L54)

##### score

> **score**: [`AccountScore`](#accountscore)

Defined in: [server/\_lib/identity/accountsIdentity.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L92)

## Functions

### applyPointEvent()

> **applyPointEvent**(`params`): `Promise`\<`PointEventResult`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:527](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L527)

#### Parameters

##### params

###### db

`Db`

###### eventKey

`string`

###### eventType

`string`

###### points

`number`

###### privyUserId

`string`

#### Returns

`Promise`\<`PointEventResult`\>

***

### buildAccountsMePayload()

> **buildAccountsMePayload**(`params`): `Promise`\<[`AccountsMePayload`](#accountsmepayload)\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:868](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L868)

#### Parameters

##### params

###### db

`Db`

###### privyUser?

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike) \| `null`

###### privyUserId

`string`

#### Returns

`Promise`\<[`AccountsMePayload`](#accountsmepayload)\>

***

### deriveLinkedMethodsFromPrivyUser()

> **deriveLinkedMethodsFromPrivyUser**(`user`): `Record`\<`string`, `string`[]\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:316](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L316)

#### Parameters

##### user

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

#### Returns

`Record`\<`string`, `string`[]\>

***

### ensureAccountsIdentitySchema()

> **ensureAccountsIdentitySchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:326](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L326)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### extractZoraCrossAppAccounts()

> **extractZoraCrossAppAccounts**(`user`): `object`[]

Defined in: [server/\_lib/identity/accountsIdentity.ts:296](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L296)

#### Parameters

##### user

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

#### Returns

`object`[]

***

### fetchCreatorCoinSummary()

> **fetchCreatorCoinSummary**(`address`): `Promise`\<`CoinSummary` \| `null`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:686](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L686)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`CoinSummary` \| `null`\>

***

### recordProviderLink()

> **recordProviderLink**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:995](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L995)

#### Parameters

##### params

###### db

`Db`

###### privyUser

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

###### privyUserId

`string`

###### provider

[`AccountLinkProvider`](#accountlinkprovider)

###### value?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### recordProviderUnlink()

> **recordProviderUnlink**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:1071](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L1071)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### provider

[`AccountLinkProvider`](#accountlinkprovider)

###### value?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### removeLinkedMethod()

> **removeLinkedMethod**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:452](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L452)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### type

`string`

###### value?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### resolveAndPersistZoraSignals()

> **resolveAndPersistZoraSignals**(`params`): `Promise`\<`ResolveZoraSignalsResult`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:713](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L713)

#### Parameters

##### params

###### db

`Db`

###### forceRefresh?

`boolean`

###### privyUser

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

###### privyUserId

`string`

###### refreshWindowMs?

`number`

#### Returns

`Promise`\<`ResolveZoraSignalsResult`\>

***

### syncEmailIdentity()

> **syncEmailIdentity**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:661](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L661)

#### Parameters

##### params

###### db

`Db`

###### privyUser

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

###### privyUserId

`string`

#### Returns

`Promise`\<`void`\>

***

### upsertAccount()

> **upsertAccount**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:378](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L378)

#### Parameters

##### params

###### db

`Db`

###### email?

`string` \| `null`

###### emailVerified?

`boolean`

###### privyUserId

`string`

#### Returns

`Promise`\<`void`\>

***

### upsertLinkedMethod()

> **upsertLinkedMethod**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:415](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L415)

#### Parameters

##### params

###### db

`Db`

###### privyUserId

`string`

###### type

`string`

###### value

`string`

###### verified?

`boolean`

#### Returns

`Promise`\<`void`\>

***

### verifyPrivyForAccounts()

> **verifyPrivyForAccounts**(`req`): `Promise`\<`PrivyRequestContext`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:1094](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L1094)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
