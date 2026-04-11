[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/telegramTransport

# server/\_lib/workspace/telegramTransport

## Interfaces

### TelegramSummaryTransport

Defined in: [server/\_lib/workspace/telegramTransport.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L24)

#### Methods

##### sendSummary()

> **sendSummary**(`payload`): `Promise`\<[`WorkspaceTelegramSummaryResult`](#workspacetelegramsummaryresult)\>

Defined in: [server/\_lib/workspace/telegramTransport.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L25)

###### Parameters

###### payload

[`WorkspaceTelegramSummaryPayload`](#workspacetelegramsummarypayload)

###### Returns

`Promise`\<[`WorkspaceTelegramSummaryResult`](#workspacetelegramsummaryresult)\>

## Type Aliases

### WorkspaceTelegramSummaryPayload

> **WorkspaceTelegramSummaryPayload** = `object`

Defined in: [server/\_lib/workspace/telegramTransport.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L3)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [server/\_lib/workspace/telegramTransport.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L7)

##### disableWebPagePreview?

> `optional` **disableWebPagePreview**: `boolean`

Defined in: [server/\_lib/workspace/telegramTransport.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L9)

##### lines

> **lines**: `string`[]

Defined in: [server/\_lib/workspace/telegramTransport.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L6)

##### messageThreadId?

> `optional` **messageThreadId**: `string` \| `number` \| `null`

Defined in: [server/\_lib/workspace/telegramTransport.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L8)

##### title

> **title**: `string`

Defined in: [server/\_lib/workspace/telegramTransport.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L5)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/workspace/telegramTransport.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L4)

***

### WorkspaceTelegramSummaryResult

> **WorkspaceTelegramSummaryResult** = \{ `messageId`: `number` \| `null`; `raw`: `Record`\<`string`, `unknown`\>; `sent`: `true`; \} \| \{ `error?`: `string`; `reason`: `string`; `sent`: `false`; \}

Defined in: [server/\_lib/workspace/telegramTransport.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L12)

## Functions

### createTelegramSummaryTransport()

> **createTelegramSummaryTransport**(): [`TelegramSummaryTransport`](#telegramsummarytransport)

Defined in: [server/\_lib/workspace/telegramTransport.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/telegramTransport.ts#L118)

#### Returns

[`TelegramSummaryTransport`](#telegramsummarytransport)
