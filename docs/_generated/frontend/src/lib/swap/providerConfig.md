[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/swap/providerConfig

# src/lib/swap/providerConfig

## Type Aliases

### SwapProvider

> **SwapProvider** = `"uniswap"` \| `"cdp"`

Defined in: [src/lib/swap/providerConfig.ts:4](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L4)

***

### SwapProviderMode

> **SwapProviderMode** = `"uniswap"` \| `"cdp"` \| `"hybrid"`

Defined in: [src/lib/swap/providerConfig.ts:5](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L5)

***

### SwapProviderSelection

> **SwapProviderSelection** = `object`

Defined in: [src/lib/swap/providerConfig.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L7)

#### Properties

##### fallback

> **fallback**: [`SwapProvider`](#swapprovider) \| `null`

Defined in: [src/lib/swap/providerConfig.ts:10](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L10)

##### mode

> **mode**: [`SwapProviderMode`](#swapprovidermode)

Defined in: [src/lib/swap/providerConfig.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L8)

##### primary

> **primary**: [`SwapProvider`](#swapprovider)

Defined in: [src/lib/swap/providerConfig.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L9)

## Functions

### getSwapProviderLabel()

> **getSwapProviderLabel**(`provider`): `"Uniswap"` \| `"CDP"`

Defined in: [src/lib/swap/providerConfig.ts:70](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L70)

#### Parameters

##### provider

[`SwapProvider`](#swapprovider)

#### Returns

`"Uniswap"` \| `"CDP"`

***

### readSwapProviderMode()

> **readSwapProviderMode**(): [`SwapProviderMode`](#swapprovidermode)

Defined in: [src/lib/swap/providerConfig.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L23)

#### Returns

[`SwapProviderMode`](#swapprovidermode)

***

### requiresCanonicalExecutionForSwapMode()

> **requiresCanonicalExecutionForSwapMode**(`mode`): `boolean`

Defined in: [src/lib/swap/providerConfig.ts:49](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L49)

#### Parameters

##### mode

[`SwapProviderMode`](#swapprovidermode)

#### Returns

`boolean`

***

### resolveSwapProviderSelection()

> **resolveSwapProviderSelection**(`mode`): [`SwapProviderSelection`](#swapproviderselection)

Defined in: [src/lib/swap/providerConfig.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L27)

#### Parameters

##### mode

[`SwapProviderMode`](#swapprovidermode) = `...`

#### Returns

[`SwapProviderSelection`](#swapproviderselection)

***

### shouldFallbackToUniswap()

> **shouldFallbackToUniswap**(`error`): `boolean`

Defined in: [src/lib/swap/providerConfig.ts:53](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/swap/providerConfig.ts#L53)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`
