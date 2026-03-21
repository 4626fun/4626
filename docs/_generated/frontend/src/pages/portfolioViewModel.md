[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/pages/portfolioViewModel

# src/pages/portfolioViewModel

## Functions

### buildPortfolioImageProxyUrl()

> **buildPortfolioImageProxyUrl**(`rawUrl`): `string` \| `null`

Defined in: [src/pages/portfolioViewModel.ts:68](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/portfolioViewModel.ts#L68)

#### Parameters

##### rawUrl

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### deriveCreatorCoinOptions()

> **deriveCreatorCoinOptions**(`addresses`): `` `0x${string}` ``[]

Defined in: [src/pages/portfolioViewModel.ts:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/portfolioViewModel.ts#L31)

#### Parameters

##### addresses

`string`[]

#### Returns

`` `0x${string}` ``[]

***

### isEvmAddress()

> **isEvmAddress**(`value`): `` value is `0x${string}` ``

Defined in: [src/pages/portfolioViewModel.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/portfolioViewModel.ts#L3)

#### Parameters

##### value

`string`

#### Returns

`` value is `0x${string}` ``

***

### normalizeAddress()

> **normalizeAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/pages/portfolioViewModel.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/portfolioViewModel.ts#L7)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePortfolioAddresses()

> **resolvePortfolioAddresses**(`input`): `object`

Defined in: [src/pages/portfolioViewModel.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/portfolioViewModel.ts#L13)

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
