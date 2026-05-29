[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/accountSetup/LinkedIdentitiesSection

# src/features/accountSetup/LinkedIdentitiesSection

## Functions

### LinkedIdentitiesSection()

> **LinkedIdentitiesSection**(`__namedParameters`): `Element`

Defined in: [src/features/accountSetup/LinkedIdentitiesSection.tsx:40](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/LinkedIdentitiesSection.tsx#L40)

#### Parameters

##### \_\_namedParameters

###### controller

\{ `activeExternalOwnerWallet`: `any`; `activePrivyWallet`: `any`; `advancedBusy`: `boolean`; `authHeaders`: () => `Promise`\<`Record`\<`string`, `string`\>\>; `baseAppUrl`: `string` \| `null`; `busyProvider`: `string` \| `null`; `canonicalCswAddress`: `string` \| `null`; `canShowAdvanced`: `boolean`; `chainId`: `number` \| `undefined`; `connectedAddress`: `string` \| `undefined`; `connectedCanonicalWalletSelected`: `boolean`; `connectedOnchainEoaOwner`: \{ `index`: `number`; `ownerAddress`: `` `0x${string}` ``; \} \| `null`; `connectedOwnerReady`: `boolean`; `connectedOwnerState`: [`ConnectedOwnerState`](types.md#connectedownerstate); `connectedSignerDetail`: `string`; `connectedSignerLabel`: `string`; `connectOwnerWallet`: () => `Promise`\<`void`\>; `connectWallet`: `any`; `cswOwnersState`: [`CswOwnersState`](types.md#cswownersstate); `ensureEmbeddedWallet`: () => `Promise`\<\{ `address`: `string`; `created`: `boolean`; \}\>; `error`: `string` \| `null`; `getAccessToken`: () => `Promise`\<`string` \| `null`\>; `inTelegramMiniApp`: `boolean`; `linkCrossAppAccount`: `any`; `loading`: `boolean`; `loadMe`: (`options?`) => `Promise`\<`void`\>; `login`: `any`; `loginWithCrossAppAccount`: `any`; `me`: [`AccountSetupMe`](types.md#accountsetupme) \| `null`; `needsBaseAppSetup`: `boolean`; `needsEmbeddedWallet`: `boolean`; `notice`: `string` \| `null`; `onAddRabbyCoOwner`: (`_advancedOwnerAddress`) => `Promise`\<`void`\>; `onchainEoaOwnerCandidates`: `object`[]; `onLinkProvider`: (`provider`) => `Promise`\<`void`\>; `onLinkZora`: () => `Promise`\<`void`\>; `onRefreshZora`: () => `Promise`\<`void`\>; `onResetOwnerApproval`: () => `Promise`\<`void`\>; `onSwitchAccount`: () => `Promise`\<`void`\>; `onUnlinkProvider`: (`provider`) => `Promise`\<`void`\>; `ownerApprovalReady`: `boolean`; `ownerAuthorityState`: [`OwnerAuthorityState`](types.md#ownerauthoritystate); `ownerChecklist`: [`OwnerChecklistItem`](types.md#ownerchecklistitem)[]; `ownerDelegationFlags`: [`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`; `ownerInstallResumeState`: [`OwnerInstallResumeState`](types.md#ownerinstallresumestate); `ownerInstallSectionRef`: `RefObject`\<`HTMLElement` \| `null`\>; `ownerPrimaryCtaLabel`: `string`; `ownerSignerAddress`: `any`; `ownerSignerChainId`: `number` \| `null`; `prefersWalletConnectQr`: `boolean`; `privy`: `any`; `privyAuthed`: `boolean`; `privySignerClientReady`: `boolean`; `privyWallets`: `Record`\<`string`, `unknown`\>[]; `providerCards`: `object`[]; `providerCollision`: `EthereumProviderCollisionState`; `publicClient`: \{ \} \| \{ \} \| \{ \} \| \{ \} \| \{ \}; `readableCswOwners`: `object`[]; `refreshCswOwners`: () => `Promise`\<`void`\>; `requiresBaseAppForOwnerInstall`: `boolean`; `retryOwnerCheck`: () => `Promise`\<`void`\>; `sendPreparedOwnerTx`: () => `Promise`\<`never`\>; `setAdvancedBusy`: `Dispatch`\<`SetStateAction`\<`boolean`\>\>; `setBusyProvider`: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>; `setConnectedOwnerState`: `Dispatch`\<`SetStateAction`\<[`ConnectedOwnerState`](types.md#connectedownerstate)\>\>; `setError`: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>; `setMe`: `Dispatch`\<`SetStateAction`\<[`AccountSetupMe`](types.md#accountsetupme) \| `null`\>\>; `setNotice`: `Dispatch`\<`SetStateAction`\<`string` \| `null`\>\>; `setOwnerDelegationFlags`: `Dispatch`\<`SetStateAction`\<[`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`\>\>; `setZoraStatus`: `Dispatch`\<`SetStateAction`\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`\>\>; `signerClientReady`: `boolean`; `submitOwnerInstallViaOnchainEoa`: (`txRequest`) => `Promise`\<`` `0x${string}` ``\>; `switchChainAsync`: `SwitchChainMutateAsync`\<`Config`\<readonly \[\{ \}, \{ \}, \{ \}, \{ \}, \{ \}\], \{ `1`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `10`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `137`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `42161`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; `8453`: `HttpTransport`\<`undefined`, `false`\> \| `FallbackTransport`\<`Transport`[]\>; \}, `any`\>, `unknown`\>; `telegramLaunchParamsAvailable`: `boolean`; `walletClient`: \{ \} \| `undefined`; `zoraCrossAppCount`: `number`; `zoraHandoffUrl`: `string`; `zoraLinked`: `boolean`; `zoraStatus`: [`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`; \}

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

`string` \| `undefined`

###### controller.connectedCanonicalWalletSelected

`boolean`

###### controller.connectedOnchainEoaOwner

\{ `index`: `number`; `ownerAddress`: `` `0x${string}` ``; \} \| `null`

###### controller.connectedOwnerReady

`boolean`

###### controller.connectedOwnerState

[`ConnectedOwnerState`](types.md#connectedownerstate)

###### controller.connectedSignerDetail

`string`

###### controller.connectedSignerLabel

`string`

###### controller.connectOwnerWallet

() => `Promise`\<`void`\>

###### controller.connectWallet

`any`

###### controller.cswOwnersState

[`CswOwnersState`](types.md#cswownersstate)

###### controller.ensureEmbeddedWallet

() => `Promise`\<\{ `address`: `string`; `created`: `boolean`; \}\>

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

(`_advancedOwnerAddress`) => `Promise`\<`void`\>

###### controller.onchainEoaOwnerCandidates

`object`[]

###### controller.onLinkProvider

(`provider`) => `Promise`\<`void`\>

###### controller.onLinkZora

() => `Promise`\<`void`\>

###### controller.onRefreshZora

() => `Promise`\<`void`\>

###### controller.onResetOwnerApproval

() => `Promise`\<`void`\>

###### controller.onSwitchAccount

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

[`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`

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

###### controller.refreshCswOwners

() => `Promise`\<`void`\>

###### controller.requiresBaseAppForOwnerInstall

`boolean`

###### controller.retryOwnerCheck

() => `Promise`\<`void`\>

###### controller.sendPreparedOwnerTx

() => `Promise`\<`never`\>

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

`Dispatch`\<`SetStateAction`\<[`OwnerDelegationFlags`](../../lib/wallet/onboardingWalletDelegation.md#ownerdelegationflags) \| `null`\>\>

###### controller.setZoraStatus

`Dispatch`\<`SetStateAction`\<[`ZoraLinkStatusResponse`](types.md#zoralinkstatusresponse) \| `null`\>\>

###### controller.signerClientReady

`boolean`

###### controller.submitOwnerInstallViaOnchainEoa

(`txRequest`) => `Promise`\<`` `0x${string}` ``\>

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

###### showPoints?

`boolean` = `true`

#### Returns

`Element`
