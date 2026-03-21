[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/getCapabilities

# src/wallet/accountContext/getCapabilities

## Functions

### parseCapabilities()

> **parseCapabilities**(`raw`, `chainIdHex`): [`AccountCapabilities`](types.md#accountcapabilities)

Defined in: [src/wallet/accountContext/getCapabilities.ts:36](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/wallet/accountContext/getCapabilities.ts#L36)

#### Parameters

##### raw

`unknown`

##### chainIdHex

`` `0x${string}` `` | `null`

#### Returns

[`AccountCapabilities`](types.md#accountcapabilities)

***

### probeWalletCapabilities()

> **probeWalletCapabilities**(`params`): `Promise`\<[`AccountCapabilities`](types.md#accountcapabilities)\>

Defined in: [src/wallet/accountContext/getCapabilities.ts:61](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/wallet/accountContext/getCapabilities.ts#L61)

#### Parameters

##### params

###### chainIdHex

`` `0x${string}` `` \| `null`

###### signerAddress?

`` `0x${string}` ``

###### walletClient

\{ \} \| `undefined`

#### Returns

`Promise`\<[`AccountCapabilities`](types.md#accountcapabilities)\>
