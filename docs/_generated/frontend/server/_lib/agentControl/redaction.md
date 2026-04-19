[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/redaction

# server/\_lib/agentControl/redaction

## Functions

### redactForRemoteAi()

> **redactForRemoteAi**\<`T`\>(`payload`, `options`): `T`

Defined in: [server/\_lib/agentControl/redaction.ts:139](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/redaction.ts#L139)

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

Defined in: [server/\_lib/agentControl/redaction.ts:146](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/redaction.ts#L146)

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

Defined in: [server/\_lib/agentControl/redaction.ts:161](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/redaction.ts#L161)

#### Parameters

##### payload

`unknown`

##### options

`RedactionOptions` = `{}`

#### Returns

`string`
