[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/deploy/permit2

# src/lib/deploy/permit2

## Type Aliases

### Permit2TransferPermit

> **Permit2TransferPermit** = `object`

Defined in: [src/lib/deploy/permit2.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L8)

#### Properties

##### deadline

> **deadline**: `bigint`

Defined in: [src/lib/deploy/permit2.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L11)

##### nonce

> **nonce**: `bigint`

Defined in: [src/lib/deploy/permit2.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L10)

##### permitted

> **permitted**: `Permit2TokenPermissions`

Defined in: [src/lib/deploy/permit2.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L9)

***

### Permit2TypedData

> **Permit2TypedData** = `object`

Defined in: [src/lib/deploy/permit2.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L14)

#### Properties

##### domain

> **domain**: `object`

Defined in: [src/lib/deploy/permit2.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L15)

###### chainId

> **chainId**: `number`

###### name

> **name**: `"Permit2"`

###### verifyingContract

> **verifyingContract**: `Address`

##### message

> **message**: `object`

Defined in: [src/lib/deploy/permit2.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L30)

###### deadline

> **deadline**: `bigint`

###### nonce

> **nonce**: `bigint`

###### permitted

> **permitted**: `Permit2TokenPermissions`

###### spender

> **spender**: `Address`

##### primaryType

> **primaryType**: `"PermitTransferFrom"`

Defined in: [src/lib/deploy/permit2.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L29)

##### types

> **types**: `object`

Defined in: [src/lib/deploy/permit2.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L20)

###### PermitTransferFrom

> **PermitTransferFrom**: (\{ `name`: `"permitted"`; `type`: `"TokenPermissions"`; \} \| \{ `name`: `"spender"`; `type`: `"address"`; \} \| \{ `name`: `"nonce"`; `type`: `"uint256"`; \} \| \{ `name`: `"deadline"`; `type`: `"uint256"`; \})[]

###### TokenPermissions

> **TokenPermissions**: `object`[]

## Functions

### buildPermit2SignatureTransfer()

> **buildPermit2SignatureTransfer**(`args`): `object`

Defined in: [src/lib/deploy/permit2.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L48)

#### Parameters

##### args

###### amount

`bigint`

###### chainId

`number`

###### deadline

`bigint`

###### nonce

`bigint`

###### permit2

`` `0x${string}` ``

###### spender

`` `0x${string}` ``

###### token

`` `0x${string}` ``

#### Returns

`object`

##### permit

> **permit**: [`Permit2TransferPermit`](#permit2transferpermit)

##### typedData

> **typedData**: [`Permit2TypedData`](#permit2typeddata)

***

### createPermit2Deadline()

> **createPermit2Deadline**(`params?`): `bigint`

Defined in: [src/lib/deploy/permit2.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L42)

#### Parameters

##### params?

###### nowSeconds?

`number`

###### ttlSeconds?

`number`

#### Returns

`bigint`

***

### createPermit2Nonce()

> **createPermit2Nonce**(`nowMs`): `bigint`

Defined in: [src/lib/deploy/permit2.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/permit2.ts#L38)

#### Parameters

##### nowMs

`number` = `...`

#### Returns

`bigint`
