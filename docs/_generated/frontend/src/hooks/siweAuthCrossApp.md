[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/siweAuthCrossApp

# src/hooks/siweAuthCrossApp

## Functions

### getCrossAppSafeRedirectPath()

> **getCrossAppSafeRedirectPath**(`location`): `object`

Defined in: [src/hooks/siweAuthCrossApp.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/siweAuthCrossApp.ts#L24)

#### Parameters

##### location

`CrossAppRedirectLocation`

#### Returns

`object`

##### safePath

> **safePath**: `string`

##### shouldSanitize

> **shouldSanitize**: `boolean`

***

### isPrivyRedirectUrlNotAllowedError()

> **isPrivyRedirectUrlNotAllowedError**(`error`): `boolean`

Defined in: [src/hooks/siweAuthCrossApp.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/siweAuthCrossApp.ts#L1)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### sanitizeCrossAppRedirectUrlForAuth()

> **sanitizeCrossAppRedirectUrlForAuth**(): () => `void` \| `null`

Defined in: [src/hooks/siweAuthCrossApp.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/siweAuthCrossApp.ts#L38)

#### Returns

() => `void` \| `null`
