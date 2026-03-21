[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/deriveUiFlags

# src/wallet/accountContext/deriveUiFlags

## Functions

### deriveAccountUiFlags()

> **deriveAccountUiFlags**(`params`): [`AccountUiFlags`](types.md#accountuiflags)

Defined in: [src/wallet/accountContext/deriveUiFlags.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/accountContext/deriveUiFlags.ts#L3)

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
