[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/swap/providerConfig

# src/lib/swap/providerConfig

## Type Aliases

### SwapProvider

> **SwapProvider** = `"uniswap"` \| `"cdp"`

Defined in: [src/lib/swap/providerConfig.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L3)

***

### SwapProviderMode

> **SwapProviderMode** = `"uniswap"` \| `"cdp"` \| `"hybrid"`

Defined in: [src/lib/swap/providerConfig.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L4)

***

### SwapProviderSelection

> **SwapProviderSelection** = `object`

Defined in: [src/lib/swap/providerConfig.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L6)

#### Properties

##### fallback

> **fallback**: [`SwapProvider`](#swapprovider) \| `null`

Defined in: [src/lib/swap/providerConfig.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L9)

##### mode

> **mode**: [`SwapProviderMode`](#swapprovidermode)

Defined in: [src/lib/swap/providerConfig.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L7)

##### primary

> **primary**: [`SwapProvider`](#swapprovider)

Defined in: [src/lib/swap/providerConfig.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L8)

## Functions

### getSwapProviderLabel()

> **getSwapProviderLabel**(`provider`): `"Uniswap"` \| `"CDP"`

Defined in: [src/lib/swap/providerConfig.ts:69](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L69)

#### Parameters

##### provider

[`SwapProvider`](#swapprovider)

#### Returns

`"Uniswap"` \| `"CDP"`

***

### readSwapProviderMode()

> **readSwapProviderMode**(): [`SwapProviderMode`](#swapprovidermode)

Defined in: [src/lib/swap/providerConfig.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L22)

#### Returns

[`SwapProviderMode`](#swapprovidermode)

***

### requiresCanonicalExecutionForSwapMode()

> **requiresCanonicalExecutionForSwapMode**(`mode`): `boolean`

Defined in: [src/lib/swap/providerConfig.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L48)

#### Parameters

##### mode

[`SwapProviderMode`](#swapprovidermode)

#### Returns

`boolean`

***

### resolveSwapProviderSelection()

> **resolveSwapProviderSelection**(`mode`): [`SwapProviderSelection`](#swapproviderselection)

Defined in: [src/lib/swap/providerConfig.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L26)

#### Parameters

##### mode

[`SwapProviderMode`](#swapprovidermode) = `...`

#### Returns

[`SwapProviderSelection`](#swapproviderselection)

***

### shouldFallbackToUniswap()

> **shouldFallbackToUniswap**(`error`): `boolean`

Defined in: [src/lib/swap/providerConfig.ts:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/swap/providerConfig.ts#L52)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
