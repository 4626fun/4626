[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/access

# api/\_handlers/telegram/webhook/services/access

## Functions

### isTelegramContextAllowed()

> **isTelegramContextAllowed**(`params`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:16](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/access.ts#L16)

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

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/access.ts#L49)

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

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:35](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/access.ts#L35)

#### Parameters

##### req

`Pick`\<[`VercelRequest`](../../../../../src/types/vercel-node.md#vercelrequest), `"headers"`\>

#### Returns

`boolean`

***

### verifyTelegramLinkApiSecret()

> **verifyTelegramLinkApiSecret**(`req`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/access.ts#L42)

#### Parameters

##### req

`Pick`\<[`VercelRequest`](../../../../../src/types/vercel-node.md#vercelrequest), `"headers"`\>

#### Returns

`boolean`
