[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/image/\_shared

# api/\_handlers/image/\_shared

## Type Aliases

### ApiFailure

> **ApiFailure** = `object`

Defined in: [api/\_handlers/image/\_shared.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L19)

#### Properties

##### error

> **error**: `string`

Defined in: [api/\_handlers/image/\_shared.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L19)

##### success

> **success**: `false`

Defined in: [api/\_handlers/image/\_shared.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L19)

***

### ApiSuccess

> **ApiSuccess**\<`T`\> = `object`

Defined in: [api/\_handlers/image/\_shared.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L18)

#### Type Parameters

##### T

`T`

#### Properties

##### data

> **data**: `T`

Defined in: [api/\_handlers/image/\_shared.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L18)

##### success

> **success**: `true`

Defined in: [api/\_handlers/image/\_shared.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L18)

***

### ImageMutationBody

> **ImageMutationBody** = `object`

Defined in: [api/\_handlers/image/\_shared.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L14)

#### Properties

##### projectId?

> `optional` **projectId**: `string`

Defined in: [api/\_handlers/image/\_shared.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L15)

## Functions

### decodeBase64Payload()

> **decodeBase64Payload**(`value`, `options`): `Uint8Array`

Defined in: [api/\_handlers/image/\_shared.ts:101](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L101)

#### Parameters

##### value

`string`

##### options

###### maxBytes?

`number`

#### Returns

`Uint8Array`

***

### getImageApiActor()

> **getImageApiActor**(`req`): `string` \| `null`

Defined in: [api/\_handlers/image/\_shared.ts:69](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L69)

Returns the authenticated session address, or null if not signed in.

#### Parameters

##### req

`VercelRequest`

#### Returns

`string` \| `null`

***

### isReferenceAssetRole()

> **isReferenceAssetRole**(`value`): value is "frame" \| "subject"

Defined in: [api/\_handlers/image/\_shared.ts:97](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L97)

#### Parameters

##### value

`unknown`

#### Returns

value is "frame" \| "subject"

***

### parseRequiredString()

> **parseRequiredString**(`value`): `string` \| `null`

Defined in: [api/\_handlers/image/\_shared.ts:93](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L93)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### prepareImageApi()

> **prepareImageApi**(`req`, `res`): `boolean`

Defined in: [api/\_handlers/image/\_shared.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L22)

CORS + no-store + admin-only gate. Used by AdminImageGeneration flows.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`boolean`

***

### prepareImageApiAuthenticated()

> **prepareImageApiAuthenticated**(`req`, `res`): `boolean`

Defined in: [api/\_handlers/image/\_shared.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L41)

CORS + no-store + any-authenticated-user gate. Used by vault-deploy image gen flows.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`boolean`

***

### readBody()

> **readBody**\<`T`\>(`req`, `options`): `Promise`\<`T`\>

Defined in: [api/\_handlers/image/\_shared.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L73)

#### Type Parameters

##### T

`T`

#### Parameters

##### req

`VercelRequest`

##### options

###### maxBytes?

`number`

#### Returns

`Promise`\<`T`\>

***

### requireImageApiAdmin()

> **requireImageApiAdmin**(`req`, `res`): `boolean`

Defined in: [api/\_handlers/image/\_shared.ts:55](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/image/_shared.ts#L55)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`boolean`
