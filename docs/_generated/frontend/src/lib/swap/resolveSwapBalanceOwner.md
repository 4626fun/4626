[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/resolveSwapBalanceOwner

# src/lib/swap/resolveSwapBalanceOwner

## Functions

### normalizeSwapAddress()

> **normalizeSwapAddress**(`value`): `string` \| `null`

Defined in: [src/lib/swap/resolveSwapBalanceOwner.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/resolveSwapBalanceOwner.ts#L5)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### resolveSwapBalanceOwner()

> **resolveSwapBalanceOwner**(`params`): `string` \| `null`

Defined in: [src/lib/swap/resolveSwapBalanceOwner.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/resolveSwapBalanceOwner.ts#L11)

Asset-holding wallet for swap balance reads — always parent CSW when known.

#### Parameters

##### params

###### accountContextCsw?

`string` \| `null`

###### accountMeCanonicalCsw?

`string` \| `null`

###### connectedExternalEoa?

`string` \| `null`

###### executionAddress?

`string` \| `null`

###### privyEmbeddedEoa?

`string` \| `null`

#### Returns

`string` \| `null`
