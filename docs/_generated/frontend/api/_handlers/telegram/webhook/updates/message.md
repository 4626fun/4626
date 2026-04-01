[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/message

# api/\_handlers/telegram/webhook/updates/message

## Functions

### extractSharedSelection()

> **extractSharedSelection**(`message`): \{ `kind`: `"users"`; `requestId`: `number` \| `null`; `users`: `object`[]; \} \| \{ `chatId`: `string`; `kind`: `"chat"`; `requestId`: `number` \| `null`; `title`: `string`; `username`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:31](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L31)

#### Parameters

##### message

[`TelegramMessage`](../types.md#telegrammessage) | `null`

#### Returns

\{ `kind`: `"users"`; `requestId`: `number` \| `null`; `users`: `object`[]; \} \| \{ `chatId`: `string`; `kind`: `"chat"`; `requestId`: `number` \| `null`; `title`: `string`; `username`: `string`; \} \| `null`

***

### extractUpdateMessage()

> **extractUpdateMessage**(`update`): [`TelegramMessage`](../types.md#telegrammessage) \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:4](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L4)

#### Parameters

##### update

[`TelegramUpdate`](../types.md#telegramupdate)

#### Returns

[`TelegramMessage`](../types.md#telegrammessage) \| `null`

***

### normalizeMessageContext()

> **normalizeMessageContext**(`message`): \{ `chatId`: `string`; `fromBot`: `boolean`; `messageId?`: `number`; `text`: `string`; `userId`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:14](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L14)

#### Parameters

##### message

[`TelegramMessage`](../types.md#telegrammessage) | `null`

#### Returns

\{ `chatId`: `string`; `fromBot`: `boolean`; `messageId?`: `number`; `text`: `string`; `userId`: `string`; \} \| `null`
