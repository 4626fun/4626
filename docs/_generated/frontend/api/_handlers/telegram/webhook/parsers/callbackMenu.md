[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/callbackMenu

# api/\_handlers/telegram/webhook/parsers/callbackMenu

## Functions

### resolveHelpCallbackCommand()

> **resolveHelpCallbackCommand**(`rawData`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:112](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L112)

#### Parameters

##### rawData

`string`

#### Returns

`string` \| `null`

***

### resolveImmediateCallbackToast()

> **resolveImmediateCallbackToast**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:152](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L152)

#### Parameters

##### params

`ImmediateToastInput`

#### Returns

`string`

***

### resolveNavigationCallbackToast()

> **resolveNavigationCallbackToast**(`rawData`, `mappedCommand`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:128](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L128)

#### Parameters

##### rawData

`string`

##### mappedCommand

`string` | `null`

#### Returns

`string`
