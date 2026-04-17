[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/accountsIdentity

# server/\_lib/identity/accountsIdentity

## Type Aliases

### AccountLinkProvider

> **AccountLinkProvider** = `"google"` \| `"apple"` \| `"twitter"` \| `"telegram"` \| `"tiktok"` \| `"external_eoa"` \| `"email"` \| `"zora_cross_app"`

Defined in: [server/\_lib/identity/accountsIdentity.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L17)

***

### AccountScore

> **AccountScore** = `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L27)

#### Properties

##### multipliers?

> `optional` **multipliers**: `Record`\<`string`, `number`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L30)

##### points

> **points**: `number`

Defined in: [server/\_lib/identity/accountsIdentity.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L28)

##### tier

> **tier**: `number`

Defined in: [server/\_lib/identity/accountsIdentity.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L29)

***

### AccountsMePayload

> **AccountsMePayload** = `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L33)

#### Properties

##### accountSignals

> **accountSignals**: `object`

Defined in: [server/\_lib/identity/accountsIdentity.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L39)

###### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

###### creatorCoin

> **creatorCoin**: \{ `address`: `string`; \} \| `null`

###### lastResolvedAt

> **lastResolvedAt**: `string` \| `null`

###### linked

> **linked**: `boolean`

###### zoraHandle

> **zoraHandle**: `string` \| `null`

##### appAccessStatus

> **appAccessStatus**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L37)

##### email

> **email**: `string` \| `null`

Defined in: [server/\_lib/identity/accountsIdentity.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L35)

##### emailVerified

> **emailVerified**: `boolean`

Defined in: [server/\_lib/identity/accountsIdentity.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L36)

##### linkedMethods

> **linkedMethods**: `Record`\<`string`, `string`[]\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L38)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/identity/accountsIdentity.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L34)

##### score

> **score**: [`AccountScore`](#accountscore)

Defined in: [server/\_lib/identity/accountsIdentity.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L46)

## Functions

### applyPointEvent()

> **applyPointEvent**(`params`): `Promise`\<`PointEventResult`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:516](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L516)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:828](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L828)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:272](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L272)

#### Parameters

##### user

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

#### Returns

`Record`\<`string`, `string`[]\>

***

### ensureAccountsIdentitySchema()

> **ensureAccountsIdentitySchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:282](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L282)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### extractZoraCrossAppAccounts()

> **extractZoraCrossAppAccounts**(`user`): `object`[]

Defined in: [server/\_lib/identity/accountsIdentity.ts:252](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L252)

#### Parameters

##### user

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

#### Returns

`object`[]

***

### fetchCreatorCoinSummary()

> **fetchCreatorCoinSummary**(`address`): `Promise`\<`CoinSummary` \| `null`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:653](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L653)

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`CoinSummary` \| `null`\>

***

### recordProviderLink()

> **recordProviderLink**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/accountsIdentity.ts:896](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L896)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:972](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L972)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:408](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L408)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:680](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L680)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:628](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L628)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:334](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L334)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:371](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L371)

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

Defined in: [server/\_lib/identity/accountsIdentity.ts:995](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/accountsIdentity.ts#L995)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Promise`\<`PrivyRequestContext`\>
