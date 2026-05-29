[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/inline

# api/\_handlers/telegram/webhook/telegramApi/inline

## Type Aliases

### TelegramInlineQueryPayload

> **TelegramInlineQueryPayload** = `object`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:1](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L1)

#### Properties

##### button?

> `optional` **button**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:7](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L7)

##### cache\_time?

> `optional` **cache\_time**: `number`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:4](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L4)

##### inline\_query\_id

> **inline\_query\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:2](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L2)

##### is\_personal?

> `optional` **is\_personal**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L5)

##### next\_offset?

> `optional` **next\_offset**: `string`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:6](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L6)

##### results

> **results**: `unknown`[]

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:3](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L3)

##### switch\_pm\_parameter?

> `optional` **switch\_pm\_parameter**: `string`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L9)

##### switch\_pm\_text?

> `optional` **switch\_pm\_text**: `string`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:8](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L8)

***

### TelegramInlineResultsButton

> **TelegramInlineResultsButton** = `NonNullable`\<[`TelegramInlineQueryPayload`](#telegraminlinequerypayload)\[`"button"`\]\> \| `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L21)

## Functions

### answerTelegramInlineQuery()

> **answerTelegramInlineQuery**(`params`): `Promise`\<`void`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L25)

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

Defined in: [api/\_handlers/telegram/webhook/telegramApi/inline.ts:58](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/telegramApi/inline.ts#L58)

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
