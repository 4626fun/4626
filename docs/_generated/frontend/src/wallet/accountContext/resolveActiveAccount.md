[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/wallet/accountContext/resolveActiveAccount

# src/wallet/accountContext/resolveActiveAccount

## Functions

### resolveActiveAccount()

> **resolveActiveAccount**(`params`): `object`

Defined in: [src/wallet/accountContext/resolveActiveAccount.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/wallet/accountContext/resolveActiveAccount.ts#L3)

#### Parameters

##### params

###### cswAddress?

`` `0x${string}` ``

###### eoaIsOwnerOfCsw

`boolean` \| `null`

###### preferredMode

[`AccountModePreference`](types.md#accountmodepreference) \| `null`

###### signerAddress?

`` `0x${string}` ``

###### signerType

[`SignerType`](types.md#signertype-1)

#### Returns

`object`

##### activeAccount?

> `optional` **activeAccount**: `` `0x${string}` ``

##### activeAccountType

> **activeAccountType**: `"EOA"` \| `"SMART_WALLET"` \| `"UNKNOWN"`

##### canUseSmartWalletMode

> **canUseSmartWalletMode**: `boolean`
