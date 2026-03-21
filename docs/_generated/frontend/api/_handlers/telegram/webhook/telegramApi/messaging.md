[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/messaging

# api/\_handlers/telegram/webhook/telegramApi/messaging

## Functions

### deleteTelegramMessage()

> **deleteTelegramMessage**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:136](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L136)

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

### editTelegramMessage()

> **editTelegramMessage**(`params`): `Promise`\<`boolean`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:100](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L100)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:160](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L160)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/messaging.ts:23](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/messaging.ts#L23)

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
