[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/interactions

# api/\_handlers/telegram/webhook/telegramApi/interactions

## Functions

### answerTelegramCallbackQuery()

> **answerTelegramCallbackQuery**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/interactions.ts:17](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/interactions.ts#L17)

#### Parameters

##### params

###### botToken

`string`

###### callbackQueryId

`string`

###### showAlert?

`boolean`

###### text?

`string`

#### Returns

`Promise`\<`void`\>

***

### answerTelegramPreCheckoutQuery()

> **answerTelegramPreCheckoutQuery**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/interactions.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/interactions.ts#L44)

#### Parameters

##### params

###### botToken

`string`

###### errorMessage?

`string`

###### ok

`boolean`

###### preCheckoutQueryId

`string`

#### Returns

`Promise`\<`void`\>
