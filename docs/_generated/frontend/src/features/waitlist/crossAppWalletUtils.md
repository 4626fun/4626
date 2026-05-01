[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/crossAppWalletUtils

# src/features/waitlist/crossAppWalletUtils

## Type Aliases

### CrossAppAuthAction

> **CrossAppAuthAction** = `"link"` \| `"login"`

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L55)

***

### ZoraCrossAppAddressSet

> **ZoraCrossAppAddressSet** = `object`

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L49)

#### Properties

##### embeddedWalletAddresses

> **embeddedWalletAddresses**: `string`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L52)

##### providerAddresses

> **providerAddresses**: `string`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L50)

##### smartWalletAddresses

> **smartWalletAddresses**: `string`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L51)

## Functions

### extractCrossAppWalletAddresses()

> **extractCrossAppWalletAddresses**(`accounts`): [`ZoraCrossAppAddressSet`](#zoracrossappaddressset)

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L115)

#### Parameters

##### accounts

`any`[]

#### Returns

[`ZoraCrossAppAddressSet`](#zoracrossappaddressset)

***

### extractZoraCrossAppAccounts()

> **extractZoraCrossAppAccounts**(`user`, `zoraPrivyAppId`): `any`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L95)

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

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L76)

#### Parameters

##### user

`unknown`

#### Returns

`any`[]

***

### resolveCanonicalCswCandidate()

> **resolveCanonicalCswCandidate**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:132](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L132)

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

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L57)

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
