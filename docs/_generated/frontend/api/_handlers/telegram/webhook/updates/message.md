[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/message

# api/\_handlers/telegram/webhook/updates/message

## Functions

### extractSharedSelection()

> **extractSharedSelection**(`message`): \{ `kind`: `"users"`; `requestId`: `number` \| `null`; `users`: `object`[]; \} \| \{ `chatId`: `string`; `kind`: `"chat"`; `requestId`: `number` \| `null`; `title`: `string`; `username`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L45)

#### Parameters

##### message

[`TelegramMessage`](../types.md#telegrammessage) | `null`

#### Returns

\{ `kind`: `"users"`; `requestId`: `number` \| `null`; `users`: `object`[]; \} \| \{ `chatId`: `string`; `kind`: `"chat"`; `requestId`: `number` \| `null`; `title`: `string`; `username`: `string`; \} \| `null`

***

### extractUpdateMessage()

> **extractUpdateMessage**(`update`): [`TelegramMessage`](../types.md#telegrammessage) \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L18)

#### Parameters

##### update

[`TelegramUpdate`](../types.md#telegramupdate)

#### Returns

[`TelegramMessage`](../types.md#telegrammessage) \| `null`

***

### handle()

> **handle**(`req`, `res`, `update`, `_config`): `Promise`\<`any`\>

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:8](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L8)

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

### normalizeMessageContext()

> **normalizeMessageContext**(`message`): \{ `chatId`: `string`; `fromBot`: `boolean`; `messageId?`: `number`; `text`: `string`; `userId`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/updates/message.ts:28](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/message.ts#L28)

#### Parameters

##### message

[`TelegramMessage`](../types.md#telegrammessage) | `null`

#### Returns

\{ `chatId`: `string`; `fromBot`: `boolean`; `messageId?`: `number`; `text`: `string`; `userId`: `string`; \} \| `null`
