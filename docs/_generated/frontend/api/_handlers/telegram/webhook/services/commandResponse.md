[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/services/commandResponse

# api/\_handlers/telegram/webhook/services/commandResponse

## Type Aliases

### TelegramCommandResponseMedia

> **TelegramCommandResponseMedia** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L1)

#### Properties

##### bytes

> **bytes**: `Uint8Array`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L3)

##### caption?

> `optional` **caption**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L6)

##### contentType?

> `optional` **contentType**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L4)

##### filename?

> `optional` **filename**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L5)

##### kind

> **kind**: `"photo"`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:2](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L2)

##### replyMarkup?

> `optional` **replyMarkup**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L7)

##### suppressText?

> `optional` **suppressText**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L8)

***

### TelegramProcessedCommandResult

> **TelegramProcessedCommandResult** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L11)

#### Properties

##### action?

> `optional` **action**: `unknown`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L13)

##### responseText

> **responseText**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L12)

## Functions

### buildTelegramProcessedCommandResponse()

> **buildTelegramProcessedCommandResponse**(`params`): `object`

Defined in: [api/\_handlers/telegram/webhook/services/commandResponse.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/commandResponse.ts#L16)

#### Parameters

##### params

###### buildObservedCommandText

(`commandText`, `responseText`) => `string` \| `null`

###### commandText

`string`

###### processed

[`TelegramProcessedCommandResult`](#telegramprocessedcommandresult)

###### resolveMediaFromAction

(`action`) => [`TelegramCommandResponseMedia`](#telegramcommandresponsemedia) \| `undefined`

#### Returns

`object`

##### media?

> `optional` **media**: [`TelegramCommandResponseMedia`](#telegramcommandresponsemedia)

##### text

> **text**: `string`
