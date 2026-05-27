[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/zoraAddOwnerApi

# src/lib/wallet/zoraAddOwnerApi

## Type Aliases

### ConfirmOwnerResponse

> **ConfirmOwnerResponse** = `object`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L15)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L17)

##### confirmationState

> **confirmationState**: `"owner_confirmed"` \| `"pending_tx"` \| `"owner_not_found_yet"` \| `"tx_failed"`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L20)

##### isOwner

> **isOwner**: `boolean`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L16)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L18)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L19)

***

### PreparedOwnerTxRequest

> **PreparedOwnerTxRequest** = `object`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L4)

#### Properties

##### chainId

> **chainId**: `8453`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L5)

##### data

> **data**: `` `0x${string}` ``

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L7)

##### to

> **to**: `` `0x${string}` ``

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L6)

##### value

> **value**: `"0x0"`

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L8)

## Functions

### confirmOwnerInstall()

> **confirmOwnerInstall**(`params`): `Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L42)

#### Parameters

##### params

###### cswAddress

`string`

###### headers?

`Record`\<`string`, `string`\>

###### ownerAddress

`string`

###### txHash

`` `0x${string}` ``

#### Returns

`Promise`\<[`ConfirmOwnerResponse`](#confirmownerresponse)\>

***

### fetchPrepareAddPrivyOwner()

> **fetchPrepareAddPrivyOwner**(`params`): `Promise`\<`PrepareAddPrivyOwnerResponse`\>

Defined in: [src/lib/wallet/zoraAddOwnerApi.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/zoraAddOwnerApi.ts#L23)

#### Parameters

##### params

###### headers?

`Record`\<`string`, `string`\>

#### Returns

`Promise`\<`PrepareAddPrivyOwnerResponse`\>
