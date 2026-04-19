[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/agent/\_creative

# api/\_handlers/agent/\_creative

## Type Aliases

### CreativeEnvelope

> **CreativeEnvelope** = [`CreativeSuccessEnvelope`](#creativesuccessenvelope) \| [`MissingContextEnvelope`](#missingcontextenvelope)

Defined in: [api/\_handlers/agent/\_creative.ts:139](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L139)

***

### CreativeMode

> **CreativeMode** = `"referral_og"` \| `"share_page_copy"` \| `"quest_reward"` \| `"metadata_bundle"`

Defined in: [api/\_handlers/agent/\_creative.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L18)

***

### CreativeSuccessEnvelope

> **CreativeSuccessEnvelope**\<`M`\> = `object`

Defined in: [api/\_handlers/agent/\_creative.ts:123](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L123)

#### Type Parameters

##### M

`M` *extends* [`CreativeMode`](#creativemode) = [`CreativeMode`](#creativemode)

#### Properties

##### mode

> **mode**: `M`

Defined in: [api/\_handlers/agent/\_creative.ts:125](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L125)

##### ok

> **ok**: `true`

Defined in: [api/\_handlers/agent/\_creative.ts:124](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L124)

##### result

> **result**: `CreativeResultByMode`\[`M`\]

Defined in: [api/\_handlers/agent/\_creative.ts:128](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L128)

##### version

> **version**: `CreativeVersion`

Defined in: [api/\_handlers/agent/\_creative.ts:126](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L126)

##### voice

> **voice**: `CreativeVoice`

Defined in: [api/\_handlers/agent/\_creative.ts:127](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L127)

***

### MissingContextEnvelope

> **MissingContextEnvelope** = `object`

Defined in: [api/\_handlers/agent/\_creative.ts:131](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L131)

#### Properties

##### error

> **error**: `"missing_required_context"`

Defined in: [api/\_handlers/agent/\_creative.ts:135](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L135)

##### missing

> **missing**: `string`[]

Defined in: [api/\_handlers/agent/\_creative.ts:136](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L136)

##### mode

> **mode**: [`CreativeMode`](#creativemode) \| `"unknown"`

Defined in: [api/\_handlers/agent/\_creative.ts:133](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L133)

##### ok

> **ok**: `false`

Defined in: [api/\_handlers/agent/\_creative.ts:132](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L132)

##### version

> **version**: `CreativeVersion`

Defined in: [api/\_handlers/agent/\_creative.ts:134](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L134)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/agent/\_creative.ts:724](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L724)

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

Defined in: [api/\_handlers/agent/\_creative.ts:683](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L683)

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

Defined in: [api/\_handlers/agent/\_creative.ts:321](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/agent/_creative.ts#L321)

#### Parameters

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`string` \| `null`
