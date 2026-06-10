[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useSubAccountSetup

# src/hooks/useSubAccountSetup

## Type Aliases

### SubAccountSetupControls

> **SubAccountSetupControls** = `ReturnType`\<*typeof* [`useSubAccountSetup`](#usesubaccountsetup)\>

Defined in: [src/hooks/useSubAccountSetup.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSubAccountSetup.ts#L88)

## Functions

### useSubAccountSetup()

> **useSubAccountSetup**(): `object`

Defined in: [src/hooks/useSubAccountSetup.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSubAccountSetup.ts#L90)

#### Returns

`object`

##### baseAccountWallet

> **baseAccountWallet**: `ConnectedWalletLike` \| `null`

##### canSetup

> **canSetup**: `boolean`

##### confirmSubAccountEmbeddedOwner()

> **confirmSubAccountEmbeddedOwner**: (`addresses`) => `Promise`\<\{ `alreadyOwner`: `boolean`; `transactionHash`: `` `0x${string}` `` \| `null`; \} \| `null`\> = `confirmEmbeddedOwner`

###### Parameters

###### addresses

###### parentAddress

`string`

###### provider

\{ `request`: (`args`) => `Promise`\<`unknown`\>; \}

###### provider.request

(`args`) => `Promise`\<`unknown`\>

###### subAccountAddress

`string`

###### Returns

`Promise`\<\{ `alreadyOwner`: `boolean`; `transactionHash`: `` `0x${string}` `` \| `null`; \} \| `null`\>

##### connectBaseAccountWallet()

> **connectBaseAccountWallet**: (`opts?`) => `Promise`\<`boolean`\>

###### Parameters

###### opts?

###### canonicalCswAddress?

`string` \| `null`

###### requireEmbeddedEoa?

`boolean`

###### Returns

`Promise`\<`boolean`\>

##### created

> **created**: `boolean` = `state.created`

##### embeddedWallet

> **embeddedWallet**: `ConnectedWalletLike` \| `null`

##### error

> **error**: `Error` \| `null` = `state.error`

##### finalizeSubAccountSigner()

> **finalizeSubAccountSigner**: (`addresses`) => `Promise`\<`boolean` \| `null`\> = `finalizeSigner`

###### Parameters

###### addresses

###### parentAddress

`string`

###### subAccountAddress

`string`

###### Returns

`Promise`\<`boolean` \| `null`\>

##### getLastSetupError()

> **getLastSetupError**: () => `Error` \| `null`

###### Returns

`Error` \| `null`

##### installSubAccountOwnerOnly()

> **installSubAccountOwnerOnly**: (`addresses`) => `Promise`\<\{ `alreadyOwner`: `boolean`; `onChainOwnerInstalled`: `boolean`; `onChainOwnerWarning`: `string` \| `null`; `registered`: `boolean`; `transactionHash`: `` `0x${string}` `` \| `null`; \} \| `null`\>

###### Parameters

###### addresses

###### parentAddress

`string`

###### subAccountAddress

`string`

###### Returns

`Promise`\<\{ `alreadyOwner`: `boolean`; `onChainOwnerInstalled`: `boolean`; `onChainOwnerWarning`: `string` \| `null`; `registered`: `boolean`; `transactionHash`: `` `0x${string}` `` \| `null`; \} \| `null`\>

##### isSettingUp

> **isSettingUp**: `boolean` = `state.isSettingUp`

##### lastStage

> **lastStage**: [`SubAccountSetupStageEvent`](../lib/wallet/subAccountSetup.md#subaccountsetupstageevent) \| `null` = `state.lastStage`

##### parentAddress

> **parentAddress**: `string` \| `null` = `state.parentAddress`

##### provisionSubAccount()

> **provisionSubAccount**: () => `Promise`\<[`SubAccountSetupResult`](../lib/wallet/subAccountSetup.md#subaccountsetupresult) & `object` \| `null`\> = `provision`

###### Returns

`Promise`\<[`SubAccountSetupResult`](../lib/wallet/subAccountSetup.md#subaccountsetupresult) & `object` \| `null`\>

##### setupSubAccount()

> **setupSubAccount**: () => `Promise`\<[`SubAccountSetupResult`](../lib/wallet/subAccountSetup.md#subaccountsetupresult) \| `null`\> = `setup`

###### Returns

`Promise`\<[`SubAccountSetupResult`](../lib/wallet/subAccountSetup.md#subaccountsetupresult) \| `null`\>

##### subAccountAddress

> **subAccountAddress**: `string` \| `null` = `state.subAccountAddress`
