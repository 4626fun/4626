[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/ai/chat

# server/ai/chat

## Type Aliases

### ChatRuntimeBridge

> **ChatRuntimeBridge** = `ReturnType`\<*typeof* [`createRuntimeBridge`](../agent/eliza/runtimeBridge.md#createruntimebridge)\>

Defined in: [server/ai/chat.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/ai/chat.ts#L21)

***

### SharedConversationalRuntimeContext

> **SharedConversationalRuntimeContext** = `object`

Defined in: [server/ai/chat.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/ai/chat.ts#L22)

#### Properties

##### inboundMemory

> **inboundMemory**: `unknown`

Defined in: [server/ai/chat.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/ai/chat.ts#L24)

##### runtimeBridge

> **runtimeBridge**: [`ChatRuntimeBridge`](#chatruntimebridge)

Defined in: [server/ai/chat.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/ai/chat.ts#L23)

##### state

> **state**: `Record`\<`string`, `unknown`\>

Defined in: [server/ai/chat.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/ai/chat.ts#L25)

## Functions

### generateLlmResponse()

> **generateLlmResponse**(`params`): `Promise`\<\{ `handledByRuntime`: `boolean`; `ok`: `true`; `response`: `string`; \} \| \{ `handledByRuntime`: `boolean`; `ok`: `false`; `response`: `string`; \}\>

Defined in: [server/ai/chat.ts:436](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/ai/chat.ts#L436)

#### Parameters

##### params

###### allowActionExecution?

`boolean`

###### groupId

`string`

###### runtimeContext?

[`SharedConversationalRuntimeContext`](#sharedconversationalruntimecontext)

###### runtimeTruth?

`Partial`\<[`AssistantRuntimeTruth`](runtimeTruth.md#assistantruntimetruth)\>

###### senderWallet

`string`

###### text

`string`

###### vault

[`KeeprVaultRow`](../_lib/keepr/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`Promise`\<\{ `handledByRuntime`: `boolean`; `ok`: `true`; `response`: `string`; \} \| \{ `handledByRuntime`: `boolean`; `ok`: `false`; `response`: `string`; \}\>
