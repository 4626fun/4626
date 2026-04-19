[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/telegram/telegramMiniAppRouteGuard

# src/lib/telegram/telegramMiniAppRouteGuard

## Functions

### getInitialTelegramMiniAppEntryResolution()

> **getInitialTelegramMiniAppEntryResolution**(`search`): `"ready"` \| `"checking"`

Defined in: [src/lib/telegram/telegramMiniAppRouteGuard.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/telegram/telegramMiniAppRouteGuard.ts#L21)

#### Parameters

##### search

`string`

#### Returns

`"ready"` \| `"checking"`

***

### hasTelegramLinkEntryContext()

> **hasTelegramLinkEntryContext**(`search`): `boolean`

Defined in: [src/lib/telegram/telegramMiniAppRouteGuard.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/telegram/telegramMiniAppRouteGuard.ts#L12)

#### Parameters

##### search

`string`

#### Returns

`boolean`

***

### hasTelegramLinkQueryContext()

> **hasTelegramLinkQueryContext**(`search`): `boolean`

Defined in: [src/lib/telegram/telegramMiniAppRouteGuard.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/telegram/telegramMiniAppRouteGuard.ts#L4)

#### Parameters

##### search

`string`

#### Returns

`boolean`

***

### resolveTelegramMiniAppEntryBootstrap()

> **resolveTelegramMiniAppEntryBootstrap**(`params`): `Promise`\<`boolean`\>

Defined in: [src/lib/telegram/telegramMiniAppRouteGuard.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/telegram/telegramMiniAppRouteGuard.ts#L25)

#### Parameters

##### params

###### bootstrapTelegramWebApp?

() => `Promise`\<`unknown`\>

###### search

`string`

#### Returns

`Promise`\<`boolean`\>
