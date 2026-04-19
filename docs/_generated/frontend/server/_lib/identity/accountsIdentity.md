[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/accountsIdentity

# server/\_lib/identity/accountsIdentity

## Type Aliases

### AccountLinkProvider

> **AccountLinkProvider** = `"google"` \| `"apple"` \| `"twitter"` \| `"telegram"` \| `"tiktok"` \| `"external_eoa"` \| `"email"` \| `"zora_cross_app"`

Defined in: [server/\_lib/identity/accountsIdentity.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L26)

***

### AccountScore

> **AccountScore** = `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L36)

#### Properties

##### multipliers?

> `optional` **multipliers**: `Record`\<`string`, `number`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L39)

##### points

> **points**: `number`

Defined in: [server/\_lib/identity/accountsIdentity.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L37)

##### tier

> **tier**: `number`

Defined in: [server/\_lib/identity/accountsIdentity.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L38)

***

### AccountsMePayload

> **AccountsMePayload** = `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L42)

#### Properties

##### accountSignals

> **accountSignals**: `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L54)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L46)

##### baseSubAccount

> **baseSubAccount**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L52)

Raw `profiles.base_sub_account` column. May legitimately mirror the
canonical CSW for legacy accounts; prefer `accountSignals.baseSubAccount`
for distinctness + registration signal.

##### email

> **email**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L44)

##### emailVerified

> **emailVerified**: `boolean`

Defined in: [server/\_lib/identity/accountsIdentity.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L45)

##### linkedMethods

> **linkedMethods**: `Record`\<`string`, `string`[]\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L53)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/identity/accountsIdentity.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L43)

##### score

> **score**: [`AccountScore`](#accountscore)

Defined in: [server/\_lib/identity/accountsIdentity.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L81)

## Functions

### applyPointEvent()

> **applyPointEvent**(`params`): `Promise`\<`PointEventResult`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:601](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L601)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:935](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L935)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:312](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L312)

#### Parameters

##### user

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

#### Returns

`Record`\<`string`, `string`[]\>

***

### ensureAccountsIdentitySchema()

> **ensureAccountsIdentitySchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:322](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L322)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### extractZoraCrossAppAccounts()

> **extractZoraCrossAppAccounts**(`user`): `object`[]

Defined in: [server/\_lib/identity/accountsIdentity.ts:292](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L292)

#### Parameters

##### user

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

#### Returns

`object`[]

***

### fetchCreatorCoinSummary()

> **fetchCreatorCoinSummary**(`address`): `Promise`\<`CoinSummary` \| `null`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:760](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L760)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`CoinSummary` \| `null`\>

***

### recordProviderLink()

> **recordProviderLink**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:1023](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L1023)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:1099](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L1099)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:448](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L448)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:787](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L787)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:735](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L735)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:374](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L374)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:411](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L411)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:1122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L1122)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
