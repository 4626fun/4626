[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/updates/successfulPayment

# api/\_handlers/telegram/webhook/updates/successfulPayment

## Functions

### handle()

> **handle**(`req`, `res`, `update`, `_config`): `Promise`\<`any`\>

Defined in: [api/\_handlers/telegram/webhook/updates/successfulPayment.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/updates/successfulPayment.ts#L9)

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

### handleSuccessfulPaymentUpdate()

> **handleSuccessfulPaymentUpdate**(`params`): `Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/updates/successfulPayment.ts:19](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/updates/successfulPayment.ts#L19)

#### Parameters

##### params

###### botToken

`string`

###### getDb

() => `Promise`\<`any`\>

###### getTelegramLinkByUserId

(`args`) => `Promise`\<`any`\>

###### isStarsTipsEnabledForChat

(`chatId`) => `boolean`

###### logTelegramActionAudit

(`args`) => `Promise`\<`unknown`\>

###### message

[`TelegramMessage`](../types.md#telegrammessage) \| `null` \| `undefined`

###### onMessageError?

(`error`, `meta`) => `void`

###### parseTipInvoicePayload

(`payload`) => \{ `context`: `string`; `stars`: `number`; \} \| `null`

###### sendTelegramMessage

(`args`) => `Promise`\<`void`\>

###### successfulPayment

[`TelegramSuccessfulPayment`](../types.md#telegramsuccessfulpayment) \| `null` \| `undefined`

###### updateId?

`number`

#### Returns

`Promise`\<[`TelegramWebhookOk`](../types.md#telegramwebhookok) \| `null`\>
