[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/agent/\_process

# api/\_handlers/agent/\_process

## Variables

### DEFAULT\_CHECKPOINT\_WINDOW\_MS

> `const` **DEFAULT\_CHECKPOINT\_WINDOW\_MS**: `120000` = `120_000`

Defined in: [api/\_handlers/agent/\_process.ts:44](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L44)

***

### MAX\_MESSAGES\_PER\_CONVERSATION

> `const` **MAX\_MESSAGES\_PER\_CONVERSATION**: `50` = `50`

Defined in: [api/\_handlers/agent/\_process.ts:43](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L43)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/agent/\_process.ts:400](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L400)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>

***

### getCheckpointMs()

> **getCheckpointMs**(`lastProcessedAt`, `nowMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:95](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L95)

#### Parameters

##### lastProcessedAt

`unknown`

##### nowMs

`number` = `...`

#### Returns

`number`

***

### getEthereumAddressFromInboxState()

> **getEthereumAddressFromInboxState**(`state`): `string` \| `null`

Defined in: [api/\_handlers/agent/\_process.ts:123](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L123)

#### Parameters

##### state

`any`

#### Returns

`string` \| `null`

***

### getInitialConversationCheckpointMs()

> **getInitialConversationCheckpointMs**(`lastProcessedAt`, `nowMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:103](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L103)

#### Parameters

##### lastProcessedAt

`unknown`

##### nowMs

`number` = `...`

#### Returns

`number`

***

### getMessageQueryOptions()

> **getMessageQueryOptions**(`lastProcessedMs`): `object`

Defined in: [api/\_handlers/agent/\_process.ts:109](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L109)

#### Parameters

##### lastProcessedMs

`number`

#### Returns

`object`

##### direction

> **direction**: `number`

##### limit

> **limit**: `number`

##### sentAfterNs

> **sentAfterNs**: `bigint`

***

### isAuthorized()

> **isAuthorized**(`req`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:374](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L374)

#### Parameters

##### req

`any`

#### Returns

`boolean`

***

### mergeCheckpointMs()

> **mergeCheckpointMs**(`previousMs`, `candidateMs`): `number`

Defined in: [api/\_handlers/agent/\_process.ts:135](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L135)

#### Parameters

##### previousMs

`number`

##### candidateMs

`number`

#### Returns

`number`

***

### parseConversationCheckpointRows()

> **parseConversationCheckpointRows**(`rows`): `Map`\<`string`, `number`\>

Defined in: [api/\_handlers/agent/\_process.ts:211](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L211)

#### Parameters

##### rows

`Record`\<`string`, `unknown`\>[]

#### Returns

`Map`\<`string`, `number`\>

***

### readCronSecretFromHeaders()

> **readCronSecretFromHeaders**(`req`): `string`

Defined in: [api/\_handlers/agent/\_process.ts:363](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L363)

#### Parameters

##### req

`any`

#### Returns

`string`

***

### readStrictUnsupportedRetryEnabled()

> **readStrictUnsupportedRetryEnabled**(`raw`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:87](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L87)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`boolean`

***

### resolveFallbackCommandReply()

> **resolveFallbackCommandReply**(`params`): `object`

Defined in: [api/\_handlers/agent/\_process.ts:181](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L181)

#### Parameters

##### params

###### result

`FallbackCommandResult`

###### text

`string`

#### Returns

`object`

##### fallbackGenerated

> **fallbackGenerated**: `boolean`

##### replyText

> **replyText**: `string`

***

### shouldDeferFallbackCommand()

> **shouldDeferFallbackCommand**(`params`): `boolean`

Defined in: [api/\_handlers/agent/\_process.ts:204](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/agent/_process.ts#L204)

#### Parameters

##### params

###### fallbackGenerated

`boolean`

###### strictUnsupportedRetry

`boolean`

#### Returns

`boolean`
