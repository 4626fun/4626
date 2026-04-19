[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useSubAccountSetup

# src/hooks/useSubAccountSetup

## Functions

### useSubAccountSetup()

> **useSubAccountSetup**(): `object`

Defined in: [src/hooks/useSubAccountSetup.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useSubAccountSetup.ts#L35)

#### Returns

##### baseAccountWallet

> **baseAccountWallet**: `ConnectedWallet` \| `null`

The detected Base Account wallet instance.

##### canSetup

> **canSetup**: `boolean`

Whether setup can be initiated (all required wallets/SDK available).

##### created

> **created**: `boolean` = `state.created`

Whether a new sub-account was created (vs reusing an existing one).

##### embeddedWallet

> **embeddedWallet**: `ConnectedWallet` \| `null`

The detected Privy embedded wallet instance.

##### error

> **error**: `Error` \| `null` = `state.error`

The last error, if any.

##### isSettingUp

> **isSettingUp**: `boolean` = `state.isSettingUp`

Whether setup is currently in progress.

##### lastStage

> **lastStage**: [`SubAccountSetupStageEvent`](../lib/wallet/subAccountSetup.md#subaccountsetupstageevent) \| `null` = `state.lastStage`

The last stage event from the setup flow.

##### parentAddress

> **parentAddress**: `` `0x${string}` `` \| `null` = `state.parentAddress`

The parent CSW address (universal account).

##### setupSubAccount()

> **setupSubAccount**: () => `Promise`\<[`SubAccountSetupResult`](../lib/wallet/subAccountSetup.md#subaccountsetupresult) \| `null`\> = `setup`

Run the sub-account setup flow.

###### Returns

`Promise`\<[`SubAccountSetupResult`](../lib/wallet/subAccountSetup.md#subaccountsetupresult) \| `null`\>

##### subAccountAddress

> **subAccountAddress**: `` `0x${string}` `` \| `null` = `state.subAccountAddress`

The sub-account address (execution address for the app).
