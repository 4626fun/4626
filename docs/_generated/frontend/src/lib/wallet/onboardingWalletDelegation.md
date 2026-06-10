[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/onboardingWalletDelegation

# src/lib/wallet/onboardingWalletDelegation

## Type Aliases

### OwnerDelegationFlags

> **OwnerDelegationFlags** = `object`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L3)

#### Properties

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L6)

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L5)

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L4)

## Functions

### buildOwnerDelegationError()

> **buildOwnerDelegationError**(`payload`, `fallback`): `Error` & [`OwnerDelegationFlags`](#ownerdelegationflags)

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L23)

#### Parameters

##### payload

`unknown`

##### fallback

`string`

#### Returns

`Error` & [`OwnerDelegationFlags`](#ownerdelegationflags)

***

### deriveOwnerDelegationFlags()

> **deriveOwnerDelegationFlags**(`flags`): [`OwnerDelegationFlags`](#ownerdelegationflags) \| `null`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L38)

#### Parameters

##### flags

###### baseAppUrl

`string` \| `null`

###### needsBaseAppSetup

`boolean`

###### needsEmbeddedWallet

`boolean`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags) \| `null`

***

### readApiError()

> **readApiError**(`payload`, `fallback`): `string`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L9)

#### Parameters

##### payload

`unknown`

##### fallback

`string`

#### Returns

`string`

***

### readOwnerDelegationFlags()

> **readOwnerDelegationFlags**(`payload`): [`OwnerDelegationFlags`](#ownerdelegationflags)

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L13)

#### Parameters

##### payload

`unknown`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags)

***

### shouldRefreshOwnerDelegationOnForeground()

> **shouldRefreshOwnerDelegationOnForeground**(`input`): `boolean`

Defined in: [src/lib/wallet/onboardingWalletDelegation.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWalletDelegation.ts#L51)

#### Parameters

##### input

###### busy

`boolean`

###### ownerDelegationFlags

[`OwnerDelegationFlags`](#ownerdelegationflags) \| `null`

###### privyAuthed

`boolean`

#### Returns

`boolean`
