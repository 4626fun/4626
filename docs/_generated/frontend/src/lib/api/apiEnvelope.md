[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/api/apiEnvelope

# src/lib/api/apiEnvelope

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [src/lib/api/apiEnvelope.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L1)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [src/lib/api/apiEnvelope.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L3)

##### details?

> `optional` **details**: `unknown`

Defined in: [src/lib/api/apiEnvelope.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L5)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/api/apiEnvelope.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L4)

##### success

> **success**: `boolean`

Defined in: [src/lib/api/apiEnvelope.ts:2](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L2)

## Functions

### parseApiEnvelope()

> **parseApiEnvelope**\<`T`\>(`response`): `Promise`\<[`ApiEnvelope`](#apienvelope)\<`T`\> \| `null`\>

Defined in: [src/lib/api/apiEnvelope.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L16)

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

Defined in: [src/lib/api/apiEnvelope.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/api/apiEnvelope.ts#L8)

#### Parameters

##### payload

`unknown`

##### fallback

`string`

#### Returns

`string`
