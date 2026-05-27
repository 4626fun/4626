[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/inlineQuery

# api/\_handlers/telegram/webhook/updates/inlineQuery

## Functions

### handleInlineQueryUpdate()

> **handleInlineQueryUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/inlineQuery.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/updates/inlineQuery.ts#L4)

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
