[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/agent/\_creative

# api/\_handlers/agent/\_creative

## Type Aliases

### CreativeEnvelope

> **CreativeEnvelope** = `CreativeSuccessEnvelope` \| `MissingContextEnvelope`

Defined in: [api/\_handlers/agent/\_creative.ts:139](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/agent/_creative.ts#L139)

***

### CreativeMode

> **CreativeMode** = `"referral_og"` \| `"share_page_copy"` \| `"quest_reward"` \| `"metadata_bundle"`

Defined in: [api/\_handlers/agent/\_creative.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/agent/_creative.ts#L18)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/agent/\_creative.ts:724](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/agent/_creative.ts#L724)

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

Defined in: [api/\_handlers/agent/\_creative.ts:683](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/agent/_creative.ts#L683)

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

Defined in: [api/\_handlers/agent/\_creative.ts:321](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/agent/_creative.ts#L321)

#### Parameters

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`string` \| `null`
