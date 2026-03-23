[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/onboardingWallet

# src/lib/wallet/onboardingWallet

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L4)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [src/lib/wallet/onboardingWallet.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L4)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L4)

##### success

> **success**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L4)

***

### ConfirmOwnerResponse

> **ConfirmOwnerResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L31)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L33)

##### isOwner

> **isOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L32)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L34)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L35)

***

### OnboardingBootstrapResponse

> **OnboardingBootstrapResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L12)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L14)

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L13)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L15)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L16)

***

### OwnerDelegationFlags

> **OwnerDelegationFlags** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L6)

#### Properties

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L9)

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L8)

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L7)

***

### PrepareOwnerResponse

> **PrepareOwnerResponse** = \{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `txRequest`: \{ `chainId`: `8453`; `data`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `value`: `"0x0"`; \}; \}

Defined in: [src/lib/wallet/onboardingWallet.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L19)

## Functions

### buildOwnerDelegationError()

> **buildOwnerDelegationError**(`payload`, `fallback`): `Error` & [`OwnerDelegationFlags`](#ownerdelegationflags)

Defined in: [src/lib/wallet/onboardingWallet.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L56)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L71)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L38)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L46)

#### Parameters

##### payload

`unknown`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags)

***

### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**(`params`): `Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

Defined in: [src/lib/wallet/onboardingWallet.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L93)

#### Parameters

##### params

###### authHeaders

() => `Promise`\<`Record`\<`string`, `string`\>\>

###### chainId

`number` \| `undefined`

###### ownerAddress?

`string` \| `null`

###### switchChainAsync?

(`args`) => `Promise`\<`unknown`\> \| `null`

###### txRequest

\{ `chainId`: `8453`; `data`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `value`: `"0x0"`; \}

###### txRequest.chainId

`8453`

###### txRequest.data

`` `0x${string}` ``

###### txRequest.to

`` `0x${string}` ``

###### txRequest.value

`"0x0"`

###### walletClient

\{ `account?`: `unknown`; `sendTransaction`: (...`args`) => `Promise`\<`` `0x${string}` ``\>; \} \| `null` \| `undefined`

#### Returns

`Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

***

### shouldRefreshOwnerDelegationOnForeground()

> **shouldRefreshOwnerDelegationOnForeground**(`input`): `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L84)

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
