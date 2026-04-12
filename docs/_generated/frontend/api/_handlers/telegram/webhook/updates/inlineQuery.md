[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/inlineQuery

# api/\_handlers/telegram/webhook/updates/inlineQuery

## Functions

### handleInlineQueryUpdate()

> **handleInlineQueryUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/inlineQuery.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/updates/inlineQuery.ts#L4)

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
