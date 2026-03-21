[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/preCheckout

# api/\_handlers/telegram/webhook/updates/preCheckout

## Functions

### handle()

> **handle**(`req`, `res`, `update`, `_config`): `Promise`\<`any`\>

Defined in: [api/\_handlers/telegram/webhook/updates/preCheckout.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/preCheckout.ts#L9)

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

### handlePreCheckoutUpdate()

> **handlePreCheckoutUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/preCheckout.ts:19](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/updates/preCheckout.ts#L19)

#### Parameters

##### params

###### answerPreCheckoutQuery

(`args`) => `Promise`\<`void`\>

###### areStarsTipsEnabled

() => `boolean`

###### botToken

`string`

###### onAnswerError?

(`error`, `meta`) => `void`

###### parseTipInvoicePayload

(`payload`) => \{ `context`: `string`; `stars`: `number`; \} \| `null`

###### preCheckoutQuery

[`TelegramPreCheckoutQuery`](../types.md#telegramprecheckoutquery) \| `null` \| `undefined`

###### updateId?

`number`

#### Returns

`Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>
