[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/deriveUiFlags

# src/wallet/accountContext/deriveUiFlags

## Functions

### deriveAccountUiFlags()

> **deriveAccountUiFlags**(`params`): [`AccountUiFlags`](types.md#accountuiflags)

Defined in: [src/wallet/accountContext/deriveUiFlags.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/wallet/accountContext/deriveUiFlags.ts#L3)

#### Parameters

##### params

###### activeAccountType

`"EOA"` \| `"SMART_WALLET"` \| `"UNKNOWN"`

###### canUseSmartWalletMode

`boolean`

###### capabilities

[`AccountCapabilities`](types.md#accountcapabilities)

###### chainId

`number` \| `null`

###### cswAddress?

`` `0x${string}` ``

###### eoaIsOwnerOfCsw

`boolean` \| `null`

###### expectedCswChainId?

`number`

###### signerType

[`SignerType`](types.md#signertype-1)

#### Returns

[`AccountUiFlags`](types.md#accountuiflags)
