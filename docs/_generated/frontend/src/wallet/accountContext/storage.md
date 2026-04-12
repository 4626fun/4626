[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/storage

# src/wallet/accountContext/storage

## Functions

### readPreferredAccountMode()

> **readPreferredAccountMode**(`params`): [`AccountModePreference`](types.md#accountmodepreference) \| `null`

Defined in: [src/wallet/accountContext/storage.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/storage.ts#L10)

#### Parameters

##### params

###### chainId

`number` \| `null`

###### signerAddress?

`` `0x${string}` ``

#### Returns

[`AccountModePreference`](types.md#accountmodepreference) \| `null`

***

### writePreferredAccountMode()

> **writePreferredAccountMode**(`params`, `mode`): `void`

Defined in: [src/wallet/accountContext/storage.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/wallet/accountContext/storage.ts#L25)

#### Parameters

##### params

###### chainId

`number` \| `null`

###### signerAddress?

`` `0x${string}` ``

##### mode

[`AccountModePreference`](types.md#accountmodepreference)

#### Returns

`void`
