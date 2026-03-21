[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/interactions

# api/\_handlers/telegram/webhook/telegramApi/interactions

## Functions

### answerTelegramCallbackQuery()

> **answerTelegramCallbackQuery**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/interactions.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/telegramApi/interactions.ts#L3)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/interactions.ts:30](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/telegramApi/interactions.ts#L30)

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
