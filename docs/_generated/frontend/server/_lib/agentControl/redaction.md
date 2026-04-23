[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/redaction

# server/\_lib/agentControl/redaction

## Functions

### redactForRemoteAi()

> **redactForRemoteAi**\<`T`\>(`payload`, `options`): `T`

Defined in: [server/\_lib/agentControl/redaction.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/redaction.ts#L175)

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

Defined in: [server/\_lib/agentControl/redaction.ts:182](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/redaction.ts#L182)

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

Defined in: [server/\_lib/agentControl/redaction.ts:197](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/redaction.ts#L197)

#### Parameters

##### payload

`unknown`

##### options

`RedactionOptions` = `{}`

#### Returns

`string`
