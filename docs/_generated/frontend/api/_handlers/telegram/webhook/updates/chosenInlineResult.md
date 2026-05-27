[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/chosenInlineResult

# api/\_handlers/telegram/webhook/updates/chosenInlineResult

## Functions

### handleChosenInlineResultUpdate()

> **handleChosenInlineResultUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/chosenInlineResult.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/updates/chosenInlineResult.ts#L4)

#### Parameters

##### params

###### chosenInlineResult

[`TelegramChosenInlineResult`](../types.md#telegramchoseninlineresult) \| `null` \| `undefined`

###### onChosenInlineResult

(`args`) => `void` \| `Promise`\<`void`\>

###### onError?

(`error`, `meta`) => `void`

###### updateId?

`number`

#### Returns

`Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>
