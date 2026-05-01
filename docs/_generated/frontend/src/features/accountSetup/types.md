[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/accountSetup/types

# src/features/accountSetup/types

## Type Aliases

### AccountCreatorCoin

> **AccountCreatorCoin** = `object`

Defined in: [src/features/accountSetup/types.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L16)

#### Properties

##### address

> **address**: `string`

Defined in: [src/features/accountSetup/types.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L17)

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L20)

##### name?

> `optional` **name**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L18)

##### symbol?

> `optional` **symbol**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L19)

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

Defined in: [src/features/accountSetup/types.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L12)

##### tier

> **tier**: `number`

Defined in: [src/features/accountSetup/types.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L13)

***

### AccountSetupInitialData

> **AccountSetupInitialData** = `object`

Defined in: [src/features/accountSetup/types.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L60)

#### Properties

##### me

> **me**: [`AccountSetupMe`](#accountsetupme)

Defined in: [src/features/accountSetup/types.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L61)

##### zoraStatus

> **zoraStatus**: [`ZoraLinkStatusResponse`](#zoralinkstatusresponse) \| `null`

Defined in: [src/features/accountSetup/types.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L62)

***

### AccountSetupMe

> **AccountSetupMe** = `object`

Defined in: [src/features/accountSetup/types.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L38)

#### Properties

##### accountSignals

> **accountSignals**: [`AccountSignals`](#accountsignals-1)

Defined in: [src/features/accountSetup/types.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L45)

##### appAccessStatus

> **appAccessStatus**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L42)

##### baseSubAccount

> **baseSubAccount**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L43)

##### email

> **email**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L40)

##### emailVerified

> **emailVerified**: `boolean`

Defined in: [src/features/accountSetup/types.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L41)

##### linkedMethods

> **linkedMethods**: `Record`\<`string`, `string`[]\>

Defined in: [src/features/accountSetup/types.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L44)

##### privyUserId

> **privyUserId**: `string`

Defined in: [src/features/accountSetup/types.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L39)

##### score

> **score**: [`AccountScore`](#accountscore)

Defined in: [src/features/accountSetup/types.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L46)

***

### AccountSignals

> **AccountSignals** = `object`

Defined in: [src/features/accountSetup/types.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L23)

#### Properties

##### baseSubAccount

> **baseSubAccount**: `object`

Defined in: [src/features/accountSetup/types.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L26)

###### address

> **address**: `string` \| `null`

###### isDistinctFromCsw

> **isDistinctFromCsw**: `boolean`

###### registered

> **registered**: `boolean`

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L25)

##### creatorCoin

> **creatorCoin**: [`AccountCreatorCoin`](#accountcreatorcoin) \| `null`

Defined in: [src/features/accountSetup/types.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L33)

##### executionTrack

> **executionTrack**: `"sub-account"` \| `"legacy-owner-install"` \| `"migration-pending"` \| `"none-yet"`

Defined in: [src/features/accountSetup/types.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L31)

##### lastResolvedAt

> **lastResolvedAt**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L35)

##### linked

> **linked**: `boolean`

Defined in: [src/features/accountSetup/types.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L24)

##### privyEmbeddedEoaIsOwnerOfCanonicalCsw

> **privyEmbeddedEoaIsOwnerOfCanonicalCsw**: `boolean` \| `null`

Defined in: [src/features/accountSetup/types.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L32)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L34)

***

### ConnectedOwnerState

> **ConnectedOwnerState** = `object`

Defined in: [src/features/accountSetup/types.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L109)

#### Properties

##### reason

> **reason**: `"idle"` \| `"ok"` \| `"network_mismatch"` \| `"missing_params"` \| `"read_failed"`

Defined in: [src/features/accountSetup/types.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L111)

##### value

> **value**: `boolean` \| `null`

Defined in: [src/features/accountSetup/types.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L110)

***

### CswOwnersState

> **CswOwnersState** = `object`

Defined in: [src/features/accountSetup/types.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L114)

#### Properties

##### error

> **error**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L117)

##### owners

> **owners**: [`SmartWalletOwnersResponse`](#smartwalletownersresponse)\[`"owners"`\]

Defined in: [src/features/accountSetup/types.ts:116](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L116)

##### status

> **status**: `"idle"` \| `"loading"` \| `"ready"` \| `"error"`

Defined in: [src/features/accountSetup/types.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L115)

***

### OwnerAuthorityState

> **OwnerAuthorityState** = `object`

Defined in: [src/features/accountSetup/types.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L77)

#### Properties

##### badgeClass

> **badgeClass**: `string`

Defined in: [src/features/accountSetup/types.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L89)

##### detail

> **detail**: `string`

Defined in: [src/features/accountSetup/types.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L88)

##### hint

> **hint**: `string`

Defined in: [src/features/accountSetup/types.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L87)

##### label

> **label**: `string`

Defined in: [src/features/accountSetup/types.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L86)

##### phase

> **phase**: `"blocked"` \| `"canonical_wallet"` \| `"owner_connected"` \| `"needs_base"` \| `"check_wallet"` \| `"wrong_wallet"` \| `"needs_wallet"`

Defined in: [src/features/accountSetup/types.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L78)

***

### OwnerChecklistItem

> **OwnerChecklistItem** = `object`

Defined in: [src/features/accountSetup/types.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L92)

#### Properties

##### description

> **description**: `string`

Defined in: [src/features/accountSetup/types.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L94)

##### state

> **state**: `"complete"` \| `"active"` \| `"blocked"`

Defined in: [src/features/accountSetup/types.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L95)

##### title

> **title**: `string`

Defined in: [src/features/accountSetup/types.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L93)

***

### OwnerInstallResumeState

> **OwnerInstallResumeState** = `object`

Defined in: [src/features/accountSetup/types.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L98)

#### Properties

##### requested

> **requested**: `boolean`

Defined in: [src/features/accountSetup/types.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L99)

##### source

> **source**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L100)

***

### ProviderRow

> **ProviderRow** = `object`

Defined in: [src/features/accountSetup/types.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L103)

#### Properties

##### hint

> **hint**: `string`

Defined in: [src/features/accountSetup/types.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L106)

##### label

> **label**: `string`

Defined in: [src/features/accountSetup/types.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L105)

##### provider

> **provider**: [`AccountLinkProvider`](#accountlinkprovider)

Defined in: [src/features/accountSetup/types.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L104)

***

### SmartWalletOwnersResponse

> **SmartWalletOwnersResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L65)

#### Properties

##### nextOwnerIndex

> **nextOwnerIndex**: `number` \| `null`

Defined in: [src/features/accountSetup/types.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L68)

##### ownerCount

> **ownerCount**: `number`

Defined in: [src/features/accountSetup/types.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L67)

##### owners

> **owners**: `object`[]

Defined in: [src/features/accountSetup/types.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L69)

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

Defined in: [src/features/accountSetup/types.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L66)

***

### ZoraLinkStatusResponse

> **ZoraLinkStatusResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L49)

#### Properties

##### zoraCrossAppAccounts

> **zoraCrossAppAccounts**: `object`[]

Defined in: [src/features/accountSetup/types.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L51)

###### address

> **address**: `string`

###### providerAppId

> **providerAppId**: `string`

##### zoraLinked

> **zoraLinked**: `boolean`

Defined in: [src/features/accountSetup/types.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L50)

***

### ZoraResolveResponse

> **ZoraResolveResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L54)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L55)

##### creatorCoin

> **creatorCoin**: [`AccountCreatorCoin`](#accountcreatorcoin) \| `null`

Defined in: [src/features/accountSetup/types.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L56)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L57)
