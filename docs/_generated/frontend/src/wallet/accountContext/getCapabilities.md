[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/getCapabilities

# src/wallet/accountContext/getCapabilities

## Functions

### parseCapabilities()

> **parseCapabilities**(`raw`, `chainIdHex`): [`AccountCapabilities`](types.md#accountcapabilities)

Defined in: [src/wallet/accountContext/getCapabilities.ts:36](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/wallet/accountContext/getCapabilities.ts#L36)

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

Defined in: [src/wallet/accountContext/getCapabilities.ts:61](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/wallet/accountContext/getCapabilities.ts#L61)

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
