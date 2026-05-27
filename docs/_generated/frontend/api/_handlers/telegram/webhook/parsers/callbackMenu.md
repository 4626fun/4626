[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/callbackMenu

# api/\_handlers/telegram/webhook/parsers/callbackMenu

## Functions

### resolveHelpCallbackCommand()

> **resolveHelpCallbackCommand**(`rawData`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L82)

#### Parameters

##### rawData

`string`

#### Returns

`string` \| `null`

***

### resolveImmediateCallbackToast()

> **resolveImmediateCallbackToast**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:122](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L122)

#### Parameters

##### params

`ImmediateToastInput`

#### Returns

`string`

***

### resolveNavigationCallbackToast()

> **resolveNavigationCallbackToast**(`rawData`, `mappedCommand`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/callbackMenu.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/parsers/callbackMenu.ts#L98)

#### Parameters

##### rawData

`string`

##### mappedCommand

`string` | `null`

#### Returns

`string`
