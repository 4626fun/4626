[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/subAccountSetup

# src/lib/wallet/subAccountSetup

## Type Aliases

### SubAccount

> **SubAccount** = `object`

Defined in: [src/lib/wallet/subAccountSetup.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L30)

#### Properties

##### address

> **address**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L31)

##### factory?

> `optional` **factory**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L32)

##### factoryData?

> `optional` **factoryData**: `Hex`

Defined in: [src/lib/wallet/subAccountSetup.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L33)

***

### SubAccountSetupResult

> **SubAccountSetupResult** = `object`

Defined in: [src/lib/wallet/subAccountSetup.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L36)

#### Properties

##### created

> **created**: `boolean`

Defined in: [src/lib/wallet/subAccountSetup.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L39)

##### parentAddress

> **parentAddress**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L38)

##### subAccountAddress

> **subAccountAddress**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L37)

***

### SubAccountSetupStage

> **SubAccountSetupStage** = `"check_existing"` \| `"create_sub_account"` \| `"configure_signer"` \| `"done"`

Defined in: [src/lib/wallet/subAccountSetup.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L42)

***

### SubAccountSetupStageEvent

> **SubAccountSetupStageEvent** = `object`

Defined in: [src/lib/wallet/subAccountSetup.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L48)

#### Properties

##### message?

> `optional` **message**: `string`

Defined in: [src/lib/wallet/subAccountSetup.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L53)

##### parentAddress?

> `optional` **parentAddress**: `string` \| `null`

Defined in: [src/lib/wallet/subAccountSetup.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L52)

##### stage

> **stage**: [`SubAccountSetupStage`](#subaccountsetupstage)

Defined in: [src/lib/wallet/subAccountSetup.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L49)

##### status

> **status**: `"start"` \| `"success"` \| `"error"`

Defined in: [src/lib/wallet/subAccountSetup.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L50)

##### subAccountAddress?

> `optional` **subAccountAddress**: `string` \| `null`

Defined in: [src/lib/wallet/subAccountSetup.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L51)

## Functions

### configureSubAccountSigner()

> **configureSubAccountSigner**(`params`): `void`

Defined in: [src/lib/wallet/subAccountSetup.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L165)

Configure the Base Account SDK to use the Privy embedded wallet as
the signer for sub-account operations.  After this call, all
transactions sent with `from: subAccountAddress` are signed by the
Privy embedded wallet — no passkey prompts.

#### Parameters

##### params

###### baseAccountSdk

\{ `subAccount`: \{ `setToOwnerAccount`: (`fn`) => `void`; \}; \}

###### baseAccountSdk.subAccount

\{ `setToOwnerAccount`: (`fn`) => `void`; \}

###### baseAccountSdk.subAccount.setToOwnerAccount

(`fn`) => `void`

###### embeddedWallet

`any`

###### toViemAccountFn

(`args`) => `Promise`\<`any`\>

#### Returns

`void`

***

### createSubAccount()

> **createSubAccount**(`params`): `Promise`\<[`SubAccount`](#subaccount)\>

Defined in: [src/lib/wallet/subAccountSetup.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L122)

Create a new sub-account with the Privy embedded wallet address as
the initial signer key.  Triggers one passkey popup for the user.

#### Parameters

##### params

###### embeddedWalletAddress

`` `0x${string}` ``

###### provider

`any`

#### Returns

`Promise`\<[`SubAccount`](#subaccount)\>

***

### getExistingSubAccount()

> **getExistingSubAccount**(`params`): `Promise`\<[`SubAccount`](#subaccount) \| `null`\>

Defined in: [src/lib/wallet/subAccountSetup.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L88)

Check for an existing sub-account on the Base Account for the current
app domain.  Returns the sub-account if found, or null.

#### Parameters

##### params

###### parentAddress

`` `0x${string}` ``

###### provider

`any`

#### Returns

`Promise`\<[`SubAccount`](#subaccount) \| `null`\>

***

### setupSubAccount()

> **setupSubAccount**(`params`): `Promise`\<[`SubAccountSetupResult`](#subaccountsetupresult)\>

Defined in: [src/lib/wallet/subAccountSetup.ts:193](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L193)

Full sub-account setup flow:
  1. Get CSW provider from the Base Account wallet
  2. Check for existing sub-account
  3. Create one if needed (one-time passkey popup)
  4. Configure Privy embedded wallet as signer

Returns the sub-account address for use as the app's execution address.

#### Parameters

##### params

###### baseAccountSdk

\{ `subAccount`: \{ `setToOwnerAccount`: (`fn`) => `void`; \}; \}

The Base Account SDK instance from `useBaseAccountSdk()`.

###### baseAccountSdk.subAccount

\{ `setToOwnerAccount`: (`fn`) => `void`; \}

###### baseAccountSdk.subAccount.setToOwnerAccount

(`fn`) => `void`

###### baseAccountWallet

\{ `address`: `string`; `getEthereumProvider?`: () => `Promise`\<`any`\>; `provider?`: `any`; `switchChain?`: (`chainId`) => `Promise`\<`void`\>; \}

The Privy ConnectedWallet for the Base Account (CSW).

###### baseAccountWallet.address

`string`

###### baseAccountWallet.getEthereumProvider?

() => `Promise`\<`any`\>

###### baseAccountWallet.provider?

`any`

###### baseAccountWallet.switchChain?

(`chainId`) => `Promise`\<`void`\>

###### embeddedWallet

\{ `address`: `string`; `getEthereumProvider?`: () => `Promise`\<`any`\>; `provider?`: `any`; \}

The Privy ConnectedWallet for the embedded EOA.

###### embeddedWallet.address

`string`

###### embeddedWallet.getEthereumProvider?

() => `Promise`\<`any`\>

###### embeddedWallet.provider?

`any`

###### onStageEvent?

(`event`) => `void`

Optional callback for stage events.

###### toViemAccountFn

(`args`) => `Promise`\<`any`\>

The `toViemAccount` utility from `@privy-io/react-auth`.

#### Returns

`Promise`\<[`SubAccountSetupResult`](#subaccountsetupresult)\>
