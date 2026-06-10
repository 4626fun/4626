[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/accountSetup/types

# src/features/accountSetup/types

## Type Aliases

### AccountCreatorCoin

> **AccountCreatorCoin** = `object`

Defined in: [src/features/accountSetup/types.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L17)

#### Properties

##### address

> **address**: `string`

Defined in: [src/features/accountSetup/types.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L18)

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L21)

##### name?

> `optional` **name**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L19)

##### symbol?

> `optional` **symbol**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L20)

***

### AccountLinkProvider

> **AccountLinkProvider** = `"google"` \| `"apple"` \| `"twitter"` \| `"telegram"` \| `"tiktok"` \| `"external_eoa"` \| `"email"` \| `"zora_cross_app"`

Defined in: [src/features/accountSetup/types.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L1)

***

### AccountScore

> **AccountScore** = `object`

Defined in: [src/features/accountSetup/types.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L11)

#### Properties

##### points

> **points**: `number`

Defined in: [src/features/accountSetup/types.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L13)

Public points total (leaderboard, tiers, tray, waitlist, lottery).

##### tier

> **tier**: `number`

Defined in: [src/features/accountSetup/types.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L14)

***

### AccountSetupInitialData

> **AccountSetupInitialData** = `object`

Defined in: [src/features/accountSetup/types.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L61)

#### Properties

##### me

> **me**: [`AccountSetupMe`](#accountsetupme)

Defined in: [src/features/accountSetup/types.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L62)

##### zoraStatus

> **zoraStatus**: [`ZoraLinkStatusResponse`](#zoralinkstatusresponse) \| `null`

Defined in: [src/features/accountSetup/types.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L63)

***

### AccountSetupMe

> **AccountSetupMe** = `object`

Defined in: [src/features/accountSetup/types.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L39)

#### Properties

##### accountSignals

> **accountSignals**: [`AccountSignals`](#accountsignals-1)

Defined in: [src/features/accountSetup/types.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L46)

##### appAccessStatus

> **appAccessStatus**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L43)

##### baseSubAccount

> **baseSubAccount**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L44)

##### email

> **email**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L41)

##### emailVerified

> **emailVerified**: `boolean`

Defined in: [src/features/accountSetup/types.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L42)

##### linkedMethods

> **linkedMethods**: `Record`\<`string`, `string`[]\>

Defined in: [src/features/accountSetup/types.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L45)

##### privyUserId

> **privyUserId**: `string`

Defined in: [src/features/accountSetup/types.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L40)

##### score

> **score**: [`AccountScore`](#accountscore)

Defined in: [src/features/accountSetup/types.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L47)

***

### AccountSignals

> **AccountSignals** = `object`

Defined in: [src/features/accountSetup/types.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L24)

#### Properties

##### baseSubAccount

> **baseSubAccount**: `object`

Defined in: [src/features/accountSetup/types.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L27)

###### address

> **address**: `string` \| `null`

###### isDistinctFromCsw

> **isDistinctFromCsw**: `boolean`

###### registered

> **registered**: `boolean`

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L26)

##### creatorCoin

> **creatorCoin**: [`AccountCreatorCoin`](#accountcreatorcoin) \| `null`

Defined in: [src/features/accountSetup/types.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L34)

##### executionTrack

> **executionTrack**: `"sub-account"` \| `"legacy-owner-install"` \| `"migration-pending"` \| `"none-yet"`

Defined in: [src/features/accountSetup/types.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L32)

##### lastResolvedAt

> **lastResolvedAt**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L36)

##### linked

> **linked**: `boolean`

Defined in: [src/features/accountSetup/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L25)

##### privyEmbeddedEoaIsOwnerOfCanonicalCsw

> **privyEmbeddedEoaIsOwnerOfCanonicalCsw**: `boolean` \| `null`

Defined in: [src/features/accountSetup/types.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L33)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L35)

***

### ConnectedOwnerState

> **ConnectedOwnerState** = `object`

Defined in: [src/features/accountSetup/types.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L110)

#### Properties

##### reason

> **reason**: `"idle"` \| `"ok"` \| `"network_mismatch"` \| `"missing_params"` \| `"read_failed"` \| `"passkey_requires_base_app"` \| `"csw_not_owner_signer"`

Defined in: [src/features/accountSetup/types.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L112)

##### value

> **value**: `boolean` \| `null`

Defined in: [src/features/accountSetup/types.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L111)

***

### CswOwnersState

> **CswOwnersState** = `object`

Defined in: [src/features/accountSetup/types.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L122)

#### Properties

##### error

> **error**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L125)

##### owners

> **owners**: [`SmartWalletOwnersResponse`](#smartwalletownersresponse)\[`"owners"`\]

Defined in: [src/features/accountSetup/types.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L124)

##### status

> **status**: `"idle"` \| `"loading"` \| `"ready"` \| `"error"`

Defined in: [src/features/accountSetup/types.ts:123](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L123)

***

### OwnerAuthorityState

> **OwnerAuthorityState** = `object`

Defined in: [src/features/accountSetup/types.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L78)

#### Properties

##### badgeClass

> **badgeClass**: `string`

Defined in: [src/features/accountSetup/types.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L90)

##### detail

> **detail**: `string`

Defined in: [src/features/accountSetup/types.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L89)

##### hint

> **hint**: `string`

Defined in: [src/features/accountSetup/types.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L88)

##### label

> **label**: `string`

Defined in: [src/features/accountSetup/types.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L87)

##### phase

> **phase**: `"blocked"` \| `"canonical_wallet"` \| `"owner_connected"` \| `"needs_base"` \| `"check_wallet"` \| `"wrong_wallet"` \| `"needs_wallet"`

Defined in: [src/features/accountSetup/types.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L79)

***

### OwnerChecklistItem

> **OwnerChecklistItem** = `object`

Defined in: [src/features/accountSetup/types.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L93)

#### Properties

##### description

> **description**: `string`

Defined in: [src/features/accountSetup/types.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L95)

##### state

> **state**: `"complete"` \| `"active"` \| `"blocked"`

Defined in: [src/features/accountSetup/types.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L96)

##### title

> **title**: `string`

Defined in: [src/features/accountSetup/types.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L94)

***

### OwnerInstallResumeState

> **OwnerInstallResumeState** = `object`

Defined in: [src/features/accountSetup/types.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L99)

#### Properties

##### requested

> **requested**: `boolean`

Defined in: [src/features/accountSetup/types.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L100)

##### source

> **source**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L101)

***

### ProviderRow

> **ProviderRow** = `object`

Defined in: [src/features/accountSetup/types.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L104)

#### Properties

##### hint

> **hint**: `string`

Defined in: [src/features/accountSetup/types.ts:107](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L107)

##### label

> **label**: `string`

Defined in: [src/features/accountSetup/types.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L106)

##### provider

> **provider**: [`AccountLinkProvider`](#accountlinkprovider)

Defined in: [src/features/accountSetup/types.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L105)

***

### SmartWalletOwnersResponse

> **SmartWalletOwnersResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L66)

#### Properties

##### nextOwnerIndex

> **nextOwnerIndex**: `number` \| `null`

Defined in: [src/features/accountSetup/types.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L69)

##### ownerCount

> **ownerCount**: `number`

Defined in: [src/features/accountSetup/types.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L68)

##### owners

> **owners**: `object`[]

Defined in: [src/features/accountSetup/types.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L70)

###### index

> **index**: `number`

###### isAddressOwner

> **isAddressOwner**: `boolean`

###### ownerAddress

> **ownerAddress**: `` `0x${string}` `` \| `null`

###### ownerBytes

> **ownerBytes**: `` `0x${string}` ``

##### smartWallet

> **smartWallet**: `` `0x${string}` ``

Defined in: [src/features/accountSetup/types.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L67)

***

### ZoraLinkStatusResponse

> **ZoraLinkStatusResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L50)

#### Properties

##### zoraCrossAppAccounts

> **zoraCrossAppAccounts**: `object`[]

Defined in: [src/features/accountSetup/types.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L52)

###### address

> **address**: `string`

###### providerAppId

> **providerAppId**: `string`

##### zoraLinked

> **zoraLinked**: `boolean`

Defined in: [src/features/accountSetup/types.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L51)

***

### ZoraResolveResponse

> **ZoraResolveResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L55)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L56)

##### creatorCoin

> **creatorCoin**: [`AccountCreatorCoin`](#accountcreatorcoin) \| `null`

Defined in: [src/features/accountSetup/types.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L57)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L58)
