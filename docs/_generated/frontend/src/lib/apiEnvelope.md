[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/apiEnvelope

# src/lib/apiEnvelope

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [src/lib/apiEnvelope.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L1)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [src/lib/apiEnvelope.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L3)

##### details?

> `optional` **details**: `unknown`

Defined in: [src/lib/apiEnvelope.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L5)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/apiEnvelope.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L4)

##### success

> **success**: `boolean`

Defined in: [src/lib/apiEnvelope.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L2)

## Functions

### parseApiEnvelope()

> **parseApiEnvelope**\<`T`\>(`response`): `Promise`\<[`ApiEnvelope`](#apienvelope)\<`T`\> \| `null`\>

Defined in: [src/lib/apiEnvelope.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L16)

#### Type Parameters

##### T

`T`

#### Parameters

##### response

`Response`

#### Returns

`Promise`\<[`ApiEnvelope`](#apienvelope)\<`T`\> \| `null`\>

***

### resolveApiErrorMessage()

> **resolveApiErrorMessage**(`payload`, `fallback`): `string`

Defined in: [src/lib/apiEnvelope.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/apiEnvelope.ts#L8)

#### Parameters

##### payload

`unknown`

##### fallback

`string`

#### Returns

`string`
