[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/wallet/accountContext/ownership

# src/wallet/accountContext/ownership

## Type Aliases

### OwnershipCheckResult

> **OwnershipCheckResult** = `object`

Defined in: [src/wallet/accountContext/ownership.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/accountContext/ownership.ts#L13)

#### Properties

##### reason

> **reason**: `"ok"` \| `"network_mismatch"` \| `"missing_params"` \| `"read_failed"`

Defined in: [src/wallet/accountContext/ownership.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/accountContext/ownership.ts#L15)

##### value

> **value**: `boolean` \| `null`

Defined in: [src/wallet/accountContext/ownership.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/accountContext/ownership.ts#L14)

## Functions

### checkEoaOwnershipOfCsw()

> **checkEoaOwnershipOfCsw**(`params`): `Promise`\<[`OwnershipCheckResult`](#ownershipcheckresult)\>

Defined in: [src/wallet/accountContext/ownership.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/accountContext/ownership.ts#L18)

#### Parameters

##### params

###### chainId

`number` \| `null`

###### cswAddress?

`string` \| `null`

###### expectedChainId?

`number`

###### ownerAddress?

`string` \| `null`

###### publicClient

`any`

#### Returns

`Promise`\<[`OwnershipCheckResult`](#ownershipcheckresult)\>
