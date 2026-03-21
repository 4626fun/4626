[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/callbackQuery

# api/\_handlers/telegram/webhook/updates/callbackQuery

## Functions

### handle()

> **handle**(`req`, `res`, `update`, `_config`): `Promise`\<`any`\>

Defined in: [api/\_handlers/telegram/webhook/updates/callbackQuery.ts:9](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/updates/callbackQuery.ts#L9)

#### Parameters

##### req

`any`

##### res

`any`

##### update

[`TelegramUpdate`](../types.md#telegramupdate)

##### \_config

[`TelegramWebhookConfig`](../config.md#telegramwebhookconfig)

#### Returns

`Promise`\<`any`\>

***

### normalizeCallbackQuery()

> **normalizeCallbackQuery**(`callbackQuery`): \{ `callbackData`: `string`; `callbackMessageId?`: `number`; `callbackQueryId`: `string`; `chatId`: `string`; `userId`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/callbackQuery.ts:19](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/updates/callbackQuery.ts#L19)

#### Parameters

##### callbackQuery

[`TelegramCallbackQuery`](../types.md#telegramcallbackquery) | `null` | `undefined`

#### Returns

\{ `callbackData`: `string`; `callbackMessageId?`: `number`; `callbackQueryId`: `string`; `chatId`: `string`; `userId`: `string`; \} \| `null`
