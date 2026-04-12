[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/llm

# server/agent/eliza/llm

## Type Aliases

### LlmGenerateResult

> **LlmGenerateResult** = `object`

Defined in: [server/agent/eliza/llm.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L37)

#### Properties

##### attempts

> **attempts**: `ProviderAttempt`[]

Defined in: [server/agent/eliza/llm.ts:40](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L40)

##### provider

> **provider**: `string` \| `null`

Defined in: [server/agent/eliza/llm.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L39)

##### text

> **text**: `string` \| `null`

Defined in: [server/agent/eliza/llm.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L38)

***

### LlmProvider

> **LlmProvider** = `object`

Defined in: [server/agent/eliza/llm.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L10)

#### Properties

##### apiUrl

> **apiUrl**: `string`

Defined in: [server/agent/eliza/llm.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L13)

##### envKey

> **envKey**: `string`

Defined in: [server/agent/eliza/llm.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L12)

##### estimateUsdPer1kTokens

> **estimateUsdPer1kTokens**: `number`

Defined in: [server/agent/eliza/llm.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L21)

##### extractContent()?

> `optional` **extractContent**: (`json`) => `string` \| `null`

Defined in: [server/agent/eliza/llm.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L20)

###### Parameters

###### json

`any`

###### Returns

`string` \| `null`

##### model

> **model**: `string`

Defined in: [server/agent/eliza/llm.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L14)

##### name

> **name**: `string`

Defined in: [server/agent/eliza/llm.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L11)

##### transformBody()?

> `optional` **transformBody**: (`messages`, `maxTokens`, `selectedModel`) => `unknown`

Defined in: [server/agent/eliza/llm.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L15)

###### Parameters

###### messages

`object`[]

###### maxTokens

`number`

###### selectedModel

`string`

###### Returns

`unknown`

## Functions

### getElizaLlmService()

> **getElizaLlmService**(): `ElizaLlmService`

Defined in: [server/agent/eliza/llm.ts:555](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/agent/eliza/llm.ts#L555)

#### Returns

`ElizaLlmService`
