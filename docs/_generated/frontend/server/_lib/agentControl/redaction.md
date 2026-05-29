[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/agentControl/redaction

# server/\_lib/agentControl/redaction

## Functions

### redactForRemoteAi()

> **redactForRemoteAi**\<`T`\>(`payload`, `options`): `T`

Defined in: [server/\_lib/agentControl/redaction.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/redaction.ts#L174)

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### payload

`T`

##### options

`RedactionOptions` = `{}`

#### Returns

`T`

***

### redactTextForRemoteAi()

> **redactTextForRemoteAi**(`input`, `options`): `string`

Defined in: [server/\_lib/agentControl/redaction.ts:181](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/redaction.ts#L181)

#### Parameters

##### input

`string`

##### options

`Pick`\<`RedactionOptions`, `"maxStringLength"` \| `"maskAddresses"`\> = `{}`

#### Returns

`string`

***

### redactToJsonForRemoteAi()

> **redactToJsonForRemoteAi**(`payload`, `options`): `string`

Defined in: [server/\_lib/agentControl/redaction.ts:196](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/redaction.ts#L196)

#### Parameters

##### payload

`unknown`

##### options

`RedactionOptions` = `{}`

#### Returns

`string`
