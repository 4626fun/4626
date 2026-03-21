[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/siweAuthCrossApp

# src/hooks/siweAuthCrossApp

## Functions

### getCrossAppSafeRedirectPath()

> **getCrossAppSafeRedirectPath**(`location`): `object`

Defined in: [src/hooks/siweAuthCrossApp.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/siweAuthCrossApp.ts#L26)

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

Defined in: [src/hooks/siweAuthCrossApp.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/siweAuthCrossApp.ts#L3)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### sanitizeCrossAppRedirectUrlForAuth()

> **sanitizeCrossAppRedirectUrlForAuth**(): () => `void` \| `null`

Defined in: [src/hooks/siweAuthCrossApp.ts:40](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/siweAuthCrossApp.ts#L40)

#### Returns

() => `void` \| `null`
