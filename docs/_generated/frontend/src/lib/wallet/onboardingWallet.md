[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/onboardingWallet

# src/lib/wallet/onboardingWallet

## Type Aliases

### ConfirmOwnerResponse

> **ConfirmOwnerResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L34)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L36)

##### isOwner

> **isOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L35)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L37)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L38)

***

### OnboardingBootstrapResponse

> **OnboardingBootstrapResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L15)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L17)

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L16)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L18)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L19)

***

### OwnerApprovalExecutionMode

> **OwnerApprovalExecutionMode** = `"canonicalSmartWallet"` \| `"ownerDirect"`

Defined in: [src/lib/wallet/onboardingWallet.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L48)

***

### OwnerDelegationFlags

> **OwnerDelegationFlags** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L9)

#### Properties

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L12)

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L11)

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L10)

***

### PreparedOwnerTxRequest

> **PreparedOwnerTxRequest** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L41)

#### Properties

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L42)

##### data

> **data**: `` `0x${string}` ``

Defined in: [src/lib/wallet/onboardingWallet.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L44)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/onboardingWallet.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L43)

##### value

> **value**: `"0x0"`

Defined in: [src/lib/wallet/onboardingWallet.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L45)

***

### PrepareOwnerResponse

> **PrepareOwnerResponse** = \{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `txRequest`: \{ `chainId`: `8453`; `data`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `value`: `"0x0"`; \}; \}

Defined in: [src/lib/wallet/onboardingWallet.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L22)

## Functions

### buildOwnerDelegationError()

> **buildOwnerDelegationError**(`payload`, `fallback`): `Error` & [`OwnerDelegationFlags`](#ownerdelegationflags)

Defined in: [src/lib/wallet/onboardingWallet.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L64)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L79)

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

### normalizeOwnerApprovalError()

> **normalizeOwnerApprovalError**(`error`): `Error`

Defined in: [src/lib/wallet/onboardingWallet.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L101)

#### Parameters

##### error

`unknown`

#### Returns

`Error`

***

### readApiError()

> **readApiError**(`payload`, `fallback`): `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L50)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L54)

#### Parameters

##### payload

`unknown`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags)

***

### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**(`params`): `Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

Defined in: [src/lib/wallet/onboardingWallet.ts:286](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L286)

#### Parameters

##### params

###### authHeaders

() => `Promise`\<`Record`\<`string`, `string`\>\>

###### canonicalSmartWalletAddress?

`string` \| `null`

###### chainId

`number` \| `undefined`

###### ensurePaymasterSession?

() => `Promise`\<`boolean`\> \| `null`

###### executionMode

[`OwnerApprovalExecutionMode`](#ownerapprovalexecutionmode)

###### ownerAddress?

`string` \| `null`

###### publicClient?

`unknown`

###### signerAddress?

`string` \| `null`

###### switchChainAsync?

(`args`) => `Promise`\<`unknown`\> \| `null`

###### txRequest

[`PreparedOwnerTxRequest`](#preparedownertxrequest)

###### walletClient

\{ `account?`: `unknown`; `request?`: (...`args`) => `Promise`\<`unknown`\>; `sendTransaction?`: (...`args`) => `Promise`\<`` `0x${string}` ``\>; \} \| `null` \| `undefined`

#### Returns

`Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

***

### shouldRefreshOwnerDelegationOnForeground()

> **shouldRefreshOwnerDelegationOnForeground**(`input`): `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L92)

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
