[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/inline

# api/\_handlers/telegram/webhook/telegramApi/inline

## Type Aliases

### TelegramInlineResultsButton

> **TelegramInlineResultsButton** = `NonNullable`\<`TelegramInlineQueryPayload`\[`"button"`\]\> \| `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L21)

## Functions

### answerTelegramInlineQuery()

> **answerTelegramInlineQuery**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L25)

#### Parameters

##### params

###### botToken

`string`

###### button?

`Record`\<`string`, `unknown`\>

###### cacheTime?

`number`

###### inlineQueryId

`string`

###### isPersonal?

`boolean`

###### nextOffset?

`string`

###### results

`unknown`[]

###### switchPmParameter?

`string`

###### switchPmText?

`string`

#### Returns

`Promise`\<`void`\>

***

### saveTelegramPreparedInlineMessage()

> **saveTelegramPreparedInlineMessage**(`params`): `Promise`\<\{ `preparedInlineMessageId`: `string` \| `null`; \}\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:58](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L58)

#### Parameters

##### params

###### allowBotChats?

`boolean`

###### allowChannelChats?

`boolean`

###### allowGroupChats?

`boolean`

###### allowUserChats?

`boolean`

###### botToken

`string`

###### result

`Record`\<`string`, `unknown`\>

###### userId

`string` \| `number`

#### Returns

`Promise`\<\{ `preparedInlineMessageId`: `string` \| `null`; \}\>
