[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/agent/\_creative

# api/\_handlers/agent/\_creative

## Type Aliases

### CreativeEnvelope

> **CreativeEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope) \| [`MissingContextEnvelope`](#missingcontextenvelope)

Defined in: [api/\_handlers/agent/\_creative.ts:140](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L140)

***

### CreativeMode

> **CreativeMode** = `"referral_og"` \| `"share_page_copy"` \| `"quest_reward"` \| `"metadata_bundle"`

Defined in: [api/\_handlers/agent/\_creative.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L19)

***

### CreativeSuccessEnvelope

> **CreativeSuccessEnvelope**\<`M`\> = `object`

Defined in: [api/\_handlers/agent/\_creative.ts:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L124)

#### Type Parameters

##### M

`M` *extends* [`CreativeMode`](#creativemode) = [`CreativeMode`](#creativemode)

#### Properties

##### mode

> **mode**: `M`

Defined in: [api/\_handlers/agent/\_creative.ts:126](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L126)

##### ok

> **ok**: `true`

Defined in: [api/\_handlers/agent/\_creative.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L125)

##### result

> **result**: `CreativeResultByMode`\[`M`\]

Defined in: [api/\_handlers/agent/\_creative.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L129)

##### version

> **version**: `CreativeVersion`

Defined in: [api/\_handlers/agent/\_creative.ts:127](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L127)

##### voice

> **voice**: `CreativeVoice`

Defined in: [api/\_handlers/agent/\_creative.ts:128](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L128)

***

### MissingContextEnvelope

> **MissingContextEnvelope** = `object`

Defined in: [api/\_handlers/agent/\_creative.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L132)

#### Properties

##### error

> **error**: `"missing_required_context"`

Defined in: [api/\_handlers/agent/\_creative.ts:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L136)

##### missing

> **missing**: `string`[]

Defined in: [api/\_handlers/agent/\_creative.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L137)

##### mode

> **mode**: [`CreativeMode`](#creativemode) \| `"unknown"`

Defined in: [api/\_handlers/agent/\_creative.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L134)

##### ok

> **ok**: `false`

Defined in: [api/\_handlers/agent/\_creative.ts:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L133)

##### version

> **version**: `CreativeVersion`

Defined in: [api/\_handlers/agent/\_creative.ts:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L135)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/agent/\_creative.ts:725](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L725)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>

***

### generateCreativeEnvelope()

> **generateCreativeEnvelope**(`params`): `Promise`\<[`CreativeEnvelope`](#creativeenvelope)\>

Defined in: [api/\_handlers/agent/\_creative.ts:684](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L684)

#### Parameters

##### params

###### allowLlm?

`boolean`

###### context

`Record`\<`string`, `unknown`\>

###### correlationId?

`string`

###### mode

[`CreativeMode`](#creativemode)

#### Returns

`Promise`\<[`CreativeEnvelope`](#creativeenvelope)\>

***

### getCreativeContextValidationError()

> **getCreativeContextValidationError**(`context`): `string` \| `null`

Defined in: [api/\_handlers/agent/\_creative.ts:322](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/agent/_creative.ts#L322)

#### Parameters

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`string` \| `null`
