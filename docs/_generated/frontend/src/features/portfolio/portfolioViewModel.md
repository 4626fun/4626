[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/portfolio/portfolioViewModel

# src/features/portfolio/portfolioViewModel

## Functions

### buildPortfolioImageProxyUrl()

> **buildPortfolioImageProxyUrl**(`rawUrl`): `string` \| `null`

Defined in: [src/features/portfolio/portfolioViewModel.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/portfolio/portfolioViewModel.ts#L68)

#### Parameters

##### rawUrl

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### deriveCreatorCoinOptions()

> **deriveCreatorCoinOptions**(`addresses`): `` `0x${string}` ``[]

Defined in: [src/features/portfolio/portfolioViewModel.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/portfolio/portfolioViewModel.ts#L31)

#### Parameters

##### addresses

`string`[]

#### Returns

`` `0x${string}` ``[]

***

### isEvmAddress()

> **isEvmAddress**(`value`): `` value is `0x${string}` ``

Defined in: [src/features/portfolio/portfolioViewModel.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/portfolio/portfolioViewModel.ts#L3)

#### Parameters

##### value

`string`

#### Returns

`` value is `0x${string}` ``

***

### normalizeAddress()

> **normalizeAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/features/portfolio/portfolioViewModel.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/portfolio/portfolioViewModel.ts#L7)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePortfolioAddresses()

> **resolvePortfolioAddresses**(`input`): `object`

Defined in: [src/features/portfolio/portfolioViewModel.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/portfolio/portfolioViewModel.ts#L13)

#### Parameters

##### input

###### routeAddress

`string` \| `null` \| `undefined`

###### siweAuthAddress

`string` \| `null` \| `undefined`

###### wagmiAddress

`string` \| `null` \| `undefined`

#### Returns

`object`

##### effectiveAddress

> **effectiveAddress**: `` `0x${string}` `` \| `null`

##### isPublicMode

> **isPublicMode**: `boolean`

##### publicAddress

> **publicAddress**: `` `0x${string}` `` \| `null`
