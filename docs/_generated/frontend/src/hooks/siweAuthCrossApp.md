[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/siweAuthCrossApp

# src/hooks/siweAuthCrossApp

## Functions

### getCrossAppSafeRedirectPath()

> **getCrossAppSafeRedirectPath**(`location`): `object`

Defined in: [src/hooks/siweAuthCrossApp.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/siweAuthCrossApp.ts#L24)

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

Defined in: [src/hooks/siweAuthCrossApp.ts:1](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/siweAuthCrossApp.ts#L1)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### sanitizeCrossAppRedirectUrlForAuth()

> **sanitizeCrossAppRedirectUrlForAuth**(): () => `void` \| `null`

Defined in: [src/hooks/siweAuthCrossApp.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/siweAuthCrossApp.ts#L38)

#### Returns

() => `void` \| `null`
