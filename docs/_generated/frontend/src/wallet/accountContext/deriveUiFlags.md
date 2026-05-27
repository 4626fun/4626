[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/wallet/accountContext/deriveUiFlags

# src/wallet/accountContext/deriveUiFlags

## Functions

### deriveAccountUiFlags()

> **deriveAccountUiFlags**(`params`): [`AccountUiFlags`](types.md#accountuiflags)

Defined in: [src/wallet/accountContext/deriveUiFlags.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/wallet/accountContext/deriveUiFlags.ts#L3)

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
