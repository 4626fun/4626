[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/messaging

# api/\_handlers/telegram/webhook/telegramApi/messaging

## Type Aliases

### TelegramSentMessage

> **TelegramSentMessage** = `object`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L7)

#### Properties

##### messageId

> **messageId**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L8)

## Functions

### deleteTelegramMessage()

> **deleteTelegramMessage**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:275](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L275)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### messageId

`number`

#### Returns

`Promise`\<`void`\>

***

### editTelegramInlineMessage()

> **editTelegramInlineMessage**(`params`): `Promise`\<`boolean`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:223](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L223)

#### Parameters

##### params

###### botToken

`string`

###### inlineMessageId

`string`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### text

`string`

#### Returns

`Promise`\<`boolean`\>

***

### editTelegramMessage()

> **editTelegramMessage**(`params`): `Promise`\<`boolean`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:200](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L200)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### dismissOwnerUserId?

`string` \| `null`

###### messageId

`number`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### text

`string`

#### Returns

`Promise`\<`boolean`\>

***

### replaceTelegramMenuMessage()

> **replaceTelegramMenuMessage**(`params`): `Promise`\<[`TelegramSentMessage`](#telegramsentmessage)\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:299](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L299)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### dismissOwnerUserId?

`string` \| `null`

###### messageId

`number`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### text

`string`

#### Returns

`Promise`\<[`TelegramSentMessage`](#telegramsentmessage)\>

***

### sendTelegramMessage()

> **sendTelegramMessage**(`params`): `Promise`\<[`TelegramSentMessage`](#telegramsentmessage)\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:73](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L73)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### dismissOwnerUserId?

`string` \| `null`

###### messageThreadId?

`number`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### replyToMessageId?

`number`

###### text

`string`

#### Returns

`Promise`\<[`TelegramSentMessage`](#telegramsentmessage)\>

***

### sendTelegramPhoto()

> **sendTelegramPhoto**(`params`): `Promise`\<[`TelegramSentMessage`](#telegramsentmessage)\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:154](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L154)

#### Parameters

##### params

###### botToken

`string`

###### caption?

`string`

###### chatId

`string`

###### contentType?

`string`

###### dismissOwnerUserId?

`string` \| `null`

###### filename?

`string`

###### messageThreadId?

`number`

###### photo

`Uint8Array`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### replyToMessageId?

`number`

#### Returns

`Promise`\<[`TelegramSentMessage`](#telegramsentmessage)\>
