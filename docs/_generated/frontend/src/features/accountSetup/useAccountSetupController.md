[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/accountSetup/useAccountSetupController

# src/features/accountSetup/useAccountSetupController

## Functions

### readOptionalZoraStatus()

> **readOptionalZoraStatus**(`params`): [`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`

Defined in: [src/features/accountSetup/useAccountSetupController.ts:116](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/accountSetup/useAccountSetupController.ts#L116)

#### Parameters

##### params

###### payload

[`ApiEnvelope`](../../lib/api/apiEnvelope.md#apienvelope)\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse)\> \| `null`

###### responseOk

`boolean`

#### Returns

[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`

***

### shouldRefreshAccountsOnForeground()

> **shouldRefreshAccountsOnForeground**(`input`): `boolean`

Defined in: [src/features/accountSetup/useAccountSetupController.ts:104](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/accountSetup/useAccountSetupController.ts#L104)

#### Parameters

##### input

###### advancedBusy

`boolean`

###### ownerDelegationFlags

[`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`

###### privyAuthed

`boolean`

#### Returns

`boolean`

***

### useAccountSetupController()

> **useAccountSetupController**(`params`): `object`

Defined in: [src/features/accountSetup/useAccountSetupController.ts:173](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/accountSetup/useAccountSetupController.ts#L173)

#### Parameters

##### params

###### initialData?

[`AccountSetupInitialData`](types.md#accountsetupinitialdata)

###### zoraReturnPath?

`string`

#### Returns

`object`

##### activeExternalOwnerWallet

> **activeExternalOwnerWallet**: `any`

##### activePrivyWallet

> **activePrivyWallet**: `any`

##### advancedBusy

> **advancedBusy**: `boolean`

##### authHeaders()

> **authHeaders**: () => `Promise`\<`Record`\<`string`, `string`\>\>

###### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

##### baseAppUrl

> **baseAppUrl**: `string` \| `null`

##### busyProvider

> **busyProvider**: `string` \| `null`

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null`

##### canShowAdvanced

> **canShowAdvanced**: `boolean`

##### chainId

> **chainId**: `number` \| `undefined`

##### connectedAddress

> **connectedAddress**: `` `0x${string}` `` \| `undefined`

##### connectedCanonicalWalletSelected

> **connectedCanonicalWalletSelected**: `boolean`

##### connectedOwnerReady

> **connectedOwnerReady**: `boolean`

##### connectedOwnerState

> **connectedOwnerState**: [`ConnectedOwnerState`](types.md#connectedownerstate)

##### connectedSignerDetail

> **connectedSignerDetail**: `string`

##### connectedSignerLabel

> **connectedSignerLabel**: `string`

##### connectOwnerWallet()

> **connectOwnerWallet**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### connectWallet

> **connectWallet**: `any`

##### cswOwnersState

> **cswOwnersState**: [`CswOwnersState`](types.md#cswownersstate)

##### ensureEmbeddedWallet()

> **ensureEmbeddedWallet**: () => `Promise`\<\{ `address`: `` `0x${string}` ``; `created`: `boolean`; \}\>

###### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; `created`: `boolean`; \}\>

##### error

> **error**: `string` \| `null`

##### getAccessToken()

> **getAccessToken**: () => `Promise`\<`string` \| `null`\>

###### Returns

`Promise`\<`string` \| `null`\>

##### inTelegramMiniApp

> **inTelegramMiniApp**: `boolean`

##### linkCrossAppAccount

> **linkCrossAppAccount**: `any`

##### loading

> **loading**: `boolean`

##### loadMe()

> **loadMe**: (`options?`) => `Promise`\<`void`\>

###### Parameters

###### options?

###### showSpinner?

`boolean`

###### Returns

`Promise`\<`void`\>

##### login

> **login**: `any`

##### loginWithCrossAppAccount

> **loginWithCrossAppAccount**: `any`

##### me

> **me**: [`AccountSetupMe`](types.md#accountsetupme) \| `null`

##### needsBaseAccountReconnect

> **needsBaseAccountReconnect**: `boolean`

##### needsBaseAppSetup

> **needsBaseAppSetup**: `boolean`

##### needsEmbeddedWallet

> **needsEmbeddedWallet**: `boolean`

##### notice

> **notice**: `string` \| `null`

##### onAddRabbyCoOwner()

> **onAddRabbyCoOwner**: (`advancedOwnerAddress`) => `Promise`\<`void`\>

###### Parameters

###### advancedOwnerAddress

`string`

###### Returns

`Promise`\<`void`\>

##### onEnable4626Signing()

> **onEnable4626Signing**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### onLinkProvider()

> **onLinkProvider**: (`provider`) => `Promise`\<`void`\>

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<`void`\>

##### onLinkZora()

> **onLinkZora**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### onRefreshZora()

> **onRefreshZora**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### onResetOwnerApproval()

> **onResetOwnerApproval**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### onSwitchAccount()

> **onSwitchAccount**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### onUnlinkProvider()

> **onUnlinkProvider**: (`provider`) => `Promise`\<`void`\>

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<`void`\>

##### ownerApprovalReady

> **ownerApprovalReady**: `boolean`

##### ownerAuthorityState

> **ownerAuthorityState**: [`OwnerAuthorityState`](types.md#ownerauthoritystate)

##### ownerChecklist

> **ownerChecklist**: [`OwnerChecklistItem`](types.md#ownerchecklistitem)[]

##### ownerDelegationFlags

> **ownerDelegationFlags**: [`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`

##### ownerInstallResumeState

> **ownerInstallResumeState**: [`OwnerInstallResumeState`](types.md#ownerinstallresumestate)

##### ownerInstallSectionRef

> **ownerInstallSectionRef**: `RefObject`\<`HTMLElement` \| `null`\>

##### ownerPrimaryCtaLabel

> **ownerPrimaryCtaLabel**: `string`

##### ownerSignerAddress

> **ownerSignerAddress**: `any`

##### ownerSignerChainId

> **ownerSignerChainId**: `number` \| `null`

##### prefersWalletConnectQr

> **prefersWalletConnectQr**: `boolean`

##### privy

> **privy**: `any`

##### privyAuthed

> **privyAuthed**: `boolean`

##### privySignerClientReady

> **privySignerClientReady**: `boolean`

##### privyWallets

> **privyWallets**: `Record`\<`string`, `unknown`\>[]

##### providerCards

> **providerCards**: `object`[]

##### providerCollision

> **providerCollision**: `EthereumProviderCollisionState`

##### publicClient

> **publicClient**: \{ \} \| \{ \} \| \{ \} \| \{ \} \| \{ \}

##### readableCswOwners

> **readableCswOwners**: `object`[]

##### retryOwnerCheck()

> **retryOwnerCheck**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**: (`txRequest`, `ownerAddress?`, `ownerIndexLookupAddress?`, `opts?`) => `Promise`\<`void`\>

###### Parameters

###### txRequest

###### chainId

`8453`

###### data

`` `0x${string}` ``

###### to

`` `0x${string}` ``

###### value

`"0x0"`

###### ownerAddress?

`string` | `null`

###### ownerIndexLookupAddress?

`string` | `null`

###### opts?

###### approvalRunId?

`string` \| `null`

###### onStageEvent?

(`event`) => `void` \| `null`

###### Returns

`Promise`\<`void`\>

##### setAdvancedBusy

> **setAdvancedBusy**: `Dispatch`\<`SetStateAction`\<`boolean`\>\>

##### setBusyProvider

> **setBusyProvider**: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

##### setConnectedOwnerState

> **setConnectedOwnerState**: `Dispatch`\<`SetStateAction`\<[`ConnectedOwnerState`](types.md#connectedownerstate)\>\>

##### setError

> **setError**: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

##### setMe

> **setMe**: `Dispatch`\<`SetStateAction`\<[`AccountSetupMe`](types.md#accountsetupme) \| `null`\>\>

##### setNotice

> **setNotice**: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

##### setOwnerDelegationFlags

> **setOwnerDelegationFlags**: `Dispatch`\<`SetStateAction`\<[`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`\>\>

##### setZoraStatus

> **setZoraStatus**: `Dispatch`\<`SetStateAction`\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`\>\>

##### signerClientReady

> **signerClientReady**: `boolean`

##### subAccountAddress

> **subAccountAddress**: `` `0x${string}` `` \| `null` = `subAccount.subAccountAddress`

##### subAccountError

> **subAccountError**: `Error` \| `null` = `subAccount.error`

##### subAccountReady

> **subAccountReady**: `boolean`

##### subAccountSettingUp

> **subAccountSettingUp**: `boolean` = `subAccount.isSettingUp`

##### subAccountStage

> **subAccountStage**: [`SubAccountSetupStageEvent`](../../lib/wallet/subAccountSetup.md#subaccountsetupstageevent) \| `null` = `subAccount.lastStage`

##### switchChainAsync

> **switchChainAsync**: `SwitchChainMutateAsync`\<`Config`\<readonly \[\{ \}, \{ \}, \{ \}, \{ \}, \{ \}\], \{ `1`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `10`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `137`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `42161`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `8453`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; \}, `any`\>, `unknown`\>

##### telegramLaunchParamsAvailable

> **telegramLaunchParamsAvailable**: `boolean`

##### walletClient

> **walletClient**: \{ \} \| `undefined`

##### zoraCrossAppCount

> **zoraCrossAppCount**: `number`

##### zoraHandoffUrl

> **zoraHandoffUrl**: `string`

##### zoraLinked

> **zoraLinked**: `boolean`

##### zoraStatus

> **zoraStatus**: [`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`
