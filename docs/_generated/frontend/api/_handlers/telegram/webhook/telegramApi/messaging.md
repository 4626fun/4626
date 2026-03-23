[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/messaging

# api/\_handlers/telegram/webhook/telegramApi/messaging

## Functions

### deleteTelegramMessage()

> **deleteTelegramMessage**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:245](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L245)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:193](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L193)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:175](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L175)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

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

> **replaceTelegramMenuMessage**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:269](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L269)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### messageId

`number`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### text

`string`

#### Returns

`Promise`\<`void`\>

***

### sendTelegramMessage()

> **sendTelegramMessage**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:58](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L58)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### messageThreadId?

`number`

###### replyMarkup?

`Record`\<`string`, `unknown`\>

###### replyToMessageId?

`number`

###### text

`string`

#### Returns

`Promise`\<`void`\>

***

### sendTelegramPhoto()

> **sendTelegramPhoto**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:134](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L134)

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

`Promise`\<`void`\>
