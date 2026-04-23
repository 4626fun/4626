[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/onboardingWallet

# src/lib/wallet/onboardingWallet

## Type Aliases

### ConfirmOwnerResponse

> **ConfirmOwnerResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L38)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L40)

##### confirmationState?

> `optional` **confirmationState**: `"owner_confirmed"` \| `"pending_tx"` \| `"owner_not_found_yet"` \| `"tx_failed"`

Defined in: [src/lib/wallet/onboardingWallet.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L43)

##### isOwner

> **isOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L39)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L41)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L42)

***

### OnboardingBootstrapResponse

> **OnboardingBootstrapResponse** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L16)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L18)

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L17)

##### privyEmbeddedEoaAddress

> **privyEmbeddedEoaAddress**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L19)

##### privyIsOwner

> **privyIsOwner**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L20)

***

### OwnerApprovalExecutionMode

> **OwnerApprovalExecutionMode** = `"canonicalSmartWallet"` \| `"ownerDirect"` \| `"subAccount"`

Defined in: [src/lib/wallet/onboardingWallet.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L53)

***

### OwnerApprovalStage

> **OwnerApprovalStage** = `"preflight"` \| `"prepare"` \| `"prepare_calls"` \| `"userop_typed"` \| `"userop_nontyped"` \| `"send_calls"` \| `"add_sub_account"` \| `"confirm_owner"`

Defined in: [src/lib/wallet/onboardingWallet.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L56)

***

### OwnerApprovalStageEvent

> **OwnerApprovalStageEvent** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L68)

#### Properties

##### attempt?

> `optional` **attempt**: `number`

Defined in: [src/lib/wallet/onboardingWallet.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L72)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L75)

##### code?

> `optional` **code**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L77)

##### executionMode

> **executionMode**: [`OwnerApprovalExecutionMode`](#ownerapprovalexecutionmode)

Defined in: [src/lib/wallet/onboardingWallet.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L73)

##### message?

> `optional` **message**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L78)

##### runId

> **runId**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L69)

##### signerAddress?

> `optional` **signerAddress**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L74)

##### stage

> **stage**: [`OwnerApprovalStage`](#ownerapprovalstage)

Defined in: [src/lib/wallet/onboardingWallet.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L70)

##### status

> **status**: [`OwnerApprovalStageStatus`](#ownerapprovalstagestatus)

Defined in: [src/lib/wallet/onboardingWallet.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L71)

##### txHash?

> `optional` **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/onboardingWallet.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L76)

***

### OwnerApprovalStageStatus

> **OwnerApprovalStageStatus** = `"start"` \| `"retry"` \| `"success"` \| `"error"`

Defined in: [src/lib/wallet/onboardingWallet.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L66)

***

### OwnerDelegationFlags

> **OwnerDelegationFlags** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L10)

#### Properties

##### baseAppUrl?

> `optional` **baseAppUrl**: `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L13)

##### needsBaseAppSetup?

> `optional` **needsBaseAppSetup**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L12)

##### needsEmbeddedWallet?

> `optional` **needsEmbeddedWallet**: `boolean`

Defined in: [src/lib/wallet/onboardingWallet.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L11)

***

### OwnerInstallIntent

> **OwnerInstallIntent** = `"embeddedOwner"` \| `"customCoOwner"`

Defined in: [src/lib/wallet/onboardingWallet.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L54)

***

### PreparedOwnerTxRequest

> **PreparedOwnerTxRequest** = `object`

Defined in: [src/lib/wallet/onboardingWallet.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L46)

#### Properties

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/onboardingWallet.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L47)

##### data

> **data**: `` `0x${string}` ``

Defined in: [src/lib/wallet/onboardingWallet.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L49)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/onboardingWallet.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L48)

##### value

> **value**: `"0x0"`

Defined in: [src/lib/wallet/onboardingWallet.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L50)

***

### PrepareOwnerResponse

> **PrepareOwnerResponse** = \{ `alreadyOwner`: `true`; \} \| \{ `alreadyOwner`: `false`; `sponsorship?`: \{ `customOwnerPolicyToken?`: `string`; \}; `txRequest`: \{ `chainId`: `8453`; `data`: `` `0x${string}` ``; `to`: `` `0x${string}` ``; `value`: `"0x0"`; \}; \}

Defined in: [src/lib/wallet/onboardingWallet.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L23)

## Functions

### \_submitOwnerTxViaWalletSendCalls()

> **\_submitOwnerTxViaWalletSendCalls**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/wallet/onboardingWallet.ts:408](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L408)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:568](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L568)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L95)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L110)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:218](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L218)

#### Parameters

##### error

`unknown`

#### Returns

`Error`

***

### readApiError()

> **readApiError**(`payload`, `fallback`): `string`

Defined in: [src/lib/wallet/onboardingWallet.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L81)

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

Defined in: [src/lib/wallet/onboardingWallet.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L85)

#### Parameters

##### payload

`unknown`

#### Returns

[`OwnerDelegationFlags`](#ownerdelegationflags)

***

### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**(`params`): `Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

Defined in: [src/lib/wallet/onboardingWallet.ts:742](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L742)

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

###### customOwnerPolicyToken?

`string` \| `null`

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

###### ownerInstallIntent?

[`OwnerInstallIntent`](#ownerinstallintent)

###### preferSponsoredFirst?

`boolean`

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

Defined in: [src/lib/wallet/onboardingWallet.ts:123](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/onboardingWallet.ts#L123)

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
