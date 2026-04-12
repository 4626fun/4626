[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/accountSetup/AccountSetupWorkspaceView

# src/features/accountSetup/AccountSetupWorkspaceView

## Functions

### AccountSetupWorkspaceView()

> **AccountSetupWorkspaceView**(`props`): `Element` \| `null`

Defined in: [src/features/accountSetup/AccountSetupWorkspaceView.tsx:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/accountSetup/AccountSetupWorkspaceView.tsx#L13)

#### Parameters

##### props

###### context

`"accounts"` \| `"waitlist"`

###### controller

\{ `activeExternalOwnerWallet`: `any`; `activePrivyWallet`: `any`; `advancedBusy`: `boolean`; `authHeaders`: () => `Promise`\<`Record`\<`string`, `string`\>\>; `baseAppUrl`: `string` \| `null`; `busyProvider`: `string` \| `null`; `canonicalCswAddress`: `string` \| `null`; `canShowAdvanced`: `boolean`; `chainId`: `number` \| `undefined`; `connectedAddress`: `` `0x${string}` `` \| `undefined`; `connectedCanonicalWalletSelected`: `boolean`; `connectedOwnerReady`: `boolean`; `connectedOwnerState`: [`ConnectedOwnerState`](types.md#connectedownerstate); `connectedSignerDetail`: `string`; `connectedSignerLabel`: `string`; `connectOwnerWallet`: () => `void`; `connectWallet`: `any`; `cswOwnersState`: [`CswOwnersState`](types.md#cswownersstate); `ensureEmbeddedWallet`: () => `Promise`\<\{ `address`: `` `0x${string}` ``; `created`: `boolean`; \}\>; `error`: `string` \| `null`; `getAccessToken`: () => `Promise`\<`string` \| `null`\>; `inTelegramMiniApp`: `boolean`; `linkCrossAppAccount`: `any`; `loading`: `boolean`; `loadMe`: (`options?`) => `Promise`\<`void`\>; `login`: `any`; `loginWithCrossAppAccount`: `any`; `me`: [`AccountSetupMe`](types.md#accountsetupme) \| `null`; `needsBaseAppSetup`: `boolean`; `needsEmbeddedWallet`: `boolean`; `notice`: `string` \| `null`; `onAddRabbyCoOwner`: (`advancedOwnerAddress`) => `Promise`\<`void`\>; `onEnable4626Signing`: () => `Promise`\<`void`\>; `onLinkProvider`: (`provider`) => `Promise`\<`void`\>; `onLinkZora`: () => `Promise`\<`void`\>; `onRefreshZora`: () => `Promise`\<`void`\>; `onUnlinkProvider`: (`provider`) => `Promise`\<`void`\>; `ownerApprovalReady`: `boolean`; `ownerAuthorityState`: [`OwnerAuthorityState`](types.md#ownerauthoritystate); `ownerChecklist`: [`OwnerChecklistItem`](types.md#ownerchecklistitem)[]; `ownerDelegationFlags`: [`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`; `ownerInstallResumeState`: [`OwnerInstallResumeState`](types.md#ownerinstallresumestate); `ownerInstallSectionRef`: `RefObject`\<`HTMLElement` \| `null`\>; `ownerPrimaryCtaLabel`: `string`; `ownerSignerAddress`: `any`; `ownerSignerChainId`: `number` \| `null`; `prefersWalletConnectQr`: `boolean`; `privy`: `any`; `privyAuthed`: `boolean`; `privySignerClientReady`: `boolean`; `privyWallets`: `Record`\<`string`, `unknown`\>[]; `providerCards`: `object`[]; `providerCollision`: `EthereumProviderCollisionState`; `publicClient`: \{ \} \| \{ \} \| \{ \} \| \{ \} \| \{ \}; `readableCswOwners`: `object`[]; `retryOwnerCheck`: () => `Promise`\<`void`\>; `sendPreparedOwnerTx`: (`txRequest`, `ownerAddress?`) => `Promise`\<`void`\>; `setAdvancedBusy`: `Dispatch`\<`SetStateAction`\<`boolean`\>\>; `setBusyProvider`: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>; `setConnectedOwnerState`: `Dispatch`\<`SetStateAction`\<[`ConnectedOwnerState`](types.md#connectedownerstate)\>\>; `setError`: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>; `setMe`: `Dispatch`\<`SetStateAction`\<[`AccountSetupMe`](types.md#accountsetupme) \| `null`\>\>; `setNotice`: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>; `setOwnerDelegationFlags`: `Dispatch`\<`SetStateAction`\<[`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`\>\>; `setZoraStatus`: `Dispatch`\<`SetStateAction`\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`\>\>; `signerClientReady`: `boolean`; `switchChainAsync`: `SwitchChainMutateAsync`\<`Config`\<readonly \[\{ \}, \{ \}, \{ \}, \{ \}, \{ \}\], \{ `1`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `10`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `137`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `42161`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `8453`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; \}, `any`\>, `unknown`\>; `telegramLaunchParamsAvailable`: `boolean`; `walletClient`: \{ \} \| `undefined`; `zoraCrossAppCount`: `number`; `zoraHandoffUrl`: `string`; `zoraLinked`: `boolean`; `zoraStatus`: [`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`; \}

###### controller.activeExternalOwnerWallet

`any`

###### controller.activePrivyWallet

`any`

###### controller.advancedBusy

`boolean`

###### controller.authHeaders

() => `Promise`\<`Record`\<`string`, `string`\>\>

###### controller.baseAppUrl

`string` \| `null`

###### controller.busyProvider

`string` \| `null`

###### controller.canonicalCswAddress

`string` \| `null`

###### controller.canShowAdvanced

`boolean`

###### controller.chainId

`number` \| `undefined`

###### controller.connectedAddress

`` `0x${string}` `` \| `undefined`

###### controller.connectedCanonicalWalletSelected

`boolean`

###### controller.connectedOwnerReady

`boolean`

###### controller.connectedOwnerState

[`ConnectedOwnerState`](types.md#connectedownerstate)

###### controller.connectedSignerDetail

`string`

###### controller.connectedSignerLabel

`string`

###### controller.connectOwnerWallet

() => `void`

###### controller.connectWallet

`any`

###### controller.cswOwnersState

[`CswOwnersState`](types.md#cswownersstate)

###### controller.ensureEmbeddedWallet

() => `Promise`\<\{ `address`: `` `0x${string}` ``; `created`: `boolean`; \}\>

###### controller.error

`string` \| `null`

###### controller.getAccessToken

() => `Promise`\<`string` \| `null`\>

###### controller.inTelegramMiniApp

`boolean`

###### controller.linkCrossAppAccount

`any`

###### controller.loading

`boolean`

###### controller.loadMe

(`options?`) => `Promise`\<`void`\>

###### controller.login

`any`

###### controller.loginWithCrossAppAccount

`any`

###### controller.me

[`AccountSetupMe`](types.md#accountsetupme) \| `null`

###### controller.needsBaseAppSetup

`boolean`

###### controller.needsEmbeddedWallet

`boolean`

###### controller.notice

`string` \| `null`

###### controller.onAddRabbyCoOwner

(`advancedOwnerAddress`) => `Promise`\<`void`\>

###### controller.onEnable4626Signing

() => `Promise`\<`void`\>

###### controller.onLinkProvider

(`provider`) => `Promise`\<`void`\>

###### controller.onLinkZora

() => `Promise`\<`void`\>

###### controller.onRefreshZora

() => `Promise`\<`void`\>

###### controller.onUnlinkProvider

(`provider`) => `Promise`\<`void`\>

###### controller.ownerApprovalReady

`boolean`

###### controller.ownerAuthorityState

[`OwnerAuthorityState`](types.md#ownerauthoritystate)

###### controller.ownerChecklist

[`OwnerChecklistItem`](types.md#ownerchecklistitem)[]

###### controller.ownerDelegationFlags

[`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`

###### controller.ownerInstallResumeState

[`OwnerInstallResumeState`](types.md#ownerinstallresumestate)

###### controller.ownerInstallSectionRef

`RefObject`\<`HTMLElement` \| `null`\>

###### controller.ownerPrimaryCtaLabel

`string`

###### controller.ownerSignerAddress

`any`

###### controller.ownerSignerChainId

`number` \| `null`

###### controller.prefersWalletConnectQr

`boolean`

###### controller.privy

`any`

###### controller.privyAuthed

`boolean`

###### controller.privySignerClientReady

`boolean`

###### controller.privyWallets

`Record`\<`string`, `unknown`\>[]

###### controller.providerCards

`object`[]

###### controller.providerCollision

`EthereumProviderCollisionState`

###### controller.publicClient

\{ \} \| \{ \} \| \{ \} \| \{ \} \| \{ \}

###### controller.readableCswOwners

`object`[]

###### controller.retryOwnerCheck

() => `Promise`\<`void`\>

###### controller.sendPreparedOwnerTx

(`txRequest`, `ownerAddress?`) => `Promise`\<`void`\>

###### controller.setAdvancedBusy

`Dispatch`\<`SetStateAction`\<`boolean`\>\>

###### controller.setBusyProvider

`Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

###### controller.setConnectedOwnerState

`Dispatch`\<`SetStateAction`\<[`ConnectedOwnerState`](types.md#connectedownerstate)\>\>

###### controller.setError

`Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

###### controller.setMe

`Dispatch`\<`SetStateAction`\<[`AccountSetupMe`](types.md#accountsetupme) \| `null`\>\>

###### controller.setNotice

`Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>

###### controller.setOwnerDelegationFlags

`Dispatch`\<`SetStateAction`\<[`OwnerDelegationFlags`](../../lib/wallet/onboardingWallet.md#ownerdelegationflags) \| `null`\>\>

###### controller.setZoraStatus

`Dispatch`\<`SetStateAction`\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`\>\>

###### controller.signerClientReady

`boolean`

###### controller.switchChainAsync

`SwitchChainMutateAsync`\<`Config`\<readonly \[\{ \}, \{ \}, \{ \}, \{ \}, \{ \}\], \{ `1`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `10`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `137`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `42161`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `8453`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; \}, `any`\>, `unknown`\>

###### controller.telegramLaunchParamsAvailable

`boolean`

###### controller.walletClient

\{ \} \| `undefined`

###### controller.zoraCrossAppCount

`number`

###### controller.zoraHandoffUrl

`string`

###### controller.zoraLinked

`boolean`

###### controller.zoraStatus

[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`

###### summaryActions?

`ReactNode`

#### Returns

`Element` \| `null`
