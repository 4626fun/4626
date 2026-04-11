[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/ownerInstallMapping

# src/features/waitlist/ownerInstallMapping

## Type Aliases

### CrossAppAuthAction

> **CrossAppAuthAction** = `"link"` \| `"login"`

Defined in: [src/features/waitlist/ownerInstallMapping.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L36)

***

### ZoraCrossAppAddressSet

> **ZoraCrossAppAddressSet** = `object`

Defined in: [src/features/waitlist/ownerInstallMapping.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L30)

#### Properties

##### embeddedWalletAddresses

> **embeddedWalletAddresses**: `string`[]

Defined in: [src/features/waitlist/ownerInstallMapping.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L33)

##### providerAddresses

> **providerAddresses**: `string`[]

Defined in: [src/features/waitlist/ownerInstallMapping.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L31)

##### smartWalletAddresses

> **smartWalletAddresses**: `string`[]

Defined in: [src/features/waitlist/ownerInstallMapping.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L32)

## Functions

### deriveOwnerInstallMappingStatus()

> **deriveOwnerInstallMappingStatus**(`params`): [`OwnerInstallMappingStatus`](waitlistTypes.md#ownerinstallmappingstatus)

Defined in: [src/features/waitlist/ownerInstallMapping.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L145)

#### Parameters

##### params

###### canonicalCswAddress

`string` \| `null`

###### canonicalResolving

`boolean`

###### embeddedEoaAddress

`string` \| `null`

###### embeddedEoaOwnerInstalled

`boolean` \| `null`

###### embeddedWalletCreating

`boolean`

###### ownerInstallBusy

`boolean`

###### privyAuthed

`boolean`

###### walletSetupInProgress

`boolean`

###### walletSetupReady

`boolean`

###### walletsReady

`boolean`

#### Returns

[`OwnerInstallMappingStatus`](waitlistTypes.md#ownerinstallmappingstatus)

***

### extractCrossAppWalletAddresses()

> **extractCrossAppWalletAddresses**(`accounts`): [`ZoraCrossAppAddressSet`](#zoracrossappaddressset)

Defined in: [src/features/waitlist/ownerInstallMapping.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L96)

#### Parameters

##### accounts

`any`[]

#### Returns

[`ZoraCrossAppAddressSet`](#zoracrossappaddressset)

***

### extractZoraCrossAppAccounts()

> **extractZoraCrossAppAccounts**(`user`, `zoraPrivyAppId`): `any`[]

Defined in: [src/features/waitlist/ownerInstallMapping.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L76)

#### Parameters

##### user

`unknown`

##### zoraPrivyAppId

`string`

#### Returns

`any`[]

***

### readLinkedAccounts()

> **readLinkedAccounts**(`user`): `any`[]

Defined in: [src/features/waitlist/ownerInstallMapping.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L57)

#### Parameters

##### user

`unknown`

#### Returns

`any`[]

***

### resolveCanonicalCswCandidate()

> **resolveCanonicalCswCandidate**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/features/waitlist/ownerInstallMapping.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L113)

#### Parameters

##### params

###### isContractAddress?

(`address`) => `Promise`\<`boolean`\>

###### knownCanonicalAddress

`string` \| `null`

###### profileFallbackAddress

`string` \| `null`

###### providerAddresses

`string`[]

###### smartWalletAddresses

`string`[]

#### Returns

`Promise`\<`string` \| `null`\>

***

### selectCrossAppAuthAction()

> **selectCrossAppAuthAction**(`params`): [`CrossAppAuthAction`](#crossappauthaction) \| `null`

Defined in: [src/features/waitlist/ownerInstallMapping.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ownerInstallMapping.ts#L38)

#### Parameters

##### params

###### linkCrossAppAccount

`unknown`

###### loginWithCrossAppAccount

`unknown`

###### privyAuthed

`boolean`

#### Returns

[`CrossAppAuthAction`](#crossappauthaction) \| `null`
