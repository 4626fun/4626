[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/access

# api/\_handlers/telegram/webhook/services/access

## Functions

### isTelegramContextAllowed()

> **isTelegramContextAllowed**(`params`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:7](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/services/access.ts#L7)

#### Parameters

##### params

###### allowAdminDm

`boolean`

###### allowPrivateDm

`boolean`

###### chatId

`string`

###### signalsChatId?

`string`

###### userId

`string`

#### Returns

`boolean`

***

### isTelegramMiniAppSessionEnabled()

> **isTelegramMiniAppSessionEnabled**(`params`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:40](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/services/access.ts#L40)

#### Parameters

##### params

###### chatId?

`string` \| `null`

###### userId?

`string` \| `null`

#### Returns

`boolean`

***

### verifyBotConfigSecret()

> **verifyBotConfigSecret**(`req`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:26](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/services/access.ts#L26)

#### Parameters

##### req

`Pick`\<[`VercelRequest`](../../../../../src/types/vercel-node.md#vercelrequest), `"headers"`\>

#### Returns

`boolean`

***

### verifyTelegramLinkApiSecret()

> **verifyTelegramLinkApiSecret**(`req`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:33](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/services/access.ts#L33)

#### Parameters

##### req

`Pick`\<[`VercelRequest`](../../../../../src/types/vercel-node.md#vercelrequest), `"headers"`\>

#### Returns

`boolean`
