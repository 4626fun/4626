[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/callbackQuery

# api/\_handlers/telegram/webhook/updates/callbackQuery

## Functions

### normalizeCallbackQuery()

> **normalizeCallbackQuery**(`callbackQuery`): \{ `callbackData`: `string`; `callbackMessageId?`: `number`; `callbackQueryId`: `string`; `chatId?`: `string`; `inlineMessageId?`: `string`; `userId`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/callbackQuery.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/updates/callbackQuery.ts#L4)

#### Parameters

##### callbackQuery

[`TelegramCallbackQuery`](../types.md#telegramcallbackquery) | `null` | `undefined`

#### Returns

\{ `callbackData`: `string`; `callbackMessageId?`: `number`; `callbackQueryId`: `string`; `chatId?`: `string`; `inlineMessageId?`: `string`; `userId`: `string`; \} \| `null`
