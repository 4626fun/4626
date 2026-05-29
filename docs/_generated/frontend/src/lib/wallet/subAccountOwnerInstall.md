[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/subAccountOwnerInstall

# src/lib/wallet/subAccountOwnerInstall

## Type Aliases

### InstallEmbeddedOwnerResult

> **InstallEmbeddedOwnerResult** = `object`

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L27)

#### Properties

##### alreadyOwner

> **alreadyOwner**: `boolean`

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L31)

True when the embedded EOA was already an on-chain owner.

##### callBundleId

> **callBundleId**: `string` \| `null`

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L33)

##### installed

> **installed**: `boolean`

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L29)

True when we submitted addOwnerAddress (user signed).

##### transactionHash

> **transactionHash**: `Hex` \| `null`

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L32)

## Functions

### createBaseSubAccountReadClient()

> **createBaseSubAccountReadClient**(): `object`

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L94)

#### Returns

`object`

***

### installEmbeddedOwnerOnSubAccount()

> **installEmbeddedOwnerOnSubAccount**(`params`): `Promise`\<[`InstallEmbeddedOwnerResult`](#installembeddedownerresult)\>

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:157](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L157)

Install the Privy embedded EOA as an owner of the sub-account CSW.

Primary lane: `wallet_sendCalls` (Base App builds UserOps for CSW self-calls).
Fallback: `eth_sendTransaction` when sendCalls is unavailable outside Base App.

#### Parameters

##### params

###### chainId?

`number`

###### embeddedEoaAddress

`string`

###### provider

\{ `request`: `WalletRequest`; \}

###### provider.request

`WalletRequest`

###### publicClient?

\{ \}

###### subAccountAddress

`string`

#### Returns

`Promise`\<[`InstallEmbeddedOwnerResult`](#installembeddedownerresult)\>

***

### readEmbeddedOwnerOnSubAccount()

> **readEmbeddedOwnerOnSubAccount**(`params`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/wallet/subAccountOwnerInstall.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountOwnerInstall.ts#L105)

#### Parameters

##### params

###### embeddedEoaAddress

`string`

###### publicClient?

\{ \}

###### subAccountAddress

`string`

#### Returns

`Promise`\<`boolean` \| `null`\>
