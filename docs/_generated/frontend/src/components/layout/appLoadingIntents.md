[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/layout/appLoadingIntents

# src/components/layout/appLoadingIntents

## Type Aliases

### LoadingIntent

> **LoadingIntent** = `"page"` \| `"session"` \| `"redirect"` \| `"deploy"` \| `"processing"`

Defined in: [src/components/layout/appLoadingIntents.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L3)

***

### LoadingIntentConfig

> **LoadingIntentConfig** = `object`

Defined in: [src/components/layout/appLoadingIntents.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L16)

#### Properties

##### headline

> **headline**: `string`

Defined in: [src/components/layout/appLoadingIntents.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L17)

##### pattern

> **pattern**: `LoadingPattern`

Defined in: [src/components/layout/appLoadingIntents.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L19)

##### srStatus

> **srStatus**: `string`

Defined in: [src/components/layout/appLoadingIntents.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L18)

## Variables

### LOADING\_INTENT\_CONFIG

> `const` **LOADING\_INTENT\_CONFIG**: `Record`\<[`LoadingIntent`](#loadingintent), [`LoadingIntentConfig`](#loadingintentconfig)\>

Defined in: [src/components/layout/appLoadingIntents.ts:88](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L88)

## Functions

### getLoadingIntentConfig()

> **getLoadingIntentConfig**(`intent`): [`LoadingIntentConfig`](#loadingintentconfig)

Defined in: [src/components/layout/appLoadingIntents.ts:116](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L116)

#### Parameters

##### intent

[`LoadingIntent`](#loadingintent)

#### Returns

[`LoadingIntentConfig`](#loadingintentconfig)

***

### getLoadingIntentFromPath()

> **getLoadingIntentFromPath**(`pathname`): [`LoadingIntent`](#loadingintent)

Defined in: [src/components/layout/appLoadingIntents.ts:120](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/layout/appLoadingIntents.ts#L120)

#### Parameters

##### pathname

`string`

#### Returns

[`LoadingIntent`](#loadingintent)
