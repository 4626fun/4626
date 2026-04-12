[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/telegramMiniAppRouteGuard

# src/lib/telegramMiniAppRouteGuard

## Functions

### getInitialTelegramMiniAppEntryResolution()

> **getInitialTelegramMiniAppEntryResolution**(`search`): `"ready"` \| `"checking"`

Defined in: [src/lib/telegramMiniAppRouteGuard.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramMiniAppRouteGuard.ts#L21)

#### Parameters

##### search

`string`

#### Returns

`"ready"` \| `"checking"`

***

### hasTelegramLinkEntryContext()

> **hasTelegramLinkEntryContext**(`search`): `boolean`

Defined in: [src/lib/telegramMiniAppRouteGuard.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramMiniAppRouteGuard.ts#L12)

#### Parameters

##### search

`string`

#### Returns

`boolean`

***

### hasTelegramLinkQueryContext()

> **hasTelegramLinkQueryContext**(`search`): `boolean`

Defined in: [src/lib/telegramMiniAppRouteGuard.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramMiniAppRouteGuard.ts#L4)

#### Parameters

##### search

`string`

#### Returns

`boolean`

***

### resolveTelegramMiniAppEntryBootstrap()

> **resolveTelegramMiniAppEntryBootstrap**(`params`): `Promise`\<`boolean`\>

Defined in: [src/lib/telegramMiniAppRouteGuard.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramMiniAppRouteGuard.ts#L25)

#### Parameters

##### params

###### bootstrapTelegramWebApp?

() => `Promise`\<`unknown`\>

###### search

`string`

#### Returns

`Promise`\<`boolean`\>
