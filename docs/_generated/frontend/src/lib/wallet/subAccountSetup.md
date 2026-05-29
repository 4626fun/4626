[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/subAccountSetup

# src/lib/wallet/subAccountSetup

## Type Aliases

### SubAccount

> **SubAccount** = `object`

Defined in: [src/lib/wallet/subAccountSetup.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L33)

#### Properties

##### address

> **address**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L34)

##### factory?

> `optional` **factory**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L35)

##### factoryData?

> `optional` **factoryData**: `Hex`

Defined in: [src/lib/wallet/subAccountSetup.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L36)

***

### SubAccountSetupResult

> **SubAccountSetupResult** = `object`

Defined in: [src/lib/wallet/subAccountSetup.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L39)

#### Properties

##### created

> **created**: `boolean`

Defined in: [src/lib/wallet/subAccountSetup.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L42)

##### parentAddress

> **parentAddress**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L41)

##### subAccountAddress

> **subAccountAddress**: `Address`

Defined in: [src/lib/wallet/subAccountSetup.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L40)

***

### SubAccountSetupStage

> **SubAccountSetupStage** = `"check_existing"` \| `"create_sub_account"` \| `"install_embedded_owner"` \| `"configure_signer"` \| `"done"`

Defined in: [src/lib/wallet/subAccountSetup.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L45)

***

### SubAccountSetupStageEvent

> **SubAccountSetupStageEvent** = `object`

Defined in: [src/lib/wallet/subAccountSetup.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L52)

#### Properties

##### message?

> `optional` **message**: `string`

Defined in: [src/lib/wallet/subAccountSetup.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L57)

##### parentAddress?

> `optional` **parentAddress**: `string` \| `null`

Defined in: [src/lib/wallet/subAccountSetup.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L56)

##### stage

> **stage**: [`SubAccountSetupStage`](#subaccountsetupstage)

Defined in: [src/lib/wallet/subAccountSetup.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L53)

##### status

> **status**: `"start"` \| `"success"` \| `"error"`

Defined in: [src/lib/wallet/subAccountSetup.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L54)

##### subAccountAddress?

> `optional` **subAccountAddress**: `string` \| `null`

Defined in: [src/lib/wallet/subAccountSetup.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L55)

## Functions

### configureSubAccountSigner()

> **configureSubAccountSigner**(`params`): `void`

Defined in: [src/lib/wallet/subAccountSetup.ts:205](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L205)

Configure the Base Account SDK to use the Privy embedded wallet as the
signer for sub-account operations. After this call, all transactions sent
with `from: subAccountAddress` are signed by the Privy embedded wallet —
no passkey prompts.

`params` carries the Base Account SDK instance (from `useBaseAccountSdk()`),
the `toViemAccount` function from `@privy-io/react-auth`, and the Privy
`ConnectedWallet` for the embedded EOA.

#### Parameters

##### params

###### baseAccountSdk

\{ `getProvider?`: () => `SubAccountRpcProvider`; `subAccount`: \{ `create?`: (`account`) => `Promise`\<[`SubAccount`](#subaccount)\>; `setToOwnerAccount`: (`fn`) => `void`; \}; \}

###### baseAccountSdk.getProvider?

() => `SubAccountRpcProvider`

###### baseAccountSdk.subAccount

\{ `create?`: (`account`) => `Promise`\<[`SubAccount`](#subaccount)\>; `setToOwnerAccount`: (`fn`) => `void`; \}

###### baseAccountSdk.subAccount.create?

(`account`) => `Promise`\<[`SubAccount`](#subaccount)\>

###### baseAccountSdk.subAccount.setToOwnerAccount

(`fn`) => `void`

###### embeddedWallet

`any`

###### toViemAccountFn

(`args`) => `Promise`\<`any`\>

#### Returns

`void`

***

### confirmSubAccountEmbeddedOwner()

> **confirmSubAccountEmbeddedOwner**(`params`): `Promise`\<\{ `alreadyOwner`: `boolean`; `transactionHash`: `` `0x${string}` `` \| `null`; \}\>

Defined in: [src/lib/wallet/subAccountSetup.ts:350](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L350)

Phase 2 — user signs `addOwnerAddress(privyEmbeddedEoa)` on the sub-account.

#### Parameters

##### params

###### embeddedEoaAddress

`string`

###### onStageEvent?

(`event`) => `void`

###### parentAddress

`string`

###### provider

\{ `request`: (`args`) => `Promise`\<`unknown`\>; \}

###### provider.request

(`args`) => `Promise`\<`unknown`\>

###### subAccountAddress

`string`

#### Returns

`Promise`\<\{ `alreadyOwner`: `boolean`; `transactionHash`: `` `0x${string}` `` \| `null`; \}\>

***

### createSubAccount()

> **createSubAccount**(`params`): `Promise`\<[`SubAccount`](#subaccount)\>

Defined in: [src/lib/wallet/subAccountSetup.ts:155](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L155)

Create a new sub-account with the Privy embedded wallet address as
the initial signer key.  Triggers one passkey popup for the user.

#### Parameters

##### params

###### baseAccountSdk?

\{ `getProvider?`: () => `SubAccountRpcProvider`; `subAccount`: \{ `create?`: (`account`) => `Promise`\<[`SubAccount`](#subaccount)\>; `setToOwnerAccount`: (`fn`) => `void`; \}; \}

###### baseAccountSdk.getProvider?

() => `SubAccountRpcProvider`

###### baseAccountSdk.subAccount

\{ `create?`: (`account`) => `Promise`\<[`SubAccount`](#subaccount)\>; `setToOwnerAccount`: (`fn`) => `void`; \}

###### baseAccountSdk.subAccount.create?

(`account`) => `Promise`\<[`SubAccount`](#subaccount)\>

###### baseAccountSdk.subAccount.setToOwnerAccount

(`fn`) => `void`

###### embeddedWalletAddress

`string`

###### provider

`any`

#### Returns

`Promise`\<[`SubAccount`](#subaccount)\>

***

### finalizeSubAccountSigner()

> **finalizeSubAccountSigner**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/wallet/subAccountSetup.ts:400](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L400)

Phase 3 — route future sub-account sends through the Privy embedded EOA (silent).

#### Parameters

##### params

`SubAccountWalletBundle` & `object`

#### Returns

`Promise`\<`void`\>

***

### getExistingSubAccount()

> **getExistingSubAccount**(`params`): `Promise`\<[`SubAccount`](#subaccount) \| `null`\>

Defined in: [src/lib/wallet/subAccountSetup.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L121)

Check for an existing sub-account on the Base Account for the current
app domain.  Returns the sub-account if found, or null.

#### Parameters

##### params

###### parentAddress

`string`

###### provider

`any`

#### Returns

`Promise`\<[`SubAccount`](#subaccount) \| `null`\>

***

### provisionSubAccount()

> **provisionSubAccount**(`params`): `Promise`\<[`SubAccountSetupResult`](#subaccountsetupresult) & `object`\>

Defined in: [src/lib/wallet/subAccountSetup.ts:284](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L284)

Phase 1 — discover or create the per-app sub-account (one passkey prompt
when creating). Does not install on-chain owner or configure the SDK signer.

#### Parameters

##### params

`SubAccountWalletBundle`

#### Returns

`Promise`\<[`SubAccountSetupResult`](#subaccountsetupresult) & `object`\>

***

### resolveSubAccountProvider()

> **resolveSubAccountProvider**(`params`): `Promise`\<`SubAccountRpcProvider`\>

Defined in: [src/lib/wallet/subAccountSetup.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L96)

Base App injects sub-account RPCs on the Base Account SDK provider
(`baseAccountSdk.getProvider()` → `window.ethereum.isCoinbaseBrowser`).
Privy's ConnectedWallet provider does not forward `wallet_addSubAccount`,
which surfaces as `-32604 method not supported` inside Base App.

#### Parameters

##### params

`SubAccountWalletBundle`

#### Returns

`Promise`\<`SubAccountRpcProvider`\>

***

### resolveSubAccountSetupContext()

> **resolveSubAccountSetupContext**(`params`): `Promise`\<\{ `embeddedAddress`: `string`; `parentAddress`: `string`; `provider`: `any`; \}\>

Defined in: [src/lib/wallet/subAccountSetup.ts:254](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L254)

Wallet + SDK bundle ready for sub-account RPCs (no create/provision side effects).

#### Parameters

##### params

`SubAccountWalletBundle`

#### Returns

`Promise`\<\{ `embeddedAddress`: `string`; `parentAddress`: `string`; `provider`: `any`; \}\>

***

### setupSubAccount()

> **setupSubAccount**(`params`): `Promise`\<[`SubAccountSetupResult`](#subaccountsetupresult)\>

Defined in: [src/lib/wallet/subAccountSetup.ts:457](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountSetup.ts#L457)

Full sub-account setup flow (all phases in one call):
  1. Discover or create sub-account (passkey only when creating)
  2. Install Privy embedded EOA as on-chain owner via addOwnerAddress on the sub-account
  3. Configure Privy embedded wallet as SDK signer (silent)

Parent CSW owner mutation from third-party dapps remains blocked; owner install
targets the per-app sub-account only.

#### Parameters

##### params

###### baseAccountSdk

\{ `getProvider?`: () => `SubAccountRpcProvider`; `subAccount`: \{ `create?`: (`account`) => `Promise`\<[`SubAccount`](#subaccount)\>; `setToOwnerAccount`: (`fn`) => `void`; \}; \}

The Base Account SDK instance from `useBaseAccountSdk()`.

###### baseAccountSdk.getProvider?

() => `SubAccountRpcProvider`

###### baseAccountSdk.subAccount

\{ `create?`: (`account`) => `Promise`\<[`SubAccount`](#subaccount)\>; `setToOwnerAccount`: (`fn`) => `void`; \}

###### baseAccountSdk.subAccount.create?

(`account`) => `Promise`\<[`SubAccount`](#subaccount)\>

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
