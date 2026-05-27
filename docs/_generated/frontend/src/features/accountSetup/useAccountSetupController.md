[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/accountSetup/useAccountSetupController

# src/features/accountSetup/useAccountSetupController

## Functions

### readOptionalZoraStatus()

> **readOptionalZoraStatus**(`params`): [`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`

Defined in: [src/features/accountSetup/useAccountSetupController.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/useAccountSetupController.ts#L102)

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

Defined in: [src/features/accountSetup/useAccountSetupController.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/useAccountSetupController.ts#L90)

#### Parameters

##### input

###### advancedBusy

`boolean`

###### ownerDelegationFlags

[`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`

###### privyAuthed

`boolean`

#### Returns

`boolean`

***

### useAccountSetupController()

> **useAccountSetupController**(`params`): `object`

Defined in: [src/features/accountSetup/useAccountSetupController.ts:159](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/useAccountSetupController.ts#L159)

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

> **connectedAddress**: `string` \| `undefined`

##### connectedCanonicalWalletSelected

> **connectedCanonicalWalletSelected**: `boolean`

##### connectedOnchainEoaOwner

> **connectedOnchainEoaOwner**: \{ `index`: `number`; `ownerAddress`: `` `0x${string}` ``; \} \| `null`

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

> **ensureEmbeddedWallet**: () => `Promise`\<\{ `address`: `string`; `created`: `boolean`; \}\>

###### Returns

`Promise`\<\{ `address`: `string`; `created`: `boolean`; \}\>

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

##### needsBaseAppSetup

> **needsBaseAppSetup**: `boolean`

##### needsEmbeddedWallet

> **needsEmbeddedWallet**: `boolean`

##### notice

> **notice**: `string` \| `null`

##### onAddRabbyCoOwner()

> **onAddRabbyCoOwner**: (`_advancedOwnerAddress`) => `Promise`\<`void`\>

###### Parameters

###### \_advancedOwnerAddress

`string`

###### Returns

`Promise`\<`void`\>

##### onchainEoaOwnerCandidates

> **onchainEoaOwnerCandidates**: `object`[]

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

> **ownerDelegationFlags**: [`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`

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

##### refreshCswOwners()

> **refreshCswOwners**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### requiresBaseAppForOwnerInstall

> **requiresBaseAppForOwnerInstall**: `boolean`

##### retryOwnerCheck()

> **retryOwnerCheck**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### sendPreparedOwnerTx()

> **sendPreparedOwnerTx**: () => `Promise`\<`never`\>

###### Returns

`Promise`\<`never`\>

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

> **setOwnerDelegationFlags**: `Dispatch`\<`SetStateAction`\<[`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`\>\>

##### setZoraStatus

> **setZoraStatus**: `Dispatch`\<`SetStateAction`\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`\>\>

##### signerClientReady

> **signerClientReady**: `boolean`

##### submitOwnerInstallViaOnchainEoa()

> **submitOwnerInstallViaOnchainEoa**: (`txRequest`) => `Promise`\<`` `0x${string}` ``\>

###### Parameters

###### txRequest

[`PreparedOwnerTxRequest`](../../lib/wallet/zoraAddOwnerApi.md#preparedownertxrequest)

###### Returns

`Promise`\<`` `0x${string}` ``\>

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
