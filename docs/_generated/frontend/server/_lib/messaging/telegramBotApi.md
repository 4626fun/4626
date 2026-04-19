[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/messaging/telegramBotApi

# server/\_lib/messaging/telegramBotApi

## Type Aliases

### TelegramBotCommand

> **TelegramBotCommand** = `object`

Defined in: [server/\_lib/messaging/telegramBotApi.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L3)

#### Properties

##### command

> **command**: `string`

Defined in: [server/\_lib/messaging/telegramBotApi.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L4)

##### description

> **description**: `string`

Defined in: [server/\_lib/messaging/telegramBotApi.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L5)

## Functions

### resolveTelegramBotToken()

> **resolveTelegramBotToken**(): `string`

Defined in: [server/\_lib/messaging/telegramBotApi.ts:126](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L126)

#### Returns

`string`

***

### setTelegramChatMenuButton()

> **setTelegramChatMenuButton**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramBotApi.ts:75](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L75)

#### Parameters

##### params

###### botToken

`string`

###### chatId?

`string`

###### menuButton

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### setTelegramMyCommands()

> **setTelegramMyCommands**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramBotApi.ts:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L44)

#### Parameters

##### params

###### botToken

`string`

###### commands

[`TelegramBotCommand`](#telegrambotcommand)[]

###### languageCode?

`string`

###### scope?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`void`\>

***

### setTelegramWebhook()

> **setTelegramWebhook**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/telegramBotApi.ts:94](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/messaging/telegramBotApi.ts#L94)

#### Parameters

##### params

###### allowedUpdates?

`string`[]

###### botToken

`string`

###### dropPendingUpdates?

`boolean`

###### secretToken?

`string`

###### url

`string`

#### Returns

`Promise`\<`void`\>
