[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/onboardingWallet

# src/lib/wallet/onboardingWallet

## Type Aliases

### ConfirmOwnerResponse

> **ConfirmOwnerResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:32](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L32)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L34)

##### isOwner

> **isOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L33)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L35)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L36)

***

### OnboardingBootstrapResponse

> **OnboardingBootstrapResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L13)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L15)

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L14)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L16)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L17)

***

### OwnerDelegationFlags

> **OwnerDelegationFlags** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L7)

#### Properties

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L10)

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L9)

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L8)

***

### PrepareOwnerResponse

> **PrepareOwnerResponse** = \{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `txRequest`: \{ `chainId`: `8453`; `data`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `value`: `"0x0"`; \}; \}

Defined in: [src/lib/wallet/onboardingWallet.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L20)

## Functions

### buildOwnerDelegationError()

> **buildOwnerDelegationError**(`payload`, `fallback`): `Error` & [`OwnerDelegationFlags`](#ownerdelegationflags)

Defined in: [src/lib/wallet/onboardingWallet.ts:53](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L53)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L68)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L39)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:43](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L43)

#### Parameters

##### payload

`unknown`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags)

***

### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**(`params`): `Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

Defined in: [src/lib/wallet/onboardingWallet.ts:90](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L90)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:81](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/wallet/onboardingWallet.ts#L81)

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

## References

### ApiEnvelope

Re-exports [ApiEnvelope](../apiEnvelope.md#apienvelope)
