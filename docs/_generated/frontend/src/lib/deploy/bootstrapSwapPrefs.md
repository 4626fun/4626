[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/deploy/bootstrapSwapPrefs

# src/lib/deploy/bootstrapSwapPrefs

## Type Aliases

### BootstrapSwapPrefs

> **BootstrapSwapPrefs** = `object`

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:5](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L5)

#### Properties

##### allowFallback

> **allowFallback**: `boolean`

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:7](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L7)

##### provider

> **provider**: [`BootstrapSwapProvider`](#bootstrapswapprovider)

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:6](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L6)

##### slippageBps

> **slippageBps**: `number`

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:8](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L8)

***

### BootstrapSwapProvider

> **BootstrapSwapProvider** = `"uniswap"` \| `"0x"` \| `"defillama"`

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L3)

## Functions

### readBootstrapSwapPrefs()

> **readBootstrapSwapPrefs**(`env`): [`BootstrapSwapPrefs`](#bootstrapswapprefs)

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:42](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L42)

#### Parameters

##### env

`EnvLike`

#### Returns

[`BootstrapSwapPrefs`](#bootstrapswapprefs)

***

### readClientBootstrapSwapPrefs()

> **readClientBootstrapSwapPrefs**(): [`BootstrapSwapPrefs`](#bootstrapswapprefs)

Defined in: [src/lib/deploy/bootstrapSwapPrefs.ts:50](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/bootstrapSwapPrefs.ts#L50)

#### Returns

[`BootstrapSwapPrefs`](#bootstrapswapprefs)
