[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/resolveActiveAccount

# src/wallet/accountContext/resolveActiveAccount

## Functions

### resolveActiveAccount()

> **resolveActiveAccount**(`params`): `object`

Defined in: [src/wallet/accountContext/resolveActiveAccount.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/resolveActiveAccount.ts#L3)

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

> **activeAccountType**: `"UNKNOWN"` \| `"EOA"` \| `"SMART_WALLET"`

##### canUseSmartWalletMode

> **canUseSmartWalletMode**: `boolean`
