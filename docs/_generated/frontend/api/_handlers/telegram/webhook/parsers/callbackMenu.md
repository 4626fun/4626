[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/callbackMenu

# api/\_handlers/telegram/webhook/parsers/callbackMenu

## Functions

### resolveHelpCallbackCommand()

> **resolveHelpCallbackCommand**(`rawData`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L3)

#### Parameters

##### rawData

`string`

#### Returns

`string` \| `null`

***

### resolveImmediateCallbackToast()

> **resolveImmediateCallbackToast**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:115](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L115)

#### Parameters

##### params

`ImmediateToastInput`

#### Returns

`string`

***

### resolveNavigationCallbackToast()

> **resolveNavigationCallbackToast**(`rawData`, `mappedCommand`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:58](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L58)

#### Parameters

##### rawData

`string`

##### mappedCommand

`string` | `null`

#### Returns

`string`
