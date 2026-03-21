[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/inline

# api/\_handlers/telegram/webhook/telegramApi/inline

## Type Aliases

### TelegramInlineResultsButton

> **TelegramInlineResultsButton** = \{ `start_parameter?`: `string`; `text`: `string`; `web_app?`: \{ `url`: `string`; \}; \} \| `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:1](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L1)

## Functions

### answerTelegramInlineQuery()

> **answerTelegramInlineQuery**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:9](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L9)

#### Parameters

##### params

###### botToken

`string`

###### button?

[`TelegramInlineResultsButton`](#telegraminlineresultsbutton)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:42](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L42)

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
