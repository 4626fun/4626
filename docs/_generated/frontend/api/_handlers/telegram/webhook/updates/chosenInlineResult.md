[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/chosenInlineResult

# api/\_handlers/telegram/webhook/updates/chosenInlineResult

## Functions

### handleChosenInlineResultUpdate()

> **handleChosenInlineResultUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/chosenInlineResult.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/updates/chosenInlineResult.ts#L4)

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
