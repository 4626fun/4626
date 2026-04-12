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

Defined in: [src/features/accountSetup/types.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L52)

#### Properties

##### me

> **me**: [`AccountSetupMe`](#accountsetupme)

Defined in: [src/features/accountSetup/types.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L53)

##### zoraStatus

> **zoraStatus**: [`ZoraLinkStatusResponse`](#zoralinkstatusresponse) \| `null`

Defined in: [src/features/accountSetup/types.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L54)

***

### AccountSetupMe

> **AccountSetupMe** = `object`

Defined in: [src/features/accountSetup/types.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L31)

#### Properties

##### accountSignals

> **accountSignals**: [`AccountSignals`](#accountsignals-1)

Defined in: [src/features/accountSetup/types.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L37)

##### appAccessStatus

> **appAccessStatus**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L35)

##### email

> **email**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L33)

##### emailVerified

> **emailVerified**: `boolean`

Defined in: [src/features/accountSetup/types.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L34)

##### linkedMethods

> **linkedMethods**: `Record`\<`string`, `string`[]\>

Defined in: [src/features/accountSetup/types.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L36)

##### privyUserId

> **privyUserId**: `string`

Defined in: [src/features/accountSetup/types.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L32)

##### score

> **score**: [`AccountScore`](#accountscore)

Defined in: [src/features/accountSetup/types.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L38)

***

### AccountSignals

> **AccountSignals** = `object`

Defined in: [src/features/accountSetup/types.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L23)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L25)

##### creatorCoin

> **creatorCoin**: [`AccountCreatorCoin`](#accountcreatorcoin) \| `null`

Defined in: [src/features/accountSetup/types.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L26)

##### lastResolvedAt

> **lastResolvedAt**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L28)

##### linked

> **linked**: `boolean`

Defined in: [src/features/accountSetup/types.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L24)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L27)

***

### ConnectedOwnerState

> **ConnectedOwnerState** = `object`

Defined in: [src/features/accountSetup/types.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L101)

#### Properties

##### reason

> **reason**: `"idle"` \| `"ok"` \| `"network_mismatch"` \| `"missing_params"` \| `"read_failed"`

Defined in: [src/features/accountSetup/types.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L103)

##### value

> **value**: `boolean` \| `null`

Defined in: [src/features/accountSetup/types.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L102)

***

### CswOwnersState

> **CswOwnersState** = `object`

Defined in: [src/features/accountSetup/types.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L106)

#### Properties

##### error

> **error**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L109)

##### owners

> **owners**: [`SmartWalletOwnersResponse`](#smartwalletownersresponse)\[`"owners"`\]

Defined in: [src/features/accountSetup/types.ts:108](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L108)

##### status

> **status**: `"idle"` \| `"loading"` \| `"ready"` \| `"error"`

Defined in: [src/features/accountSetup/types.ts:107](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L107)

***

### OwnerAuthorityState

> **OwnerAuthorityState** = `object`

Defined in: [src/features/accountSetup/types.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L69)

#### Properties

##### badgeClass

> **badgeClass**: `string`

Defined in: [src/features/accountSetup/types.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L81)

##### detail

> **detail**: `string`

Defined in: [src/features/accountSetup/types.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L80)

##### hint

> **hint**: `string`

Defined in: [src/features/accountSetup/types.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L79)

##### label

> **label**: `string`

Defined in: [src/features/accountSetup/types.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L78)

##### phase

> **phase**: `"blocked"` \| `"canonical_wallet"` \| `"owner_connected"` \| `"needs_base"` \| `"check_wallet"` \| `"wrong_wallet"` \| `"needs_wallet"`

Defined in: [src/features/accountSetup/types.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L70)

***

### OwnerChecklistItem

> **OwnerChecklistItem** = `object`

Defined in: [src/features/accountSetup/types.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L84)

#### Properties

##### description

> **description**: `string`

Defined in: [src/features/accountSetup/types.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L86)

##### state

> **state**: `"complete"` \| `"active"` \| `"blocked"`

Defined in: [src/features/accountSetup/types.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L87)

##### title

> **title**: `string`

Defined in: [src/features/accountSetup/types.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L85)

***

### OwnerInstallResumeState

> **OwnerInstallResumeState** = `object`

Defined in: [src/features/accountSetup/types.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L90)

#### Properties

##### requested

> **requested**: `boolean`

Defined in: [src/features/accountSetup/types.ts:91](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L91)

##### source

> **source**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L92)

***

### ProviderRow

> **ProviderRow** = `object`

Defined in: [src/features/accountSetup/types.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L95)

#### Properties

##### hint

> **hint**: `string`

Defined in: [src/features/accountSetup/types.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L98)

##### label

> **label**: `string`

Defined in: [src/features/accountSetup/types.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L97)

##### provider

> **provider**: [`AccountLinkProvider`](#accountlinkprovider)

Defined in: [src/features/accountSetup/types.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L96)

***

### SmartWalletOwnersResponse

> **SmartWalletOwnersResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L57)

#### Properties

##### nextOwnerIndex

> **nextOwnerIndex**: `number` \| `null`

Defined in: [src/features/accountSetup/types.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L60)

##### ownerCount

> **ownerCount**: `number`

Defined in: [src/features/accountSetup/types.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L59)

##### owners

> **owners**: `object`[]

Defined in: [src/features/accountSetup/types.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L61)

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

Defined in: [src/features/accountSetup/types.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L58)

***

### ZoraLinkStatusResponse

> **ZoraLinkStatusResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L41)

#### Properties

##### zoraCrossAppAccounts

> **zoraCrossAppAccounts**: `object`[]

Defined in: [src/features/accountSetup/types.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L43)

###### address

> **address**: `string`

###### providerAppId

> **providerAppId**: `string`

##### zoraLinked

> **zoraLinked**: `boolean`

Defined in: [src/features/accountSetup/types.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L42)

***

### ZoraResolveResponse

> **ZoraResolveResponse** = `object`

Defined in: [src/features/accountSetup/types.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L46)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L47)

##### creatorCoin

> **creatorCoin**: [`AccountCreatorCoin`](#accountcreatorcoin) \| `null`

Defined in: [src/features/accountSetup/types.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L48)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [src/features/accountSetup/types.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/types.ts#L49)
