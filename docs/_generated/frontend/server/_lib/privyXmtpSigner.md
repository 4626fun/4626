[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/privyXmtpSigner

# server/\_lib/privyXmtpSigner

## Type Aliases

### XmtpSigner

> **XmtpSigner** = `ScwSigner` \| `EoaSigner`

Defined in: [server/\_lib/privyXmtpSigner.ts:59](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/privyXmtpSigner.ts#L59)

## Functions

### createEoaSignerFromKey()

> **createEoaSignerFromKey**(`privateKey`): `Promise`\<[`XmtpSigner`](#xmtpsigner)\>

Defined in: [server/\_lib/privyXmtpSigner.ts:248](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/privyXmtpSigner.ts#L248)

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

Defined in: [server/\_lib/privyXmtpSigner.ts:141](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/privyXmtpSigner.ts#L141)

Create an XMTP SCW signer that signs via Privy's wallet API.

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
