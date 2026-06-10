[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/walletSendCallsPayload

# src/lib/wallet/walletSendCallsPayload

## Type Aliases

### WalletSendCallsCallInput

> **WalletSendCallsCallInput** = `object`

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L6)

#### Properties

##### data

> **data**: `Hex`

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L8)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L7)

##### value?

> `optional` **value**: `bigint` \| `` `0x${string}` ``

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L9)

***

### WalletSendCallsPayload

> **WalletSendCallsPayload** = `object`

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L12)

#### Properties

##### atomicRequired

> **atomicRequired**: `boolean`

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L16)

##### calls

> **calls**: `object`[]

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L17)

###### data

> **data**: `Hex`

###### to

> **to**: `` `0x${string}` ``

###### value

> **value**: `` `0x${string}` ``

##### chainId

> **chainId**: `` `0x${string}` ``

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L15)

##### from

> **from**: `` `0x${string}` ``

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L14)

##### version

> **version**: *typeof* [`WALLET_SEND_CALLS_VERSION`](#wallet_send_calls_version)

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L13)

## Variables

### WALLET\_SEND\_CALLS\_VERSION

> `const` **WALLET\_SEND\_CALLS\_VERSION**: `"2.0.0"`

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L4)

Coinbase Wallet SDK / EIP-5792 wallet_sendCalls schema version.

## Functions

### buildWalletSendCallsPayload()

> **buildWalletSendCallsPayload**(`input`): [`WalletSendCallsPayload`](#walletsendcallspayload)

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L44)

Build a Coinbase-compatible EIP-5792 `wallet_sendCalls` request payload.
Requires `from` (Smart Wallet address) per @coinbase/wallet-sdk 4.3.x guidance.

#### Parameters

##### input

###### atomicRequired?

`boolean`

###### calls

[`WalletSendCallsCallInput`](#walletsendcallscallinput)[]

###### chainId

`number`

###### from

`` `0x${string}` ``

#### Returns

[`WalletSendCallsPayload`](#walletsendcallspayload)

***

### chainIdToHex()

> **chainIdToHex**(`chainId`): `` `0x${string}` ``

Defined in: [src/lib/wallet/walletSendCallsPayload.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/walletSendCallsPayload.ts#L33)

#### Parameters

##### chainId

`number`

#### Returns

`` `0x${string}` ``
