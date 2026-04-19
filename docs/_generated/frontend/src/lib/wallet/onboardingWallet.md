[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/onboardingWallet

# src/lib/wallet/onboardingWallet

## Type Aliases

### ConfirmOwnerResponse

> **ConfirmOwnerResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L35)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:37](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L37)

##### confirmationState?

> `optional` **confirmationState**: `"owner_confirmed"` \| `"pending_tx"` \| `"owner_not_found_yet"` \| `"tx_failed"`

Defined in: [src/lib/wallet/onboardingWallet.ts:40](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L40)

##### isOwner

> **isOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:36](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L36)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:38](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L38)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L39)

***

### OnboardingBootstrapResponse

> **OnboardingBootstrapResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L16)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L18)

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L17)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L19)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L20)

***

### OwnerApprovalExecutionMode

> **OwnerApprovalExecutionMode** = `"canonicalSmartWallet"` \| `"ownerDirect"` \| `"subAccount"`

Defined in: [src/lib/wallet/onboardingWallet.ts:50](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L50)

***

### OwnerApprovalStage

> **OwnerApprovalStage** = `"preflight"` \| `"prepare"` \| `"prepare_calls"` \| `"userop_typed"` \| `"userop_nontyped"` \| `"send_calls"` \| `"add_sub_account"` \| `"confirm_owner"`

Defined in: [src/lib/wallet/onboardingWallet.ts:52](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L52)

***

### OwnerApprovalStageEvent

> **OwnerApprovalStageEvent** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:64](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L64)

#### Properties

##### attempt?

> `optional` **attempt**: `number`

Defined in: [src/lib/wallet/onboardingWallet.ts:68](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L68)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:71](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L71)

##### code?

> `optional` **code**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L73)

##### executionMode

> **executionMode**: [`OwnerApprovalExecutionMode`](#ownerapprovalexecutionmode)

Defined in: [src/lib/wallet/onboardingWallet.ts:69](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L69)

##### message?

> `optional` **message**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:74](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L74)

##### runId

> **runId**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:65](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L65)

##### signerAddress?

> `optional` **signerAddress**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:70](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L70)

##### stage

> **stage**: [`OwnerApprovalStage`](#ownerapprovalstage)

Defined in: [src/lib/wallet/onboardingWallet.ts:66](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L66)

##### status

> **status**: [`OwnerApprovalStageStatus`](#ownerapprovalstagestatus)

Defined in: [src/lib/wallet/onboardingWallet.ts:67](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L67)

##### txHash?

> `optional` **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:72](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L72)

***

### OwnerApprovalStageStatus

> **OwnerApprovalStageStatus** = `"start"` \| `"retry"` \| `"success"` \| `"error"`

Defined in: [src/lib/wallet/onboardingWallet.ts:62](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L62)

***

### OwnerDelegationFlags

> **OwnerDelegationFlags** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L10)

#### Properties

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L13)

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L12)

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L11)

***

### PreparedOwnerTxRequest

> **PreparedOwnerTxRequest** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:43](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L43)

#### Properties

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L44)

##### data

> **data**: `` `0x${string}` ``

Defined in: [src/lib/wallet/onboardingWallet.ts:46](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L46)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/onboardingWallet.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L45)

##### value

> **value**: `"0x0"`

Defined in: [src/lib/wallet/onboardingWallet.ts:47](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L47)

***

### PrepareOwnerResponse

> **PrepareOwnerResponse** = \{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `txRequest`: \{ `chainId`: `8453`; `data`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `value`: `"0x0"`; \}; \}

Defined in: [src/lib/wallet/onboardingWallet.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L23)

## Functions

### \_submitOwnerTxViaWalletSendCalls()

> **\_submitOwnerTxViaWalletSendCalls**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/wallet/onboardingWallet.ts:319](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L319)

#### Parameters

##### params

###### approvalRunId

`string`

###### canonicalCswAddress?

`string` \| `null`

###### chainId

`number`

###### data

`` `0x${string}` ``

###### executionMode

[`OwnerApprovalExecutionMode`](#ownerapprovalexecutionmode)

###### onStageEvent?

(`event`) => `void` \| `null`

###### paymasterUrl?

`string` \| `null`

###### sender

`` `0x${string}` ``

###### signerAddress?

`string` \| `null`

###### to

`` `0x${string}` ``

###### walletRequest

(`args`) => `Promise`\<`unknown`\>

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### \_submitOwnerViaPreparedCalls()

> **\_submitOwnerViaPreparedCalls**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/wallet/onboardingWallet.ts:479](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L479)

#### Parameters

##### params

###### approvalRunId

`string`

###### canonicalCswAddress

`string` \| `null`

###### chainId

`number`

###### data

`` `0x${string}` ``

###### executionMode

[`OwnerApprovalExecutionMode`](#ownerapprovalexecutionmode)

###### onStageEvent?

(`event`) => `void` \| `null`

###### paymasterUrl

`string` \| `null`

###### sender

`` `0x${string}` ``

###### signerAddress

`string` \| `null`

###### to

`` `0x${string}` ``

###### walletRequest

(`args`) => `Promise`\<`unknown`\>

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### buildOwnerDelegationError()

> **buildOwnerDelegationError**(`payload`, `fallback`): `Error` & [`OwnerDelegationFlags`](#ownerdelegationflags)

Defined in: [src/lib/wallet/onboardingWallet.ts:91](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L91)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:106](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L106)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:195](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L195)

#### Parameters

##### error

`unknown`

#### Returns

`Error`

***

### readApiError()

> **readApiError**(`payload`, `fallback`): `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:77](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L77)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:81](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L81)

#### Parameters

##### payload

`unknown`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags)

***

### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**(`params`): `Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

Defined in: [src/lib/wallet/onboardingWallet.ts:653](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L653)

#### Parameters

##### params

###### approvalRunId?

`string` \| `null`

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

###### onStageEvent?

(`event`) => `void` \| `null`

###### ownerAddress?

`string` \| `null`

###### ownerIndexLookupAddress?

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

Defined in: [src/lib/wallet/onboardingWallet.ts:119](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/wallet/onboardingWallet.ts#L119)

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

Re-exports [ApiEnvelope](../api/apiEnvelope.md#apienvelope)
