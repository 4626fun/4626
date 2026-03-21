[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/inlineQuery

# api/\_handlers/telegram/webhook/updates/inlineQuery

## Functions

### handle()

> **handle**(`req`, `res`, `update`, `_config`): `Promise`\<`any`\>

Defined in: [api/\_handlers/telegram/webhook/updates/inlineQuery.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/updates/inlineQuery.ts#L9)

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

### handleInlineQueryUpdate()

> **handleInlineQueryUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/inlineQuery.ts:19](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/updates/inlineQuery.ts#L19)

#### Parameters

##### params

###### answerInlineQuery

(`args`) => `Promise`\<`void`\>

###### botToken

`string`

###### inlineQuery

[`TelegramInlineQuery`](../types.md#telegraminlinequery) \| `null` \| `undefined`

###### onError?

(`error`, `meta`) => `void`

###### targetChatId

`string`

###### updateId?

`number`

#### Returns

`Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>
