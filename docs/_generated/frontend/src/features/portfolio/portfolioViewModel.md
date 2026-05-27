[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/portfolio/portfolioViewModel

# src/features/portfolio/portfolioViewModel

## Functions

### buildPortfolioImageProxyUrl()

> **buildPortfolioImageProxyUrl**(`rawUrl`): `string` \| `null`

Defined in: [src/features/portfolio/portfolioViewModel.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/portfolio/portfolioViewModel.ts#L69)

#### Parameters

##### rawUrl

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### deriveCreatorCoinOptions()

> **deriveCreatorCoinOptions**(`addresses`): `string`[]

Defined in: [src/features/portfolio/portfolioViewModel.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/portfolio/portfolioViewModel.ts#L31)

#### Parameters

##### addresses

`string`[]

#### Returns

`string`[]

***

### isEvmAddress()

> **isEvmAddress**(`value`): `value is string`

Defined in: [src/features/portfolio/portfolioViewModel.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/portfolio/portfolioViewModel.ts#L3)

#### Parameters

##### value

`string`

#### Returns

`value is string`

***

### normalizeAddress()

> **normalizeAddress**(`value`): `string` \| `null`

Defined in: [src/features/portfolio/portfolioViewModel.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/portfolio/portfolioViewModel.ts#L7)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### resolvePortfolioAddresses()

> **resolvePortfolioAddresses**(`input`): `object`

Defined in: [src/features/portfolio/portfolioViewModel.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/portfolio/portfolioViewModel.ts#L13)

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

> **effectiveAddress**: `string` \| `null`

##### isPublicMode

> **isPublicMode**: `boolean`

##### publicAddress

> **publicAddress**: `string` \| `null`
