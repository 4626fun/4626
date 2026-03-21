[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/deploy/bootstrapSwapGate

# src/lib/deploy/bootstrapSwapGate

## Type Aliases

### BootstrapSwapPlanLike

> **BootstrapSwapPlanLike** = `object`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:1](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L1)

#### Properties

##### fallbackUsed?

> `optional` **fallbackUsed**: `boolean`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:5](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L5)

##### hasSwap

> **hasSwap**: `boolean`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:2](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L2)

##### providerRequested

> **providerRequested**: `string`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L3)

##### providerUsed?

> `optional` **providerUsed**: `string` \| `null`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:4](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L4)

##### swapError?

> `optional` **swapError**: `string` \| `null`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:6](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L6)

## Functions

### assertBootstrapSwapPlanReady()

> **assertBootstrapSwapPlanReady**(`plan`): `void`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:20](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L20)

#### Parameters

##### plan

[`BootstrapSwapPlanLike`](#bootstrapswapplanlike)

#### Returns

`void`

***

### buildBootstrapSwapUnavailableMessage()

> **buildBootstrapSwapUnavailableMessage**(`plan`): `string`

Defined in: [src/lib/deploy/bootstrapSwapGate.ts:9](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapGate.ts#L9)

#### Parameters

##### plan

[`BootstrapSwapPlanLike`](#bootstrapswapplanlike)

#### Returns

`string`
