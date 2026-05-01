[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/privyXmtpSigner

# server/\_lib/wallet/privyXmtpSigner

## Interfaces

### EoaSigner

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L53)

#### Properties

##### getIdentifier()

> **getIdentifier**: () => `Identifier`

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L55)

###### Returns

`Identifier`

##### signMessage()

> **signMessage**: (`message`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L56)

###### Parameters

###### message

`string`

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### type

> **type**: `"EOA"`

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L54)

***

### ScwSigner

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L46)

#### Properties

##### getChainId()

> **getChainId**: () => `bigint`

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L50)

###### Returns

`bigint`

##### getIdentifier()

> **getIdentifier**: () => `Identifier`

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L48)

###### Returns

`Identifier`

##### signMessage()

> **signMessage**: (`message`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L49)

###### Parameters

###### message

`string`

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### type

> **type**: `"SCW"`

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L47)

## Type Aliases

### XmtpSigner

> **XmtpSigner** = [`ScwSigner`](#scwsigner) \| [`EoaSigner`](#eoasigner)

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L59)

## Functions

### createEoaSignerFromKey()

> **createEoaSignerFromKey**(`privateKey`): `Promise`\<[`XmtpSigner`](#xmtpsigner)\>

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:251](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L251)

Create an XMTP EOA signer from a raw private key.
Fallback for agents that don't have a CSW.

NOTE: This is async because we need dynamic import for ESM.

#### Parameters

##### privateKey

`` `0x${string}` ``

#### Returns

`Promise`\<[`XmtpSigner`](#xmtpsigner)\>

***

### createPrivyScwSigner()

> **createPrivyScwSigner**(`params`): [`XmtpSigner`](#xmtpsigner)

Defined in: [server/\_lib/wallet/privyXmtpSigner.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyXmtpSigner.ts#L142)

Create an XMTP SCW signer that signs via Privy's wallet API.

`params` carries:
- `walletId`: Privy wallet ID (for the signer/owner EOA, not the CSW itself).
- `cswAddress`: canonical Coinbase Smart Wallet address.
- `ownerIndex` (optional): index of the Privy wallet in the CSW's
  MultiOwnable owner list. Query `ownerAtIndex(i)` on the CSW to find the
  correct index. Defaults to 0.
- `chainId` (optional): chain ID where the CSW is deployed (default 8453).
- `rpcUrl` (optional): RPC URL for on-chain queries (default: public Base RPC).

#### Parameters

##### params

###### chainId?

`number`

###### cswAddress

`` `0x${string}` ``

###### ownerIndex?

`number`

###### rpcUrl?

`string`

###### walletId

`string`

#### Returns

[`XmtpSigner`](#xmtpsigner)
