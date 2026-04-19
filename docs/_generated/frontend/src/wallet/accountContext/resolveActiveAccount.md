[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/resolveActiveAccount

# src/wallet/accountContext/resolveActiveAccount

## Functions

### resolveActiveAccount()

> **resolveActiveAccount**(`params`): `object`

Defined in: [src/wallet/accountContext/resolveActiveAccount.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/wallet/accountContext/resolveActiveAccount.ts#L3)

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
