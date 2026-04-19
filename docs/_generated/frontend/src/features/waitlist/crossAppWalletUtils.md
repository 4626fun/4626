[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/crossAppWalletUtils

# src/features/waitlist/crossAppWalletUtils

## Type Aliases

### CrossAppAuthAction

> **CrossAppAuthAction** = `"link"` \| `"login"`

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L56)

***

### ZoraCrossAppAddressSet

> **ZoraCrossAppAddressSet** = `object`

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L50)

#### Properties

##### embeddedWalletAddresses

> **embeddedWalletAddresses**: `string`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L53)

##### providerAddresses

> **providerAddresses**: `string`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L51)

##### smartWalletAddresses

> **smartWalletAddresses**: `string`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L52)

## Functions

### extractCrossAppWalletAddresses()

> **extractCrossAppWalletAddresses**(`accounts`): [`ZoraCrossAppAddressSet`](#zoracrossappaddressset)

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:116](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L116)

#### Parameters

##### accounts

`any`[]

#### Returns

[`ZoraCrossAppAddressSet`](#zoracrossappaddressset)

***

### extractZoraCrossAppAccounts()

> **extractZoraCrossAppAccounts**(`user`, `zoraPrivyAppId`): `any`[]

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L96)

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

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L77)

#### Parameters

##### user

`unknown`

#### Returns

`any`[]

***

### resolveCanonicalCswCandidate()

> **resolveCanonicalCswCandidate**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:133](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L133)

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

Defined in: [src/features/waitlist/crossAppWalletUtils.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/crossAppWalletUtils.ts#L58)

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
