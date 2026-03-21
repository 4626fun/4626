[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/waitlist/waitlistTypes

# src/components/waitlist/waitlistTypes

## Type Aliases

### ActionKey

> **ActionKey** = [`LegacyActionKey`](#legacyactionkey) \| [`SocialActionKey`](#socialactionkey) \| [`BonusActionKey`](#bonusactionkey)

Defined in: [src/components/waitlist/waitlistTypes.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L14)

***

### BonusActionKey

> **BonusActionKey** = `"github"` \| `"tiktok"` \| `"instagram"` \| `"reddit"`

Defined in: [src/components/waitlist/waitlistTypes.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L11)

***

### ContactPreference

> **ContactPreference** = `"wallet"` \| `"email"`

Defined in: [src/components/waitlist/waitlistTypes.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L16)

***

### FlowState

> **FlowState** = `object`

Defined in: [src/components/waitlist/waitlistTypes.ts:41](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L41)

#### Properties

##### busy

> **busy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:47](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L47)

##### contactPreference

> **contactPreference**: [`ContactPreference`](#contactpreference)

Defined in: [src/components/waitlist/waitlistTypes.ts:44](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L44)

##### doneEmail

> **doneEmail**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:49](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L49)

##### email

> **email**: `string`

Defined in: [src/components/waitlist/waitlistTypes.ts:45](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L45)

##### emailOptOut

> **emailOptOut**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:46](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L46)

##### error

> **error**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:48](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L48)

##### persona

> **persona**: [`Persona`](#persona-1) \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:42](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L42)

##### step

> **step**: `"persona"` \| `"verify"` \| `"email"` \| `"done"`

Defined in: [src/components/waitlist/waitlistTypes.ts:43](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L43)

***

### LegacyActionKey

> **LegacyActionKey** = `"shareX"` \| `"copyLink"` \| `"share"` \| `"follow"` \| `"saveApp"`

Defined in: [src/components/waitlist/waitlistTypes.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L5)

***

### OwnerInstallMappingStatus

> **OwnerInstallMappingStatus** = `"NEEDS_PRIVY_AUTH"` \| `"WAITING_FOR_WALLETS"` \| `"EMBEDDED_WALLET_MISSING"` \| `"EMBEDDED_WALLET_CREATING"` \| `"BASE_SETUP_REQUIRED"` \| `"BASE_SETUP_IN_PROGRESS"` \| `"CANONICAL_RESOLVING"` \| `"CANONICAL_UNRESOLVED"` \| `"OWNER_INSTALL_CHECKING"` \| `"OWNER_INSTALL_REQUIRED"` \| `"OWNER_INSTALLING"` \| `"READY_FOR_OWNER_INSTALL"`

Defined in: [src/components/waitlist/waitlistTypes.ts:27](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L27)

***

### Persona

> **Persona** = `"creator"` \| `"user"`

Defined in: [src/components/waitlist/waitlistTypes.ts:1](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L1)

***

### SocialActionKey

> **SocialActionKey** = `"baseApp"` \| `"zora"` \| `"x"` \| `"discord"` \| `"telegram"`

Defined in: [src/components/waitlist/waitlistTypes.ts:8](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L8)

***

### Variant

> **Variant** = `"page"` \| `"embedded"` \| `"modal"`

Defined in: [src/components/waitlist/waitlistTypes.ts:2](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L2)

***

### VerificationClaim

> **VerificationClaim** = `object`

Defined in: [src/components/waitlist/waitlistTypes.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L26)

#### Properties

##### method

> **method**: [`VerificationMethod`](#verificationmethod)

Defined in: [src/components/waitlist/waitlistTypes.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L26)

##### subject

> **subject**: `string`

Defined in: [src/components/waitlist/waitlistTypes.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L26)

##### timestamp

> **timestamp**: `string`

Defined in: [src/components/waitlist/waitlistTypes.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L26)

***

### VerificationMethod

> **VerificationMethod** = `"siwe"` \| `"privy"` \| `"solana"` \| `"csw-erc1271"` \| `"siwe-csw-owner"` \| `"privy-embedded-eoa"` \| `"privy-zora-readonly"` \| `"zora-canonical-csw"`

Defined in: [src/components/waitlist/waitlistTypes.ts:17](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L17)

***

### VerificationState

> **VerificationState** = `object`

Defined in: [src/components/waitlist/waitlistTypes.ts:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L52)

#### Properties

##### baseSubAccount

> **baseSubAccount**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:58](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L58)

##### baseSubAccountBusy

> **baseSubAccountBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:59](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L59)

##### baseSubAccountError

> **baseSubAccountError**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:60](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L60)

##### privyVerifyBusy

> **privyVerifyBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:56](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L56)

##### privyVerifyError

> **privyVerifyError**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:57](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L57)

##### verifiedSolana

> **verifiedSolana**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:55](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L55)

##### verifiedWallet

> **verifiedWallet**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:53](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L53)

##### verifiedWalletMethod

> **verifiedWalletMethod**: [`VerificationMethod`](#verificationmethod) \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:54](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L54)

***

### WaitlistState

> **WaitlistState** = `object`

Defined in: [src/components/waitlist/waitlistTypes.ts:63](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L63)

#### Properties

##### actionsDone

> **actionsDone**: `Record`\<[`ActionKey`](#actionkey), `boolean`\>

Defined in: [src/components/waitlist/waitlistTypes.ts:88](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L88)

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:93](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L93)

##### canonicalCswUnresolvedReason

> **canonicalCswUnresolvedReason**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:94](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L94)

##### claimCoinBusy

> **claimCoinBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L79)

##### claimCoinError

> **claimCoinError**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:80](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L80)

##### claimReferralCode

> **claimReferralCode**: `string`

Defined in: [src/components/waitlist/waitlistTypes.ts:82](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L82)

##### creatorCoin

> **creatorCoin**: \{ `address`: `string`; `canonicalSmartWallet`: `string` \| `null`; `coinType`: `string` \| `null`; `holders`: `number` \| `null`; `imageUrl`: `string` \| `null`; `marketCapUsd`: `number` \| `null`; `ownerWallets`: `string`[]; `payoutRecipient`: `string` \| `null`; `priceUsd`: `number` \| `null`; `symbol`: `string` \| `null`; `volume24hUsd`: `number` \| `null`; \} \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:64](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L64)

##### creatorCoinBusy

> **creatorCoinBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:78](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L78)

##### creatorCoinDeclaredMissing

> **creatorCoinDeclaredMissing**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:77](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L77)

##### crossAppProviderAddresses

> **crossAppProviderAddresses**: `string`[]

Defined in: [src/components/waitlist/waitlistTypes.ts:92](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L92)

##### cswLinkBusy

> **cswLinkBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:99](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L99)

##### cswLinked

> **cswLinked**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:98](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L98)

##### cswLinkError

> **cswLinkError**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:100](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L100)

##### cswProofBusy

> **cswProofBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:103](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L103)

##### cswProofError

> **cswProofError**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:104](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L104)

##### cswProofVerified

> **cswProofVerified**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:102](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L102)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:91](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L91)

##### inviteTemplateIdx

> **inviteTemplateIdx**: `number`

Defined in: [src/components/waitlist/waitlistTypes.ts:84](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L84)

##### inviteToast

> **inviteToast**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:83](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L83)

##### mappingError

> **mappingError**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:96](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L96)

##### mappingStatus

> **mappingStatus**: [`OwnerInstallMappingStatus`](#ownerinstallmappingstatus)

Defined in: [src/components/waitlist/waitlistTypes.ts:95](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L95)

##### miniAppAddSupported

> **miniAppAddSupported**: `boolean` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:89](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L89)

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:85](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L85)

##### referralCodeTaken

> **referralCodeTaken**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:81](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L81)

##### shareBusy

> **shareBusy**: `boolean`

Defined in: [src/components/waitlist/waitlistTypes.ts:86](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L86)

##### shareToast

> **shareToast**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:87](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L87)

##### waitlistPosition

> **waitlistPosition**: \{ `borderTier`: `number`; `percentileInvite`: `number` \| `null`; `points`: \{ `bonus`: `number`; `csw`: `number`; `invite`: `number`; `signup`: `number`; `social`: `number`; `tasks`: `number`; `total`: `number`; \}; `rank`: \{ `invite`: `number` \| `null`; `total`: `number` \| `null`; \}; `referrals`: \{ `pendingCap`: `number`; `pendingCount`: `number`; `pendingCountCapped`: `number`; `qualifiedCount`: `number`; \}; `totalAheadInvite`: `number` \| `null`; `totalCount`: `number`; \} \| `null`

Defined in: [src/components/waitlist/waitlistTypes.ts:105](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistTypes.ts#L105)
